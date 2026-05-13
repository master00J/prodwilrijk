-- Concept/review imports for PACKED, PACKED_N and PACKED_Y mailbox files.
CREATE TABLE IF NOT EXISTS grote_inpak_packed_import_batches (
  id BIGSERIAL PRIMARY KEY,
  source_file VARCHAR(255) NOT NULL,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('packed', 'packed_n', 'packed_y')),
  mail_message_id TEXT,
  mail_date TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'exported', 'error')),
  error_message TEXT,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  exported_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS grote_inpak_packed_import_rows (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES grote_inpak_packed_import_batches(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL DEFAULT 0,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('packed', 'packed_n', 'packed_y')),
  case_label VARCHAR(255) NOT NULL,
  series VARCHAR(100),
  case_type VARCHAR(100) NOT NULL,
  packed_date DATE NOT NULL,
  excluded BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_packed_import_batches_status
  ON grote_inpak_packed_import_batches (status);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_packed_import_batches_imported_at
  ON grote_inpak_packed_import_batches (imported_at DESC);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_packed_import_rows_batch_id
  ON grote_inpak_packed_import_rows (batch_id);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_packed_import_rows_case_label
  ON grote_inpak_packed_import_rows (case_label);

ALTER TABLE grote_inpak_packed_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE grote_inpak_packed_import_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_packed_import_batches;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_packed_import_batches
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_packed_import_rows;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_packed_import_rows
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_grote_inpak_packed_import_rows_updated_at ON grote_inpak_packed_import_rows;
CREATE TRIGGER update_grote_inpak_packed_import_rows_updated_at
  BEFORE UPDATE ON grote_inpak_packed_import_rows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
