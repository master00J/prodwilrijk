-- Add case_type to packed history for kanban/analysis

ALTER TABLE grote_inpak_packed
  ADD COLUMN IF NOT EXISTS case_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_packed_case_type
  ON grote_inpak_packed(case_type);
