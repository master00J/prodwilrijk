-- Auditlog voor mobiele persoonlijke assistent (tool-aanroepen).

CREATE TABLE IF NOT EXISTS personal_assistant_tool_log (
  id            BIGSERIAL PRIMARY KEY,
  tool_name     TEXT NOT NULL,
  user_id       TEXT,
  success       BOOLEAN NOT NULL DEFAULT TRUE,
  duration_ms   INTEGER,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_assistant_tool_log_created
  ON personal_assistant_tool_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_personal_assistant_tool_log_tool
  ON personal_assistant_tool_log (tool_name, created_at DESC);

ALTER TABLE personal_assistant_tool_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON personal_assistant_tool_log;
CREATE POLICY "Allow all for authenticated users" ON personal_assistant_tool_log
  FOR ALL USING (true) WITH CHECK (true);
