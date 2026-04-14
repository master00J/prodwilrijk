-- Nieuw slide type: priorities (prio items uit prepack + airtec)
ALTER TABLE tv_slides DROP CONSTRAINT IF EXISTS tv_slides_type_check;
ALTER TABLE tv_slides ADD CONSTRAINT tv_slides_type_check
  CHECK (type IN ('werkorders', 'tekst', 'afbeelding', 'productieorders', 'inpakstatistiek', 'dagplanning', 'countdown', 'weer', 'priorities'));
