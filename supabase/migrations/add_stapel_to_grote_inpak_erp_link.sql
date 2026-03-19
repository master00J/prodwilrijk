-- Add stapel to ERP LINK table

ALTER TABLE grote_inpak_erp_link
  ADD COLUMN IF NOT EXISTS stapel INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_grote_inpak_erp_link_stapel
  ON grote_inpak_erp_link(stapel);
