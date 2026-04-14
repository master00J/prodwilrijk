-- TV Display verbeteringen: duration per slide + nieuwe slide-types

-- Kolom voor instelbare duur per slide (seconden). NULL = standaard 15s.
ALTER TABLE tv_slides ADD COLUMN IF NOT EXISTS duration integer DEFAULT NULL;

-- Type-constraint uitbreiden met dagplanning, countdown, weer
ALTER TABLE tv_slides DROP CONSTRAINT IF EXISTS tv_slides_type_check;
ALTER TABLE tv_slides ADD CONSTRAINT tv_slides_type_check
  CHECK (type IN ('werkorders', 'tekst', 'afbeelding', 'productieorders', 'inpakstatistiek', 'dagplanning', 'countdown', 'weer'));
