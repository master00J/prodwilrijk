ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10, 2);

COMMENT ON COLUMN sales_orders.unit_cost IS 'Unit Cost (LCY) uit BC Sales Lines kolom V; gebruikt als fallback materiaalkost per stuk voor Prepack.';
