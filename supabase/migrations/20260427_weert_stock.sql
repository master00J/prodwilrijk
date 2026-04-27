CREATE TABLE IF NOT EXISTS weert_customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weert_stock_items (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES weert_customers(id) ON DELETE SET NULL,
  item_code TEXT,
  description TEXT NOT NULL,
  pallet_or_package TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'stuks',
  location TEXT,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'reserved', 'shipped', 'damaged')),
  received_at DATE,
  last_counted_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weert_stock_items_customer ON weert_stock_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_weert_stock_items_status ON weert_stock_items(status);
CREATE INDEX IF NOT EXISTS idx_weert_stock_items_location ON weert_stock_items(location);
CREATE INDEX IF NOT EXISTS idx_weert_stock_items_item_code ON weert_stock_items(item_code);
