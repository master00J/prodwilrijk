-- Voeg 'productieorders' toe als geldig slide type
ALTER TABLE tv_slides DROP CONSTRAINT IF EXISTS tv_slides_type_check;
ALTER TABLE tv_slides ADD CONSTRAINT tv_slides_type_check
  CHECK (type IN ('werkorders', 'tekst', 'afbeelding', 'productieorders'));
