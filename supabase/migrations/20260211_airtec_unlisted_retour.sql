-- Retour-logging voor items niet in lijst (klant wil niet verpakken / retour)
ALTER TABLE airtec_unlisted_items
  ADD COLUMN IF NOT EXISTS retour_datum TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS retour_opmerking TEXT;
