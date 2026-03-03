-- Add stapel to grote_inpak_erp_link (used by ERP link beheer and transport planning)
ALTER TABLE grote_inpak_erp_link
  ADD COLUMN IF NOT EXISTS stapel INTEGER NOT NULL DEFAULT 1;
