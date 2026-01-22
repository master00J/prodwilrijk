-- Production Orders & Material Costing
CREATE TABLE IF NOT EXISTS production_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL,
  sales_order_number TEXT,
  creation_date DATE,
  due_date DATE,
  starting_date DATE,
  source_file_name TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_orders_order_number ON production_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_production_orders_uploaded_at ON production_orders(uploaded_at DESC);

CREATE TABLE IF NOT EXISTS production_order_lines (
  id BIGSERIAL PRIMARY KEY,
  production_order_id BIGINT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  line_no INTEGER,
  item_no TEXT,
  variant_code TEXT,
  description TEXT,
  description_2 TEXT,
  quantity NUMERIC,
  inside_mass TEXT,
  outside_mass TEXT,
  item_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_order_lines_order_id ON production_order_lines(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_order_lines_item_number ON production_order_lines(item_number);

CREATE TABLE IF NOT EXISTS production_order_components (
  id BIGSERIAL PRIMARY KEY,
  production_order_line_id BIGINT NOT NULL REFERENCES production_order_lines(id) ON DELETE CASCADE,
  component_line_no TEXT,
  component_item_no TEXT,
  component_description TEXT,
  component_description_2 TEXT,
  component_length NUMERIC,
  component_width NUMERIC,
  component_thickness NUMERIC,
  component_unit NUMERIC,
  component_group TEXT,
  component_group_sortvalue NUMERIC,
  component_indentation TEXT,
  component_margin TEXT,
  fsg_group_code TEXT,
  fsg_group_description TEXT,
  fsg_unit NUMERIC,
  fsg_unit_expected NUMERIC,
  fsg_total_volume NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_order_components_line_id ON production_order_components(production_order_line_id);
CREATE INDEX IF NOT EXISTS idx_production_order_components_item_no ON production_order_components(component_item_no);

CREATE TABLE IF NOT EXISTS material_prices (
  id BIGSERIAL PRIMARY KEY,
  item_number TEXT UNIQUE NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_prices_item_number ON material_prices(item_number);

-- Row Level Security
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_order_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON production_orders;
CREATE POLICY "Allow all for authenticated users" ON production_orders
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON production_order_lines;
CREATE POLICY "Allow all for authenticated users" ON production_order_lines
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON production_order_components;
CREATE POLICY "Allow all for authenticated users" ON production_order_components
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON material_prices;
CREATE POLICY "Allow all for authenticated users" ON material_prices
  FOR ALL USING (true) WITH CHECK (true);
