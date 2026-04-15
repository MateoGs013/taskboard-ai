-- Fase 6: webhooks + audit log denormalization

CREATE TABLE IF NOT EXISTS webhooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  secret        TEXT NOT NULL,
  events        JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  last_fired_at TIMESTAMPTZ,
  last_status   INT,
  failure_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhooks(workspace_id) WHERE is_active = TRUE;

CREATE TRIGGER trg_webhooks_updated BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Denormalize workspace_id on activity for fast workspace-level feeds.
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

UPDATE activity_log al
   SET workspace_id = t.workspace_id
  FROM issues i
  JOIN teams t ON t.id = i.team_id
 WHERE al.issue_id = i.id
   AND al.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_log(workspace_id, created_at DESC);
