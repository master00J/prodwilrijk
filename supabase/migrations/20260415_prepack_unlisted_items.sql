-- Items gescand via label scanner maar niet in de WMS-import lijst.
-- Categorie 'extra_pallet' = vergeten te scannen op vorige locatie.
-- Categorie 'd_nummer' = delivery notice met D-nummer (apart proces).

CREATE TABLE IF NOT EXISTS prepack_unlisted_items (
  id BIGSERIAL PRIMARY KEY,
  item_number VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  description VARCHAR(500),
  po_line VARCHAR(255),
  supplier VARCHAR(255),
  label_date VARCHAR(50),
  delivery_notice VARCHAR(255),
  category VARCHAR(50) DEFAULT 'extra_pallet', -- extra_pallet | d_nummer
  opmerking TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending | resolved
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prepack_unlisted_status ON prepack_unlisted_items(status);
CREATE INDEX IF NOT EXISTS idx_prepack_unlisted_category ON prepack_unlisted_items(category);
CREATE INDEX IF NOT EXISTS idx_prepack_unlisted_created_at ON prepack_unlisted_items(created_at);

CREATE OR REPLACE FUNCTION update_prepack_unlisted_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_prepack_unlisted_items_updated_at ON prepack_unlisted_items;
CREATE TRIGGER update_prepack_unlisted_items_updated_at
  BEFORE UPDATE ON prepack_unlisted_items
  FOR EACH ROW
  EXECUTE FUNCTION update_prepack_unlisted_items_updated_at();

ALTER TABLE prepack_unlisted_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON prepack_unlisted_items;
CREATE POLICY "Allow all for authenticated users" ON prepack_unlisted_items
  FOR ALL
  USING (true)
  WITH CHECK (true);
