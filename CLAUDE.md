# Regionalshuttle Louisenlund — Claude Code Context

Buchungsportal für den Regionalshuttle der Stiftung Louisenlund (Schuljahr 2026/27).

## Stack

- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: `artifacts/louisenlund` — React + Vite, Tailwind CSS, shadcn/ui, react-hook-form + zod, wouter (routing), react-leaflet (Karte)
- **Backend**: `artifacts/api-server` — Express 5, cookie-basierte Admin-Auth, esbuild (CJS-Bundle)
- **Datenbank**: PostgreSQL + Drizzle ORM (`lib/db`)
- **API-Vertrag**: OpenAPI-Spec (`lib/api-spec/openapi.yaml`) → Orval generiert React-Query-Hooks + Zod-Schemas
- **Validierung**: Zod v4 (`zod/v4`), drizzle-zod

## Wichtige Befehle

```bash
pnpm --filter @workspace/api-server run dev        # API-Server starten (Port 8080)
pnpm --filter @workspace/louisenlund run dev       # Frontend starten (Port 22499)
pnpm run typecheck                                  # Vollständiger Typecheck
pnpm --filter @workspace/api-spec run codegen      # API-Hooks + Zod-Schemas neu generieren
pnpm --filter @workspace/db run push               # DB-Schema anwenden (nur dev)
```

## Wo was liegt

```
lib/api-spec/openapi.yaml              OpenAPI-Vertrag (Single Source of Truth)
lib/db/src/schema/bookings.ts          DB-Schema (bookings + siblings)
artifacts/api-server/src/routes/
  bookings.ts                          POST /api/bookings (öffentliche Buchung)
  admin.ts                             Alle Admin-Routen
artifacts/louisenlund/src/pages/
  booking/                             6-stufiges Buchungsformular (öffentlich)
  admin/                               Admin-Dashboard, Buchungsliste, Einstellungen
  admin/bookings/[id].tsx              Buchungsdetail mit Kartenpin-Editor
  admin/bus-detail.tsx                 Busrouten-Karte (Leaflet + Geocoding)
artifacts/louisenlund/src/index.css    Design-Tokens / Theme
```

## Architektur-Entscheidungen

- **Auth**: httpOnly-Session-Cookie → UUID-Token → in-memory Sessions-Map (`SessionData: {userId, username, role}`)
- **Nutzer**: `admin_users`-Tabelle; Default-"admin"-User wird beim Start aus `ADMIN_PASSWORD` gesetzt
- **Passwort-Hashing**: PBKDF2-SHA512 via Node `crypto`, Format `salt:hash`
- **Rollen**: `admin` | `buchhaltung` | `schulbuero` | `fahrer` — nur `admin` hat Zugriff auf Nutzerverwaltung
- **Geschwisterrabatt**: 20 % (wird beim Speichern automatisch berechnet; `recalcFamilyPrices()` nach jedem Update aufrufen)
- **Referenznummern**: Format `LL-YYYY-NNNNN` (z.B. `LL-2026-42387`)
- **CSV-Export**: UTF-8 mit BOM für korrekte Excel-Kompatibilität bei deutschen Umlauten
- **Geschwister** in der DB: eigene `siblings`-Tabelle, verknüpft mit `bookings` via `bookingId`, CASCADE-Delete

## Buchungs-Flow

1. Kontaktdaten → 2. Tarifzone → 3. Buchungsart → 4. Strecken → 5. Geschwister → 6. Zusammenfassung

**Status-Werte**: `received` (Eingegangen) | `reviewed` (Geprüft) | `confirmed` (Bestätigt) | `query_open` (Rückfrage offen)

## Sammelpunkt / Kartenpin

- Buchungen können entweder eine Textadresse **oder** GPS-Koordinaten als Abholpunkt haben (oder beides)
- DB-Felder: `pickup_lat` (real, nullable), `pickup_lng` (real, nullable)
- Im Admin-Buchungsdetail (`[id].tsx`): `PickupMapPicker` (Bearbeitungsmodus) und `PickupMapPreview` (Ansicht)
- `bus-detail.tsx` wertet gespeicherte Koordinaten aus und überspringt Geocoding wenn Coords vorhanden

## XLSX-Import / Export

- **Import-Route**: `POST /api/admin/import` — erkennt automatisch altes (10-Spalten) und neues Format
- **Neues Format**: Spalte "Typ" = `Hauptkind` | `Geschwister`; Geschwisterzeilen tragen die Referenznummer der **Hauptbuchung** (nicht die eigene)
- **Import-Logik**: 2-Pass — Pass 1: Hauptkinder; Pass 2: Geschwister (Lookup per Ref → Fallback per E-Mail)
- **Export-Route**: `GET /api/admin/bookings/export?format=xlsx`

## Codegen-Workflow (nach OpenAPI-Änderungen)

1. `lib/api-spec/openapi.yaml` bearbeiten
2. `pnpm --filter @workspace/api-spec run codegen` ausführen
3. Backend-Route in `admin.ts` / `bookings.ts` anpassen
4. Frontend verwendet automatisch die neuen generierten Hooks

## Kritische Regeln

- **Kein `console.log` im Server-Code** — stattdessen `req.log` in Routen, `logger` sonst
- **Route-Reihenfolge**: `/admin/bookings/export` muss **vor** `/admin/bookings/:id` registriert sein
- **Nach Schema-Änderungen**: immer `pnpm --filter @workspace/db run push` ausführen
- **Nach OpenAPI-Änderungen**: immer Codegen laufen lassen bevor Routen oder Frontend angefasst werden
- **Preisberechnung**: nach jeder Buchungs- oder Geschwister-Änderung `recalcFamilyPrices(parentName)` aufrufen
- **Artifacts** laufen hinter einem Reverse-Proxy — keine absoluten Localhost-URLs im App-Code verwenden

## Umgebungsvariablen (required)

| Variable | Beschreibung |
|---|---|
| `DATABASE_URL` | PostgreSQL-Connection-String |
| `SESSION_SECRET` | Secret für Session-Cookies |
| `ADMIN_PASSWORD` | Passwort für Default-Admin (default: `louisenlund2026`) |
| `SMTP_USER` / `SMTP_PASS` | E-Mail-Versand |
