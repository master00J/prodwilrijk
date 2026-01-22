ALTER TABLE material_prices
  ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'stuks';

UPDATE material_prices
SET unit_of_measure = 'stuks'
WHERE unit_of_measure IS NULL;
