CREATE TABLE IF NOT EXISTS wms_packages (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES wms_projects(id) ON DELETE CASCADE,
  package_no TEXT NOT NULL,
  received_at DATE,
  load_in_at DATE,
  load_out_at DATE,
  storage_location TEXT,
  storage_m2 NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wms_package_lines (
  id BIGSERIAL PRIMARY KEY,
  package_id BIGINT NOT NULL REFERENCES wms_packages(id) ON DELETE CASCADE,
  line_id BIGINT NOT NULL REFERENCES wms_project_lines(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE wms_project_lines
  ADD COLUMN IF NOT EXISTS storage_m2 NUMERIC,
  ADD COLUMN IF NOT EXISTS storage_location TEXT,
  ADD COLUMN IF NOT EXISTS dimensions_confirmed BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wms_package_lines_unique ON wms_package_lines(line_id);
CREATE INDEX IF NOT EXISTS idx_wms_packages_project_id ON wms_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_wms_package_lines_package_id ON wms_package_lines(package_id);

DROP TRIGGER IF EXISTS update_wms_packages_updated_at ON wms_packages;
CREATE TRIGGER update_wms_packages_updated_at
  BEFORE UPDATE ON wms_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE wms_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_package_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON wms_packages;
CREATE POLICY "Allow all for authenticated users" ON wms_packages
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON wms_package_lines;
CREATE POLICY "Allow all for authenticated users" ON wms_package_lines
  FOR ALL
  USING (true)
  WITH CHECK (true);
