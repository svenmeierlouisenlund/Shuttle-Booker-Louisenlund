#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Regionalshuttle Louisenlund
#
# Erstes Setup:   bash deploy.sh --setup
# Update:         bash deploy.sh
# Nur Backend:    bash deploy.sh --backend
# Nur Frontend:   bash deploy.sh --frontend
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/louisenlund"
ENV_FILE="$APP_DIR/.env"
PM2_NAME="louisenlund-api"
NGINX_SITE="/etc/nginx/sites-available/louisenlund"
NGINX_ENABLED="/etc/nginx/sites-enabled/louisenlund"

# Farben
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}▶${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC} $*"; }
error()   { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}$*${NC}"; echo "─────────────────────────────────────────"; }

# ─── Argumente ────────────────────────────────────────────────────────────────
SETUP=false
BACKEND_ONLY=false
FRONTEND_ONLY=false

for arg in "$@"; do
  case $arg in
    --setup)    SETUP=true ;;
    --backend)  BACKEND_ONLY=true ;;
    --frontend) FRONTEND_ONLY=true ;;
    --help|-h)
      echo "Verwendung: bash deploy.sh [--setup|--backend|--frontend]"
      echo "  (kein Flag)   Update: pull, build, restart"
      echo "  --setup       Erstinstallation (einmalig)"
      echo "  --backend     Nur Backend neu bauen und neustarten"
      echo "  --frontend    Nur Frontend neu bauen"
      exit 0
      ;;
  esac
done

# ─── Erstinstallation ─────────────────────────────────────────────────────────
if $SETUP; then
  header "Erstinstallation"

  command -v node  &>/dev/null || error "Node.js nicht gefunden. Bitte zuerst installieren: https://nodejs.org"
  command -v pnpm  &>/dev/null || error "pnpm nicht gefunden. Bitte zuerst installieren: npm install -g pnpm"
  command -v pm2   &>/dev/null || error "pm2 nicht gefunden. Bitte zuerst installieren: npm install -g pm2"
  command -v psql  &>/dev/null || error "PostgreSQL nicht gefunden. Bitte zuerst installieren: apt install postgresql"
  command -v nginx &>/dev/null || error "nginx nicht gefunden. Bitte zuerst installieren: apt install nginx"

  # .env prüfen
  if [[ ! -f "$ENV_FILE" ]]; then
    warn ".env nicht gefunden — wird erstellt."
    cat > "$ENV_FILE" << 'ENVEOF'
# Pflicht: PostgreSQL-Verbindungsstring
DATABASE_URL=postgresql://ll_user:PASSWORT@localhost:5432/louisenlund

# Pflicht: zufälliger Secret für Session-Cookies (min. 32 Zeichen)
SESSION_SECRET=BITTE_AENDERN_mit_openssl_rand_hex_32

# Optional: Admin-Startpasswort (Standard: louisenlund2026)
ADMIN_PASSWORD=IhrStartpasswort2026

NODE_ENV=production
PORT=8080
ENVEOF
    echo ""
    warn "Bitte jetzt $ENV_FILE anpassen, dann erneut ausführen!"
    exit 1
  fi

  # .env laden
  set -o allexport
  source "$ENV_FILE"
  set +o allexport

  info "Abhängigkeiten installieren …"
  cd "$APP_DIR"
  pnpm install --frozen-lockfile

  info "Datenbank-Schema anlegen …"
  pnpm --filter @workspace/db run push

  info "Backend bauen …"
  pnpm --filter @workspace/api-server run build

  info "Frontend bauen …"
  pnpm --filter @workspace/louisenlund run build

  info "pm2-Prozess starten …"
  pm2 start "$APP_DIR/artifacts/api-server/dist/index.mjs" \
    --name "$PM2_NAME" \
    --env production
  pm2 save

  # nginx-Config anlegen (falls nicht vorhanden)
  if [[ ! -f "$NGINX_SITE" ]]; then
    warn "nginx-Config fehlt. Eine Vorlage wird erstellt."
    cat > "$NGINX_SITE" << 'NGINXEOF'
server {
    listen 80;
    server_name IHRE_DOMAIN;

    root /opt/louisenlund/artifacts/louisenlund/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEOF
    ln -sf "$NGINX_SITE" "$NGINX_ENABLED"
    warn "Bitte $NGINX_SITE anpassen (server_name setzen), dann:"
    warn "  nginx -t && systemctl reload nginx"
    warn "  certbot --nginx -d IHRE_DOMAIN"
  fi

  echo ""
  success "Erstinstallation abgeschlossen!"
  echo -e "  Backend:  pm2 status"
  echo -e "  Logs:     pm2 logs $PM2_NAME"
  echo -e "  nginx:    $NGINX_SITE anpassen, dann: nginx -t && systemctl reload nginx"
  exit 0
fi

# ─── Update ───────────────────────────────────────────────────────────────────
header "Regionalshuttle Louisenlund — Deployment"
echo "$(date '+%d.%m.%Y %H:%M:%S')"

cd "$APP_DIR"

# .env laden
if [[ ! -f "$ENV_FILE" ]]; then
  error ".env nicht gefunden: $ENV_FILE"
fi
set -o allexport
source "$ENV_FILE"
set +o allexport

# Git pull (nur wenn kein --backend/--frontend ohne pull gewünscht)
if ! $BACKEND_ONLY && ! $FRONTEND_ONLY; then
  header "1 · Code aktualisieren"
  info "git pull …"
  git pull --ff-only
  success "Code aktuell ($(git rev-parse --short HEAD))"

  header "2 · Abhängigkeiten"
  info "pnpm install …"
  pnpm install --frozen-lockfile
  success "Abhängigkeiten aktuell"

  header "3 · Datenbank-Migrations"
  info "Schema synchronisieren …"
  pnpm --filter @workspace/db run push
  success "Datenbank aktuell"
fi

# Backend bauen
if ! $FRONTEND_ONLY; then
  header "$(if $BACKEND_ONLY; then echo '1'; else echo '4'; fi) · Backend bauen"
  info "Build starten …"
  pnpm --filter @workspace/api-server run build
  success "Backend gebaut"

  info "pm2-Prozess neustarten …"
  if pm2 describe "$PM2_NAME" &>/dev/null; then
    pm2 reload "$PM2_NAME" --update-env
  else
    pm2 start "$APP_DIR/artifacts/api-server/dist/index.mjs" \
      --name "$PM2_NAME" \
      --env production
    pm2 save
  fi
  success "Backend läuft ($PM2_NAME)"
fi

# Frontend bauen
if ! $BACKEND_ONLY; then
  header "$(if $FRONTEND_ONLY; then echo '1'; else echo '5'; fi) · Frontend bauen"
  info "Vite build …"
  pnpm --filter @workspace/louisenlund run build
  success "Frontend gebaut"

  info "nginx neu laden …"
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    success "nginx neu geladen"
  else
    warn "nginx-Config ungültig — bitte manuell prüfen: nginx -t"
  fi
fi

# ─── Abschluss ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  Deployment erfolgreich ✓    ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════╝${NC}"
echo ""
echo -e "  Commit:  $(git rev-parse --short HEAD 2>/dev/null || echo '–')"
echo -e "  Zeit:    $(date '+%d.%m.%Y %H:%M:%S')"
echo ""
echo -e "  Logs:    pm2 logs $PM2_NAME --lines 50"
echo -e "  Status:  pm2 status"
echo ""
