-- PILS upload log: track bijgekomen/verwijderde cases per PILS upload
CREATE TABLE IF NOT EXISTS grote_inpak_pils_upload_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_at      timestamptz NOT NULL DEFAULT NOW(),
  source_file      text,
  cnt_added        int NOT NULL DEFAULT 0,
  cnt_removed      int NOT NULL DEFAULT 0,
  total_records    int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pils_upload_log_uploaded_at ON grote_inpak_pils_upload_log(uploaded_at DESC);
