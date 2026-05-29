-- Plaatmateriaal-categorie voor kist/karton calculators (CRATE, CARTON)

ALTER TABLE pricing_materials
  DROP CONSTRAINT IF EXISTS pricing_materials_category_check;

ALTER TABLE pricing_materials
  ADD CONSTRAINT pricing_materials_category_check
  CHECK (category IN ('houtsoort', 'extra', 'overig', 'plaat'));

INSERT INTO pricing_materials (plant_id, material_code, name, unit, cost_per_unit, category, source)
SELECT p.id, v.code, v.name, v.unit, v.cost, 'plaat', 'manual'
FROM pricing_plants p
CROSS JOIN (VALUES
  ('PLAAT_MDF12', 'MDF 12mm', 'm2', 18.50),
  ('PLAAT_MDF18', 'MDF 18mm', 'm2', 24.00),
  ('PLAAT_MP15', 'Multiplex 15mm', 'm2', 32.00),
  ('PLAAT_KARTON', 'Karton golfplaat', 'm2', 4.20),
  ('PLAAT_FOAM', 'Foam PE (kg)', 'kg', 12.00)
) AS v(code, name, unit, cost)
WHERE p.code = 'WILRIJK'
ON CONFLICT (plant_id, material_code) DO UPDATE SET
  name = EXCLUDED.name,
  cost_per_unit = EXCLUDED.cost_per_unit,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit,
  updated_at = NOW();

INSERT INTO pricing_materials (plant_id, material_code, name, unit, cost_per_unit, category, source)
SELECT p.id, m.material_code, m.name, m.unit, m.cost_per_unit, m.category, 'manual'
FROM pricing_plants p
JOIN pricing_plants w ON w.code = 'WILRIJK'
JOIN pricing_materials m ON m.plant_id = w.id AND m.category = 'plaat'
WHERE p.code IN ('GENK', 'GENT')
ON CONFLICT (plant_id, material_code) DO NOTHING;
