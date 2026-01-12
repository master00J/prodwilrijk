-- Add erp_code and stapel columns to grote_inpak_cases table
-- These are needed for transport planning

ALTER TABLE grote_inpak_cases
  ADD COLUMN IF NOT EXISTS erp_code VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stapel INTEGER DEFAULT 1;

-- Add index on erp_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_erp_code ON grote_inpak_cases(erp_code);

