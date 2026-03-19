CREATE TABLE IF NOT EXISTS wms_storage_locations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  capacity_m2 NUMERIC,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wms_storage_locations_name ON wms_storage_locations(name);
CREATE INDEX IF NOT EXISTS idx_wms_storage_locations_active ON wms_storage_locations(active);

DROP TRIGGER IF EXISTS update_wms_storage_locations_updated_at ON wms_storage_locations;
CREATE TRIGGER update_wms_storage_locations_updated_at
  BEFORE UPDATE ON wms_storage_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE wms_storage_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON wms_storage_locations;
CREATE POLICY "Allow all for authenticated users" ON wms_storage_locations
  FOR ALL
  USING (true)
  WITH CHECK (true);
