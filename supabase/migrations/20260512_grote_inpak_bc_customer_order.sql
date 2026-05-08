-- BC shop-lines Excel: Customer Order No. (typ. kolom K)
ALTER TABLE grote_inpak_cases
  ADD COLUMN IF NOT EXISTS bc_customer_order_no VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_bc_customer_order
  ON grote_inpak_cases (bc_customer_order_no)
  WHERE bc_customer_order_no IS NOT NULL;
