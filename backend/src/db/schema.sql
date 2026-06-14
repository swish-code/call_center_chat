-- Call Center AI Assistant — database schema
-- PostgreSQL + pgvector. Embeddings use Gemini text-embedding-004 (768 dims).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ── Users & roles ────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('agent', 'team_leader', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'agent',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Brands ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Knowledge base: unstructured text + vector ───────────
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   UUID REFERENCES brands(id) ON DELETE CASCADE,
  language   TEXT NOT NULL DEFAULT 'auto',   -- 'ar' | 'en' | 'auto'
  content    TEXT NOT NULL,
  embedding  VECTOR(768),
  source     TEXT,                           -- e.g. 'manual', 'email:123', 'gap:45'
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IVFFlat index for cosine similarity. Requires ANALYZE after bulk load.
-- lists=100 is fine up to ~100k rows; raise for larger corpora.
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_brand ON knowledge_chunks(brand_id);

-- ── Structured data (queried directly — never via vectors) ─
CREATE TABLE IF NOT EXISTS branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  address       TEXT,
  city          TEXT,
  phone         TEXT,
  working_hours TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branches_brand ON branches(brand_id);

CREATE TABLE IF NOT EXISTS pricing (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  item_name  TEXT NOT NULL,
  price      NUMERIC(12,2) NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'EGP',
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_brand ON pricing(brand_id);

-- ── Chat logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id   UUID REFERENCES brands(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,             -- 'user' | 'assistant'
  content         TEXT NOT NULL,
  language        TEXT,
  retrieved_confidence REAL,                 -- top similarity at answer time
  answered        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- ── Gap requests (missing data raised by agents/AI) ──────
DO $$ BEGIN
  CREATE TYPE gap_status AS ENUM ('open', 'resolved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS gap_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question        TEXT NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  brand_id        UUID REFERENCES brands(id) ON DELETE SET NULL,
  status          gap_status NOT NULL DEFAULT 'open',
  raised_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  standard_answer TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gaps_status ON gap_requests(status);

-- ── New information requests (from Outlook or chat) ──────
DO $$ BEGIN
  CREATE TYPE info_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS info_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT NOT NULL,           -- 'email' | 'chat'
  source_ref        TEXT,                    -- email message id, etc.
  proposed_question TEXT,
  proposed_answer   TEXT NOT NULL,
  brand_id          UUID REFERENCES brands(id) ON DELETE SET NULL,
  status            info_status NOT NULL DEFAULT 'pending',
  reviewed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_info_status ON info_requests(status);

-- ── Audit trail ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);

-- Idempotency for Outlook polling: don't process the same email twice.
CREATE TABLE IF NOT EXISTS processed_emails (
  message_id  TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
