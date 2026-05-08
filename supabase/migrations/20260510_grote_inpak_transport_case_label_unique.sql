-- process/route.ts: upsert transport met onConflict 'case_label' vereist UNIQUE op die kolom.
-- Oorspronkelijke migratie had alleen een niet-unieke index.

DELETE FROM grote_inpak_transport AS a
  USING grote_inpak_transport AS b
WHERE a.case_label = b.case_label
  AND a.id > b.id;

ALTER TABLE grote_inpak_transport
  DROP CONSTRAINT IF EXISTS grote_inpak_transport_case_label_key;

ALTER TABLE grote_inpak_transport
  ADD CONSTRAINT grote_inpak_transport_case_label_key UNIQUE (case_label);
