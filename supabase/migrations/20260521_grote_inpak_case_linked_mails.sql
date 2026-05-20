-- Gekoppelde Outlook-mails per caselabel (drag-drop vanuit Overzicht)
CREATE TABLE IF NOT EXISTS grote_inpak_case_linked_mails (
  id BIGSERIAL PRIMARY KEY,
  case_label VARCHAR(255) NOT NULL REFERENCES grote_inpak_cases(case_label) ON DELETE CASCADE,
  original_filename VARCHAR(512) NOT NULL,
  content_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
  file_bytes BYTEA NOT NULL,
  subject TEXT,
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  received_at TIMESTAMPTZ,
  body_text TEXT,
  body_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_case_linked_mails_case_label
  ON grote_inpak_case_linked_mails(case_label);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_case_linked_mails_created_at
  ON grote_inpak_case_linked_mails(created_at DESC);

ALTER TABLE grote_inpak_case_linked_mails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_case_linked_mails;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_case_linked_mails
  FOR ALL USING (true) WITH CHECK (true);
