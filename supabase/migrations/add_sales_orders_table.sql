-- Sales Orders Table (for storing prices from verkooporder Excel)
CREATE TABLE IF NOT EXISTS sales_orders (
  id BIGSERIAL PRIMARY KEY,
  item_number VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  -- Note: No unique constraint to allow multiple uploads per day
  -- The get_latest_price function will always return the most recent price
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sales_orders_item_number ON sales_orders(item_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_uploaded_at ON sales_orders(uploaded_at DESC);

-- Function to get the latest price for an item
CREATE OR REPLACE FUNCTION get_latest_price(p_item_number VARCHAR)
RETURNS DECIMAL(10, 2) AS $$
  SELECT price
  FROM sales_orders
  WHERE item_number = p_item_number
  ORDER BY uploaded_at DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Row Level Security
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users
DROP POLICY IF EXISTS "Allow all for authenticated users" ON sales_orders;
CREATE POLICY "Allow all for authenticated users" ON sales_orders
  FOR ALL
  USING (true)
  WITH CHECK (true);
