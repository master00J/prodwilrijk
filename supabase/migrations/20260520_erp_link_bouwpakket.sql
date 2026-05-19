-- Bouwpakket-referentie (gezaagd hout) per kist in ERP LINK
ALTER TABLE grote_inpak_erp_link
  ADD COLUMN IF NOT EXISTS bouwpakket_code VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_erp_link_bouwpakket_code
  ON grote_inpak_erp_link(bouwpakket_code)
  WHERE bouwpakket_code IS NOT NULL;
