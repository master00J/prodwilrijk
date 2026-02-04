-- Verkoopprijs per productieorderlijn (manueel of uit Excel/verkooporder)
ALTER TABLE production_order_lines
  ADD COLUMN IF NOT EXISTS sales_price DECIMAL(10, 2);

COMMENT ON COLUMN production_order_lines.sales_price IS 'Verkoopprijs per stuk voor deze lijn. Kan manueel ingevuld of uit sales_orders gehaald worden.';
