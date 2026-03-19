ALTER TABLE time_logs
  ADD COLUMN IF NOT EXISTS production_order_number TEXT,
  ADD COLUMN IF NOT EXISTS production_item_number TEXT,
  ADD COLUMN IF NOT EXISTS production_step TEXT;

CREATE INDEX IF NOT EXISTS idx_time_logs_production_order
  ON time_logs(production_order_number);
CREATE INDEX IF NOT EXISTS idx_time_logs_production_item
  ON time_logs(production_item_number);
CREATE INDEX IF NOT EXISTS idx_time_logs_production_step
  ON time_logs(production_step);
