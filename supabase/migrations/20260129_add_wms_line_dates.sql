ALTER TABLE wms_project_lines
  ADD COLUMN IF NOT EXISTS received_at DATE,
  ADD COLUMN IF NOT EXISTS shipped_at DATE;
