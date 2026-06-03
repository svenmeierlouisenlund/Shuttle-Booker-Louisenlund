# Regionalshuttle Louisenlund

Buchungsportal für den Regionalshuttle der Stiftung Louisenlund für das Schuljahr 2026/27.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/louisenlund run dev` — run the frontend (port 22499)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `ADMIN_PASSWORD` — Admin password (default: `louisenlund2026`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, react-hook-form + zod, wouter
- API: Express 5 with cookie-based admin auth
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/bookings.ts` — DB schema (bookings + siblings tables)
- `artifacts/api-server/src/routes/bookings.ts` — POST /api/bookings
- `artifacts/api-server/src/routes/admin.ts` — Admin API routes
- `artifacts/louisenlund/src/pages/` — All frontend pages
- `artifacts/louisenlund/src/index.css` — Theme / design tokens

## Architecture decisions

- Cookie-based admin auth: httpOnly session cookie → UUID token → in-memory sessions Map (`SessionData: {userId, username, role}`)
- User accounts stored in `admin_users` table; default "admin" user seeded on startup from `ADMIN_PASSWORD` env var
- Password hashing: PBKDF2-SHA512 via Node built-in `crypto`, format `salt:hash` (32 hex chars salt, 128 hex chars hash)
- Roles: `admin` | `buchhaltung` | `schulbuero` | `fahrer` — only `admin` role can access user management
- `verify-password` route checks current session user's password (used by pricing confirmation dialog)
- CSV export uses BOM (UTF-8 with BOM) for proper Excel compatibility with German umlauts
- Siblings stored in a separate `siblings` table linked to bookings via foreign key with CASCADE delete
- Reference numbers format: `LL-YYYY-NNNNN` (e.g. `LL-2026-42387`)

## Product

- 6-step booking form: contact details → tariff zone → booking type → routes → siblings → summary
- Admin dashboard: statistics, booking list with filters, CSV export, status management, notes
- Booking statuses: Eingegangen / Geprüft / Bestätigt / Rückfrage offen
- 20% sibling discount (informational, displayed to user)
- Supports up to 3 siblings per booking
- User management (admin only): create/edit/deactivate/delete users with role assignment, shown in Einstellungen

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always run `pnpm --filter @workspace/api-spec run codegen` before touching routes or frontend
- The `pnpm --filter @workspace/db run push` command applies schema to the database — run after any schema file change
- Admin route `/admin/bookings/export` must come BEFORE `/admin/bookings/:id` in Express router to avoid the export path being treated as an ID param

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
