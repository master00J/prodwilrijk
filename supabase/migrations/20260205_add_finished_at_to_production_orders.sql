-- Markeer productieorders als afgerond wanneer alle aantallen gemaakt zijn
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_production_orders_finished_at
  ON production_orders(finished_at) WHERE finished_at IS NOT NULL;

COMMENT ON COLUMN production_orders.finished_at IS 'Wanneer alle aantallen van alle lijnen via tijdregistratie zijn afgewerkt. Order verdwijnt dan uit de lijst op production-order-time.';
