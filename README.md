# FleetOps — Fleet Management & Vehicle Operations Platform

**Live demo:** https://fleetops-sai.vercel.app — demo login `manager@example.com` / `Password123!`

A production-style enterprise SaaS for companies that operate multiple vehicles and
drivers: fleet inventory, driver roster, trip lifecycle, live GPS tracking
(simulated), maintenance scheduling, fuel logging, document expiry tracking,
notifications, analytics, reports, RBAC, audit logging and an AI fleet assistant —
all from a single dashboard.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 4 · shadcn-style UI · TanStack Query · React Hook Form + Zod · Recharts · Leaflet/OpenStreetMap (Mapbox-capable) · Socket.IO client |
| Backend | Node.js · Express · TypeScript · Prisma · PostgreSQL · JWT (access + refresh rotation) · Socket.IO · Zod · Vitest |
| AI service | Python · FastAPI · OpenAI-compatible tool-calling loop (httpx, any provider) · deterministic offline fallback |
| Infra | Docker Compose · GitHub Actions CI |

## Architecture

```
frontend/  (Next.js :3000)
   │  REST + Socket.IO
   ▼
backend/   (Express :4000)
   │  /api/ai-data/* (internal token)
   ▲
ai-service (FastAPI :8000)
   │
PostgreSQL :5432
```

- **Backend layering** — `routes → controllers → services → repositories → Prisma`.
  Business rules (availability checks, trip state machine, audit logging) live in
  services; Prisma queries live in repositories; routes stay thin.
- **AI isolation** — the AI service can **never** query the DB. It calls a small
  curated read-only endpoint set (`/api/ai-data/*`) guarded by an internal token.
  The LLM only chooses among declared tools; there is no SQL path.
- **Realtime** — a built-in GPS simulator moves `ON_TRIP` vehicles along their
  source→destination route every 3 s, persists `GpsLocation` rows, and broadcasts
  `fleet:locations` + `trip:updated` + `notification:new` over Socket.IO.

## Roles

| | SUPER_ADMIN | FLEET_MANAGER | DRIVER | VIEWER |
|---|---|---|---|---|
| Manage users / roles / audit | ✓ | | | |
| Manage vehicles, drivers, trips, maintenance, fuel, docs | ✓ | ✓ | | |
| View everything + reports | ✓ | ✓ | partial | ✓ |
| Own trips, start/complete, submit fuel, report issues | | | ✓ | |
| Modify any data | ✓ | ✓ | limited | ✗ |

## Quick start (Docker — recommended)

```bash
cp .env.example .env
docker compose up --build
```

Then seed:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx tsx prisma/seed.ts
```

Open http://localhost:3000 — Swagger at http://localhost:4000/api-docs.

## Local development (no Docker)

The repo works without Docker — `embedded-postgres` provides a native Postgres:

```bash
# 1. Database (native Postgres on :5432, creds fleet/fleet, db fleetdb)
cd backend && npm install && npm run db:embedded      # keep running

# 2. Backend — new terminal
cd backend && cp .env.example .env
npx prisma migrate dev && npm run seed && npm run dev

# 3. AI service — new terminal
cd ai-service && python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
set AI_INTERNAL_TOKEN=dev-internal-token && set BACKEND_URL=http://localhost:4000
uvicorn app.main:app --port 8000

# 4. Frontend — new terminal
cd frontend && npm install && cp .env.example .env && npm run dev
```

> Windows note: if the repo lives in a path containing `&` or spaces, npm `.cmd`
> shims break. Work around with a junction: `New-Item -ItemType Junction -Path
> C:\fleet-platform -Target "<this repo>"`.

## Demo accounts (password: `Password123!`)

| Email | Role |
|---|---|
| admin@example.com | SUPER_ADMIN |
| manager@example.com | FLEET_MANAGER |
| driver@example.com | DRIVER |
| viewer@example.com | VIEWER |

## Recruiter demo flow

Login (manager) → Dashboard KPIs → Vehicles → open a vehicle → Maintenance tab →
Trips → Create trip (pick available vehicle + driver) → Start → In-transit →
open **Live Map** (watch the marker move in realtime) → back to Trips → Complete →
Dashboard/Reports → **AI Assistant** ("which vehicles are available?") →
vehicle detail → **Analyze vehicle** (AI maintenance risk).

## API surface

All under `/api`, envelope `{ success, data | message, errorCode }`,
`meta: { page, totalPages, total }` on lists:

- `POST /auth/login · /register · /refresh · /logout · /forgot-password · /reset-password · /change-password`, `GET /auth/me`
- `GET/POST /vehicles`, `GET/PUT/DELETE /vehicles/:id`, `POST /vehicles/:id/assign-driver`
- `GET/POST /drivers`, `GET/PUT /drivers/:id`, `PATCH /drivers/:id/status`, `GET /drivers/me/profile`
- `GET/POST /trips`, `GET /trips/mine`, `PUT /trips/:id/{start,transit,complete,cancel,delay}`
- `GET/POST /maintenance`, `PUT /maintenance/:id`, `GET /maintenance/dashboard`
- `GET/POST /fuel`, `GET /fuel/efficiency`
- `GET/POST /documents`, `PUT/DELETE /documents/:id` (+ `?expiringInDays=`)
- `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- `GET /analytics/dashboard`, `GET /analytics/charts`
- `GET /reports/{fleet,fuel,maintenance,trips}` (+ `?format=csv`)
- `GET /locations/live`, `GET /locations/:vehicleId/history`
- `GET /search?q=`
- `POST /ai/ask`, `GET /ai/predictive-maintenance/:id`, `GET /ai/fuel-anomalies`
- `GET /users` + `GET /audit-logs` (admin)

Full request/response schemas: `backend/openapi.yaml` → http://localhost:4000/api-docs

## Environment variables

See `.env.example` files in each service. Key ones:

| Var | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Prisma connection |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | backend | token signing — change in prod |
| `AI_SERVICE_URL` / `AI_INTERNAL_TOKEN` | backend | AI proxy + ai-data guard |
| `AI_API_KEY` | ai-service | **empty → deterministic mode**; set to enable LLM |
| `AI_BASE_URL` / `AI_MODEL` | ai-service | any OpenAI-compatible endpoint |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | frontend | **empty → free OSM tiles** |
| `GPS_SIMULATOR_ENABLED/_INTERVAL_MS` | backend | live tracking |

## Testing

```bash
cd backend && npm test            # 13 unit tests; integration tests auto-skip w/o DB
cd ai-service && python -m pytest # 6 heuristic tests
cd frontend && npm run build      # type-check + lint + build
```

Integration tests spin up against `DATABASE_URL` when a Postgres is reachable.

## Security notes

- Passwords hashed with bcrypt (cost 12); refresh tokens hashed + rotated, revoked
  on logout/password change.
- Zod validation on every body/query; role middleware on every mutating route;
  rate limiting + helmet + strict CORS.
- `backend/.env`, real secrets and `.pgdata/` are gitignored — only `.env.example`
  placeholders are committed.
- Reset-token endpoint returns the token in the response **for the demo only** —
  wire an email provider (SMTP) for production.

## Deployment (free tier: Vercel + Render + Neon)

Do these in order — later steps need URLs from earlier ones.

**1. Database — Neon**
- neon.tech → New Project → copy the **pooled** connection string
  (`postgresql://...-pooler...neon.tech/fleetdb?sslmode=require`)

**2. Backend + AI service — Render blueprint**
- render.com → **New → Blueprint** → connect `saiganesh-09/fleet-management-platform`
- Render detects `render.yaml` and prompts for the `sync: false` vars:

  | Var | Value |
  |---|---|
  | `DATABASE_URL` | Neon pooled connection string |
  | `AI_INTERNAL_TOKEN` | any random string — **paste the same value for both services** |
  | `AI_SERVICE_URL` | `https://fleetops-ai.onrender.com` |
  | `BACKEND_URL` | `https://fleetops-backend.onrender.com` |
  | `FRONTEND_URL` / `CORS_ORIGINS` | `https://<your-app>.vercel.app` (step 3) |

- After both services deploy green, seed demo data via Render **Shell** on
  `fleetops-backend`: `npx tsx prisma/seed.ts`

**3. Frontend — Vercel**
- vercel.com → Add New → Project → import the repo
- **Root Directory: `frontend`**
- Env vars:
  - `NEXT_PUBLIC_API_URL` = `https://fleetops-backend.onrender.com/api`
  - `NEXT_PUBLIC_SOCKET_URL` = `https://fleetops-backend.onrender.com`
- Deploy → copy the `*.vercel.app` URL back into `FRONTEND_URL`/`CORS_ORIGINS`
  on Render and redeploy the backend

**Notes**
- Free Render services sleep after ~15 min idle — first request takes ~30–60 s
  (a nice thing to mention in interviews, or upgrade to keep-alive).
- WebSockets work on Render web services; Socket.IO needs no extra config.
- `AI_API_KEY` empty → deterministic assistant; set it to enable LLM answers.

## Known limitations / next steps

- Map defaults to OSM tiles; set `NEXT_PUBLIC_MAPBOX_TOKEN` for Mapbox styling.
- Document `fileUrl` stores a URL; swap for S3/MinIO upload for real files.
- GPS simulation is straight-line interpolation between source/destination —
  enough for demos; production would ingest a telematics feed.
- AI answers are deterministic template output until `AI_API_KEY` is set.
- PDF export: reports are CSV; a print-styled view or `pdfmake` can be added.
