-- Dashboard voor grote inpak:
-- 1. grote_inpak_kpi_history: dagelijkse KPI-snapshot per productielocatie
--    (gevuld bij elke PILS-verwerking, 1 rij per dag per locatie).
-- 2. grote_inpak_case_archive: units die van de PILS verdwijnen (= verpakt/verwerkt),
--    met doorlooptijd in dagen (PILS-aankomst -> verdwijnen van PILS).

CREATE TABLE IF NOT EXISTS grote_inpak_kpi_history (
  snapshot_date DATE NOT NULL,
  location TEXT NOT NULL,
  total_cases INTEGER NOT NULL DEFAULT 0,
  priority_cases INTEGER NOT NULL DEFAULT 0,
  overdue_cases INTEGER NOT NULL DEFAULT 0,
  overdue_1_3 INTEGER NOT NULL DEFAULT 0,
  overdue_4_7 INTEGER NOT NULL DEFAULT 0,
  overdue_8_plus INTEGER NOT NULL DEFAULT 0,
  forecast_kritiek INTEGER NOT NULL DEFAULT 0,
  avg_ligtijd_dagen NUMERIC(8,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (snapshot_date, location)
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_kpi_history_date
  ON grote_inpak_kpi_history(snapshot_date);

ALTER TABLE grote_inpak_kpi_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_kpi_history;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_kpi_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS grote_inpak_case_archive (
  id BIGSERIAL PRIMARY KEY,
  case_label TEXT NOT NULL,
  case_type TEXT,
  productielocatie TEXT,
  priority BOOLEAN NOT NULL DEFAULT FALSE,
  arrival_date DATE,
  deadline DATE,
  dagen_te_laat INTEGER,
  first_seen_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- PILS-aankomst -> van PILS verdwenen (= verpakt), in kalenderdagen
  doorlooptijd_dagen INTEGER
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_case_archive_removed_at
  ON grote_inpak_case_archive(removed_at);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_case_archive_case_label
  ON grote_inpak_case_archive(case_label);

ALTER TABLE grote_inpak_case_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_case_archive;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_case_archive
  FOR ALL
  USING (true)
  WITH CHECK (true);
