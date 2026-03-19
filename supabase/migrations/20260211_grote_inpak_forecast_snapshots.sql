-- Forecast snapshot systeem: track elke upload als een snapshot
-- zodat wijzigingen per upload-sessie bekeken kunnen worden

-- 1. Snapshots tabel: één rij per upload-sessie
CREATE TABLE IF NOT EXISTS grote_inpak_forecast_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at     timestamptz NOT NULL DEFAULT NOW(),
  source_files    text[],
  total_records   int NOT NULL DEFAULT 0,
  cnt_added       int NOT NULL DEFAULT 0,
  cnt_removed     int NOT NULL DEFAULT 0,
  cnt_date_change int NOT NULL DEFAULT 0
);

-- 2. Uitbreiding van forecast_changes: change_type + snapshot_id
ALTER TABLE grote_inpak_forecast_changes
  ADD COLUMN IF NOT EXISTS change_type  varchar(20) NOT NULL DEFAULT 'date_change',
  ADD COLUMN IF NOT EXISTS snapshot_id  uuid REFERENCES grote_inpak_forecast_snapshots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_forecast_changes_snapshot ON grote_inpak_forecast_changes(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_forecast_changes_type     ON grote_inpak_forecast_changes(change_type);
