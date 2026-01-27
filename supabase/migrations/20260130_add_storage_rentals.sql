CREATE TABLE IF NOT EXISTS storage_rental_customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage_rental_locations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  capacity_m2 NUMERIC,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage_rental_items (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES storage_rental_customers(id) ON DELETE SET NULL,
  location_id BIGINT REFERENCES storage_rental_locations(id) ON DELETE SET NULL,
  description TEXT,
  m2 NUMERIC,
  start_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_rental_items_customer_id ON storage_rental_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_storage_rental_items_location_id ON storage_rental_items(location_id);
CREATE INDEX IF NOT EXISTS idx_storage_rental_items_active ON storage_rental_items(active);

DROP TRIGGER IF EXISTS update_storage_rental_customers_updated_at ON storage_rental_customers;
CREATE TRIGGER update_storage_rental_customers_updated_at
  BEFORE UPDATE ON storage_rental_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_storage_rental_locations_updated_at ON storage_rental_locations;
CREATE TRIGGER update_storage_rental_locations_updated_at
  BEFORE UPDATE ON storage_rental_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_storage_rental_items_updated_at ON storage_rental_items;
CREATE TRIGGER update_storage_rental_items_updated_at
  BEFORE UPDATE ON storage_rental_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE storage_rental_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_rental_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_rental_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON storage_rental_customers;
CREATE POLICY "Allow all for authenticated users" ON storage_rental_customers
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON storage_rental_locations;
CREATE POLICY "Allow all for authenticated users" ON storage_rental_locations
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON storage_rental_items;
CREATE POLICY "Allow all for authenticated users" ON storage_rental_items
  FOR ALL
  USING (true)
  WITH CHECK (true);
