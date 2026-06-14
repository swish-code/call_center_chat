# Call Center AI Assistant

AI-powered assistant that helps call center agents answer customer inquiries **strictly from an approved knowledge base** (RAG). The AI never invents answers; missing data is routed to Team Leaders for human approval before entering the database.

> Full specification: see `docs/SPEC.md`.

---

## Architecture

```
call-center-ai/
├── backend/        Node.js + Express API (PostgreSQL + pgvector + Gemini)
├── frontend/       Next.js (React) — chat, dashboards, review queues
├── docker-compose.yml   Local PostgreSQL 16 + pgvector for development
└── docs/SPEC.md    Master specification
```

| Layer       | Technology                                   |
|-------------|----------------------------------------------|
| Hosting     | Railway                                       |
| Backend     | Node.js + Express                            |
| Database    | PostgreSQL + `pgvector`                      |
| AI / LLM    | Google Gemini API                           |
| Embeddings  | Gemini `text-embedding-004` (768 dims)      |
| Frontend    | Next.js (React)                             |
| Email       | Microsoft Graph API (Outlook)               |
| Auth        | JWT + role-based access control (RBAC)       |

---

## Build phases & status

| Phase | Scope | Status |
|-------|-------|--------|
| 1 — Foundation | DB + pgvector, Express, JWT auth, RBAC, users/brands/data CRUD | ✅ Implemented |
| 2 — AI Chat (RAG) | Embedding pipeline, vector + SQL retrieval, confidence gate, Gemini | ✅ Implemented |
| 3 — Gap Loop | "No data" tickets, Team Leader resolution, write-back to KB | ✅ Implemented |
| 4 — Outlook | MS Graph OAuth, email polling, info extraction, review requests | 🟡 Scaffolded (needs Graph app reg.) |
| 5 — Dashboard | Repeated questions, gaps per brand, queues, usage metrics | ✅ Implemented (API + UI) |

---

## Quick start (local development)

### 1. Start PostgreSQL + pgvector

```bash
docker compose up -d
```

This starts Postgres 16 with the `pgvector` extension on `localhost:5432`
(db `callcenter`, user `postgres`, password `postgres`).

### 2. Backend

```bash
cd backend
cp .env.example .env          # then fill in GEMINI_API_KEY etc.
npm install
npm run migrate               # creates tables + pgvector extension
npm run seed                  # demo admin user + sample brands/data
npm run dev                   # http://localhost:4000
```

Default seeded admin: `admin@example.com` / `admin1234` (change immediately).

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

---

## Environment variables

See `backend/.env.example` and `frontend/.env.local.example` for the full list.
The minimum needed to run the AI chat is `GEMINI_API_KEY`. Everything else has
sensible local defaults.

---

## Deploying to Railway

1. Create a Railway project, add a **PostgreSQL** plugin, then enable pgvector:
   `CREATE EXTENSION IF NOT EXISTS vector;` (the migration does this automatically).
2. Add a service from the `backend/` directory. Set env vars from `.env.example`
   (`DATABASE_URL` is provided by Railway's Postgres plugin).
3. Add a second service from `frontend/` and point `NEXT_PUBLIC_API_URL` at the
   backend service URL.
4. Run `npm run migrate && npm run seed` once (Railway shell or a one-off job).

---

## Safety guarantees (by design)

- The AI answers **only** from retrieved context; below the similarity threshold it
  returns "No data available" and opens a gap ticket.
- **No automatic database writes** — every knowledge-base change is human-approved.
- Full audit trail (`audit_log`) on every approval/rejection.
- All conversations logged for analytics and tuning.
