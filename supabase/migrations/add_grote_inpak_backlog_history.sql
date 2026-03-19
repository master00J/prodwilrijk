-- Add backlog history tracking for grote inpak

CREATE TABLE IF NOT EXISTS grote_inpak_backlog_history (
  id BIGSERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  backlog_overdue INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_backlog_history_snapshot_date
  ON grote_inpak_backlog_history(snapshot_date);

ALTER TABLE grote_inpak_backlog_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_backlog_history;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_backlog_history
  FOR ALL
  USING (true)
  WITH CHECK (true);
