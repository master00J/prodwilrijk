-- BC Excel-kolom "Document No." (verkooporder, bv. SO26BE-03109) voor klantportaal / lookup
ALTER TABLE grote_inpak_cases
  ADD COLUMN IF NOT EXISTS bc_sales_order_no VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_bc_sales_order
  ON grote_inpak_cases (bc_sales_order_no)
  WHERE bc_sales_order_no IS NOT NULL;
