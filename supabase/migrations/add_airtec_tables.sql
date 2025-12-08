-- Airtec Tables Migration
-- This migration adds tables for the Airtec flow, similar to prepack but with additional fields

-- Incoming Goods Airtec Table
CREATE TABLE IF NOT EXISTS incoming_goods_airtec (
  id BIGSERIAL PRIMARY KEY,
  beschrijving VARCHAR(255),
  item_number VARCHAR(255),
  lot_number VARCHAR(255),
  datum_opgestuurd TIMESTAMP WITH TIME ZONE,
  kistnummer VARCHAR(3),
  divisie VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  datum_ontvangen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Confirmed Items Airtec Table
CREATE TABLE IF NOT EXISTS confirmed_items_airtec (
  id BIGSERIAL PRIMARY KEY,
  beschrijving VARCHAR(255),
  item_number VARCHAR(255),
  lot_number VARCHAR(255),
  datum_opgestuurd TIMESTAMP WITH TIME ZONE,
  kistnummer VARCHAR(3),
  divisie VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  datum_ontvangen TIMESTAMP WITH TIME ZONE NOT NULL,
  date_confirmed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  original_id BIGINT, -- Reference to incoming_goods_airtec id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items to Pack Airtec Table
CREATE TABLE IF NOT EXISTS items_to_pack_airtec (
  id BIGSERIAL PRIMARY KEY,
  beschrijving VARCHAR(255),
  item_number VARCHAR(255),
  lot_number VARCHAR(255),
  datum_opgestuurd TIMESTAMP WITH TIME ZONE,
  kistnummer VARCHAR(3),
  divisie VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  priority BOOLEAN DEFAULT FALSE,
  packed BOOLEAN DEFAULT FALSE,
  datum_ontvangen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Packed Items Airtec Table
CREATE TABLE IF NOT EXISTS packed_items_airtec (
  id BIGSERIAL PRIMARY KEY,
  beschrijving VARCHAR(255),
  item_number VARCHAR(255),
  lot_number VARCHAR(255),
  datum_opgestuurd TIMESTAMP WITH TIME ZONE,
  kistnummer VARCHAR(3),
  divisie VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  datum_ontvangen TIMESTAMP WITH TIME ZONE NOT NULL,
  date_packed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  original_id BIGINT, -- Reference to items_to_pack_airtec id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Airtec Prices Table
CREATE TABLE IF NOT EXISTS airtec_prices (
  kistnummer VARCHAR(50) PRIMARY KEY,
  erp_code VARCHAR(100),
  price DECIMAL(10,2) NOT NULL,
  assembly_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  material_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  transport_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_incoming_goods_airtec_item_number ON incoming_goods_airtec(item_number);
CREATE INDEX IF NOT EXISTS idx_incoming_goods_airtec_kistnummer ON incoming_goods_airtec(kistnummer);
CREATE INDEX IF NOT EXISTS idx_incoming_goods_airtec_datum_ontvangen ON incoming_goods_airtec(datum_ontvangen);
CREATE INDEX IF NOT EXISTS idx_confirmed_items_airtec_item_number ON confirmed_items_airtec(item_number);
CREATE INDEX IF NOT EXISTS idx_confirmed_items_airtec_kistnummer ON confirmed_items_airtec(kistnummer);
CREATE INDEX IF NOT EXISTS idx_items_to_pack_airtec_item_number ON items_to_pack_airtec(item_number);
CREATE INDEX IF NOT EXISTS idx_items_to_pack_airtec_kistnummer ON items_to_pack_airtec(kistnummer);
CREATE INDEX IF NOT EXISTS idx_items_to_pack_airtec_packed ON items_to_pack_airtec(packed);
CREATE INDEX IF NOT EXISTS idx_items_to_pack_airtec_priority ON items_to_pack_airtec(priority);
CREATE INDEX IF NOT EXISTS idx_packed_items_airtec_date_packed ON packed_items_airtec(date_packed);
CREATE INDEX IF NOT EXISTS idx_packed_items_airtec_item_number ON packed_items_airtec(item_number);
CREATE INDEX IF NOT EXISTS idx_packed_items_airtec_kistnummer ON packed_items_airtec(kistnummer);
CREATE INDEX IF NOT EXISTS idx_airtec_prices_kistnummer ON airtec_prices(kistnummer);

-- Trigger to automatically update updated_at for items_to_pack_airtec
DROP TRIGGER IF EXISTS update_items_to_pack_airtec_updated_at ON items_to_pack_airtec;
CREATE TRIGGER update_items_to_pack_airtec_updated_at 
  BEFORE UPDATE ON items_to_pack_airtec
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE incoming_goods_airtec ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_items_airtec ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_to_pack_airtec ENABLE ROW LEVEL SECURITY;
ALTER TABLE packed_items_airtec ENABLE ROW LEVEL SECURITY;
ALTER TABLE airtec_prices ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users
DROP POLICY IF EXISTS "Allow all for authenticated users" ON incoming_goods_airtec;
CREATE POLICY "Allow all for authenticated users" ON incoming_goods_airtec
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON confirmed_items_airtec;
CREATE POLICY "Allow all for authenticated users" ON confirmed_items_airtec
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON items_to_pack_airtec;
CREATE POLICY "Allow all for authenticated users" ON items_to_pack_airtec
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON packed_items_airtec;
CREATE POLICY "Allow all for authenticated users" ON packed_items_airtec
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON airtec_prices;
CREATE POLICY "Allow all for authenticated users" ON airtec_prices
  FOR ALL
  USING (true)
  WITH CHECK (true);

