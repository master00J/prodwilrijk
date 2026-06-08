-- Kisttype naast caselabel in upload historiek (bijgekomen / afgegaan)

ALTER TABLE grote_inpak_pils_upload_log
  ADD COLUMN IF NOT EXISTS labels_added_detail   jsonb,
  ADD COLUMN IF NOT EXISTS labels_removed_detail jsonb;

ALTER TABLE grote_inpak_forecast_snapshots
  ADD COLUMN IF NOT EXISTS labels_added_detail   jsonb,
  ADD COLUMN IF NOT EXISTS labels_removed_detail jsonb;

ALTER TABLE grote_inpak_packed_upload_log
  ADD COLUMN IF NOT EXISTS labels_added_detail   jsonb,
  ADD COLUMN IF NOT EXISTS labels_removed_detail jsonb;

ALTER TABLE grote_inpak_kist_mail_upload_log
  ADD COLUMN IF NOT EXISTS case_labels_detail jsonb;
