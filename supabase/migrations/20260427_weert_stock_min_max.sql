ALTER TABLE weert_stock_items
ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_stock INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_weert_stock_items_min_max
ON weert_stock_items(min_stock, max_stock);
