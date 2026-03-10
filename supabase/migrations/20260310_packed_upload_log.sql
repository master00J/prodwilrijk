-- Upload log voor PACKED_Y/N bestanden
-- Bijhoudt per upload: hoeveel nieuwe dag-records bijkwamen, hoeveel bijgewerkt werden, en welke kisttypes nieuw waren

CREATE TABLE IF NOT EXISTS grote_inpak_packed_upload_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_at     timestamptz NOT NULL DEFAULT NOW(),
  source_files    text,                    -- kommagescheiden bestandsnamen
  files_count     int NOT NULL DEFAULT 0,
  cnt_added       int NOT NULL DEFAULT 0,  -- nieuwe dag-records (nooit eerder gezien)
  cnt_updated     int NOT NULL DEFAULT 0,  -- bestaande dag-records bijgewerkt
  total_records   int NOT NULL DEFAULT 0,  -- totaal verwerkt
  case_types_new  text[]                   -- kisttypes die voor het eerst opduiken
);

CREATE INDEX IF NOT EXISTS idx_packed_upload_log_uploaded_at ON grote_inpak_packed_upload_log(uploaded_at DESC);
