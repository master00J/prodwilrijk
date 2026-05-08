-- BC shop/order export (Excel): koppelen aan PILS cases via pils_shop_order_key (laatste 6 cijfers)
ALTER TABLE grote_inpak_cases
  ADD COLUMN IF NOT EXISTS bc_fp_item_no VARCHAR(64),
  ADD COLUMN IF NOT EXISTS bc_shop_order_no VARCHAR(128),
  ADD COLUMN IF NOT EXISTS bc_line_description TEXT,
  ADD COLUMN IF NOT EXISTS bc_shop_lines_source_file VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bc_shop_lines_matched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_bc_fp
  ON grote_inpak_cases(bc_fp_item_no)
  WHERE bc_fp_item_no IS NOT NULL;
