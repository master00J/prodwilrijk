CREATE TABLE IF NOT EXISTS wms_projects (
  id BIGSERIAL PRIMARY KEY,
  project_no VARCHAR(100) NOT NULL,
  machine_type TEXT,
  modality TEXT,
  production_location TEXT,
  packing_company TEXT,
  packing_company_reference TEXT,
  transport_week_contract TEXT,
  vmi_ref_no TEXT,
  vmi_employee TEXT,
  date DATE,
  measuring_location TEXT,
  measuring_date_requested DATE,
  measuring_contact_person TEXT,
  measuring_team TEXT,
  measuring_hall TEXT,
  source_file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wms_project_lines (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES wms_projects(id) ON DELETE CASCADE,
  line_type VARCHAR(30) NOT NULL DEFAULT 'machine_part',
  source_sheet TEXT,
  sort_order INTEGER,
  truck_or_container TEXT,
  outer_pack_no TEXT,
  packing_no TEXT,
  label_item_no TEXT,
  article_no TEXT,
  description TEXT,
  qty NUMERIC,
  part_of TEXT,
  length_mm NUMERIC,
  width_mm NUMERIC,
  height_mm NUMERIC,
  length_cm NUMERIC,
  width_cm NUMERIC,
  height_cm NUMERIC,
  weight_netto_kg NUMERIC,
  weight_gross_kg NUMERIC,
  weight_measured_kg NUMERIC,
  label_qty NUMERIC,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wms_projects_project_no ON wms_projects(project_no);
CREATE INDEX IF NOT EXISTS idx_wms_project_lines_project_id ON wms_project_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_wms_project_lines_status ON wms_project_lines(status);

DROP TRIGGER IF EXISTS update_wms_projects_updated_at ON wms_projects;
CREATE TRIGGER update_wms_projects_updated_at
  BEFORE UPDATE ON wms_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wms_project_lines_updated_at ON wms_project_lines;
CREATE TRIGGER update_wms_project_lines_updated_at
  BEFORE UPDATE ON wms_project_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE wms_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_project_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON wms_projects;
CREATE POLICY "Allow all for authenticated users" ON wms_projects
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON wms_project_lines;
CREATE POLICY "Allow all for authenticated users" ON wms_project_lines
  FOR ALL
  USING (true)
  WITH CHECK (true);
