-- TaskBoard AI — Fase 4: notifications + search indexes
-- PostgreSQL 16

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issue_id    UUID REFERENCES issues(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('assigned', 'mentioned', 'commented', 'status_changed', 'completed', 'cycle_started')),
  title       TEXT NOT NULL,
  body        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;

-- Trigram indexes for fast ILIKE search
CREATE INDEX idx_issues_title_trgm ON issues USING GIN (title gin_trgm_ops);
CREATE INDEX idx_issues_identifier_trgm ON issues USING GIN (identifier gin_trgm_ops);
CREATE INDEX idx_projects_name_trgm ON projects USING GIN (name gin_trgm_ops);
