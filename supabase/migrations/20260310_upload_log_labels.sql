-- Voeg exacte caselabellijsten toe aan alle upload logs
-- zodat je per upload exact kan zien welke caselabels zijn bijgekomen of afgegaan

-- PILS upload log: labels als array
ALTER TABLE grote_inpak_pils_upload_log
  ADD COLUMN IF NOT EXISTS labels_added   text[],
  ADD COLUMN IF NOT EXISTS labels_removed text[];

-- Forecast snapshots: labels als array
ALTER TABLE grote_inpak_forecast_snapshots
  ADD COLUMN IF NOT EXISTS labels_added   text[],  -- case_labels nieuw in deze upload
  ADD COLUMN IF NOT EXISTS labels_removed text[];  -- case_labels verwijderd tov vorige upload

-- Packed upload log: caselabels (PCCANO) als array
ALTER TABLE grote_inpak_packed_upload_log
  ADD COLUMN IF NOT EXISTS labels_added   text[],  -- PCCANO's die voor het eerst opduiken
  ADD COLUMN IF NOT EXISTS labels_removed text[];  -- PCCANO's die niet meer voorkomen tov vorige upload

-- Tabel om alle bekende caselabels (PCCANO) bij te houden per kisttype
-- Wordt gebruikt om te vergelijken bij elke packed upload
CREATE TABLE IF NOT EXISTS grote_inpak_packed_labels (
  case_label  varchar(50) PRIMARY KEY,
  case_type   varchar(20) NOT NULL,
  last_seen   date,
  created_at  timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packed_labels_case_type ON grote_inpak_packed_labels(case_type);
