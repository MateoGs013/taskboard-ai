-- TaskBoard AI — Fase 3: AI tracking + conversations
-- PostgreSQL 16

CREATE TABLE ai_action_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id       UUID REFERENCES teams(id) ON DELETE SET NULL,
  action_type   TEXT NOT NULL,
  model         TEXT NOT NULL,
  input         JSONB,
  output        JSONB,
  tokens_in     INT,
  tokens_out    INT,
  duration_ms   INT,
  accepted      BOOLEAN,                     -- null = pending, true = accepted, false = rejected
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_logs_workspace ON ai_action_logs(workspace_id, created_at DESC);
CREATE INDEX idx_ai_logs_user ON ai_action_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_logs_action ON ai_action_logs(action_type);

CREATE TABLE ai_conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT,
  context_type  TEXT NOT NULL DEFAULT 'workspace' CHECK (context_type IN ('workspace', 'team', 'project', 'cycle', 'issue')),
  context_id    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_conv_user ON ai_conversations(user_id, updated_at DESC);

CREATE TABLE ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content         TEXT NOT NULL,
  tokens          INT,
  model           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_messages_conv ON ai_messages(conversation_id, created_at ASC);

CREATE TRIGGER trg_ai_conv_updated BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
