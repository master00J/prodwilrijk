-- Houtsoorten & extra materialen: categorie op pricing_materials
-- Later: BC-sync vult cost_per_unit (source = 'bc')

ALTER TABLE pricing_materials
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'overig';

ALTER TABLE pricing_materials
  DROP CONSTRAINT IF EXISTS pricing_materials_category_check;

ALTER TABLE pricing_materials
  ADD CONSTRAINT pricing_materials_category_check
  CHECK (category IN ('houtsoort', 'extra', 'overig'));

CREATE INDEX IF NOT EXISTS idx_pricing_materials_category ON pricing_materials(category);

-- Houtsoorten Wilrijk (€/m³) — aanpasbaar in DB / later via BC
INSERT INTO pricing_materials (plant_id, material_code, name, unit, cost_per_unit, category, source)
SELECT p.id, v.code, v.name, 'm3', v.cost, 'houtsoort', 'manual'
FROM pricing_plants p
CROSS JOIN (VALUES
  ('SXT', 'Sexta (SXT)', 380),
  ('PEP', 'Multiplex PEP', 420),
  ('CWF', 'CWF', 350),
  ('OSB', 'OSB', 280),
  ('MPX', 'MPX', 400),
  ('NHV', 'NHV (legacy)', 340),
  ('MDF', 'MDF', 320),
  ('PLW', 'PLW', 360)
) AS v(code, name, cost)
WHERE p.code = 'WILRIJK'
ON CONFLICT (plant_id, material_code) DO UPDATE SET
  name = EXCLUDED.name,
  cost_per_unit = EXCLUDED.cost_per_unit,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit,
  updated_at = NOW();

-- Extra materialen Wilrijk — kost per eenheid (st, m, m², …)
INSERT INTO pricing_materials (plant_id, material_code, name, unit, cost_per_unit, category, source)
SELECT p.id, v.code, v.name, v.unit, v.cost, 'extra', 'manual'
FROM pricing_plants p
CROSS JOIN (VALUES
  ('EXTRA_SPIJKERS', 'Spijkers / bouten', 'st', 0.08),
  ('EXTRA_SPANBAND', 'Spanband', 'st', 0.45),
  ('EXTRA_FOLIE', 'Stretchfolie / folie', 'm', 0.12),
  ('EXTRA_ISPM15', 'ISPM15 behandeling', 'st', 1.20),
  ('EXTRA_LABEL', 'Label / markering', 'st', 0.05),
  ('EXTRA_PALLETBLOK', 'Palletblok extra', 'st', 0.35),
  ('EXTRA_LIJM', 'Lijm / coating', 'st', 0.25)
) AS v(code, name, unit, cost)
WHERE p.code = 'WILRIJK'
ON CONFLICT (plant_id, material_code) DO UPDATE SET
  name = EXCLUDED.name,
  cost_per_unit = EXCLUDED.cost_per_unit,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit,
  updated_at = NOW();

-- Zelfde houtsoorten voor Genk & Gent (startwaarden gelijk aan Wilrijk)
INSERT INTO pricing_materials (plant_id, material_code, name, unit, cost_per_unit, category, source)
SELECT p.id, m.material_code, m.name, m.unit, m.cost_per_unit, m.category, 'manual'
FROM pricing_plants p
JOIN pricing_plants w ON w.code = 'WILRIJK'
JOIN pricing_materials m ON m.plant_id = w.id AND m.category = 'houtsoort'
WHERE p.code IN ('GENK', 'GENT')
ON CONFLICT (plant_id, material_code) DO NOTHING;

INSERT INTO pricing_materials (plant_id, material_code, name, unit, cost_per_unit, category, source)
SELECT p.id, m.material_code, m.name, m.unit, m.cost_per_unit, m.category, 'manual'
FROM pricing_plants p
JOIN pricing_plants w ON w.code = 'WILRIJK'
JOIN pricing_materials m ON m.plant_id = w.id AND m.category = 'extra'
WHERE p.code IN ('GENK', 'GENT')
ON CONFLICT (plant_id, material_code) DO NOTHING;
