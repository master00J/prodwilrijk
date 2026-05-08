-- PILS: serial number (kolom F) + Atlas Planner e-mail (kolom H) + sleutel voor BC shop order (laatste 6 cijfers)
ALTER TABLE grote_inpak_cases
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(128),
  ADD COLUMN IF NOT EXISTS atlas_planner_email VARCHAR(512),
  ADD COLUMN IF NOT EXISTS pils_shop_order_key VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_pils_shop_key
  ON grote_inpak_cases(pils_shop_order_key)
  WHERE pils_shop_order_key IS NOT NULL;
