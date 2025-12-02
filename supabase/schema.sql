-- Incoming Goods Table (temporary storage before confirmation)
CREATE TABLE IF NOT EXISTS incoming_goods (
  id BIGSERIAL PRIMARY KEY,
  item_number VARCHAR(255) NOT NULL,
  po_number VARCHAR(255) NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items to Pack Table
CREATE TABLE IF NOT EXISTS items_to_pack (
  id BIGSERIAL PRIMARY KEY,
  item_number VARCHAR(255) NOT NULL,
  po_number VARCHAR(255) NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  priority BOOLEAN DEFAULT FALSE,
  measurement BOOLEAN DEFAULT FALSE,
  packed BOOLEAN DEFAULT FALSE,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Packed Items Table (for history)
CREATE TABLE IF NOT EXISTS packed_items (
  id BIGSERIAL PRIMARY KEY,
  item_number VARCHAR(255) NOT NULL,
  po_number VARCHAR(255) NOT NULL,
  amount INTEGER NOT NULL,
  date_added TIMESTAMP WITH TIME ZONE NOT NULL,
  date_packed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  original_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Returned Items Table (items that are returned/damaged)
CREATE TABLE IF NOT EXISTS returned_items (
  id BIGSERIAL PRIMARY KEY,
  item_number VARCHAR(255) NOT NULL,
  po_number VARCHAR(255) NOT NULL,
  amount INTEGER NOT NULL,
  date_added TIMESTAMP WITH TIME ZONE NOT NULL,
  date_returned TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,
  original_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Item Images Table (multiple images per item)
CREATE TABLE IF NOT EXISTS item_images (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL,
  item_type VARCHAR(50) NOT NULL, -- 'items_to_pack', 'returned_items', etc.
  image_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_incoming_goods_item_number ON incoming_goods(item_number);
CREATE INDEX IF NOT EXISTS idx_incoming_goods_po_number ON incoming_goods(po_number);
CREATE INDEX IF NOT EXISTS idx_incoming_goods_date_added ON incoming_goods(date_added);
CREATE INDEX IF NOT EXISTS idx_items_to_pack_item_number ON items_to_pack(item_number);
CREATE INDEX IF NOT EXISTS idx_items_to_pack_po_number ON items_to_pack(po_number);
CREATE INDEX IF NOT EXISTS idx_items_to_pack_date_added ON items_to_pack(date_added);
CREATE INDEX IF NOT EXISTS idx_items_to_pack_packed ON items_to_pack(packed);
CREATE INDEX IF NOT EXISTS idx_items_to_pack_priority ON items_to_pack(priority);
CREATE INDEX IF NOT EXISTS idx_packed_items_date_packed ON packed_items(date_packed);
CREATE INDEX IF NOT EXISTS idx_packed_items_item_number ON packed_items(item_number);
CREATE INDEX IF NOT EXISTS idx_returned_items_date_returned ON returned_items(date_returned);
CREATE INDEX IF NOT EXISTS idx_returned_items_item_number ON returned_items(item_number);
CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON item_images(item_id);
CREATE INDEX IF NOT EXISTS idx_item_images_item_type ON item_images(item_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_items_to_pack_updated_at ON items_to_pack;
CREATE TRIGGER update_items_to_pack_updated_at 
  BEFORE UPDATE ON items_to_pack
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE incoming_goods ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_to_pack ENABLE ROW LEVEL SECURITY;
ALTER TABLE packed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE returned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users (adjust as needed)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON incoming_goods;
CREATE POLICY "Allow all for authenticated users" ON incoming_goods
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON items_to_pack;
CREATE POLICY "Allow all for authenticated users" ON items_to_pack
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON packed_items;
CREATE POLICY "Allow all for authenticated users" ON packed_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON returned_items;
CREATE POLICY "Allow all for authenticated users" ON returned_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON item_images;
CREATE POLICY "Allow all for authenticated users" ON item_images
  FOR ALL
  USING (true)
  WITH CHECK (true);

