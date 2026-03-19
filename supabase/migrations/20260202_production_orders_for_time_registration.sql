-- Orders uploaded via "Productieorder tijd" flow are the only ones shown on the time registration page.
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS for_time_registration BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_production_orders_for_time_registration
ON production_orders(for_time_registration) WHERE for_time_registration = true;

COMMENT ON COLUMN production_orders.for_time_registration IS 'True when order was uploaded via Admin > Productieorder upload (tijdregistratie). Only these orders appear on the production-order-time page.';
