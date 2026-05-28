-- Sales Prijs Calculator — masterdata & simulaties
-- Later: BC-sync voor materialen, klanten en historische prijzen (zie comments in lib/pricing-engine)

CREATE TABLE IF NOT EXISTS pricing_product_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_plants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id        UUID REFERENCES pricing_plants(id) ON DELETE SET NULL,
  material_code   TEXT NOT NULL,
  name            TEXT NOT NULL,
  unit            TEXT NOT NULL,
  cost_per_unit   NUMERIC(12, 4) NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, material_code)
);

CREATE TABLE IF NOT EXISTS pricing_operations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id        UUID REFERENCES pricing_plants(id) ON DELETE SET NULL,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  cost_per_hour   NUMERIC(12, 4) NOT NULL,
  default_minutes NUMERIC(12, 4),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, code)
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id         UUID REFERENCES pricing_plants(id) ON DELETE SET NULL,
  product_type_id  UUID NOT NULL REFERENCES pricing_product_types(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  rule_config      JSONB NOT NULL DEFAULT '{}',
  version          INTEGER NOT NULL DEFAULT 1,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_simulations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_number TEXT NOT NULL UNIQUE,
  customer_name     TEXT,
  customer_code     TEXT,
  plant_id          UUID REFERENCES pricing_plants(id) ON DELETE SET NULL,
  product_type_id   UUID REFERENCES pricing_product_types(id) ON DELETE SET NULL,
  input_data        JSONB NOT NULL,
  result_data       JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft',
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_materials_plant ON pricing_materials(plant_id);
CREATE INDEX IF NOT EXISTS idx_pricing_operations_plant ON pricing_operations(plant_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_plant_product ON pricing_rules(plant_id, product_type_id);
CREATE INDEX IF NOT EXISTS idx_pricing_simulations_created ON pricing_simulations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_simulations_plant ON pricing_simulations(plant_id);

-- Seed producttypes
INSERT INTO pricing_product_types (code, name, description) VALUES
  ('PALLET', 'Pallet', 'Houten pallet — MVP calculator actief'),
  ('CRATE', 'Kist / krat', 'Kisten en kratten'),
  ('CARTON', 'Karton', 'Kartonverpakking'),
  ('COMBI', 'Combinatie', 'Combinatieverpakking'),
  ('CUSTOM', 'Maatwerk', 'Maatwerk / custom')
ON CONFLICT (code) DO NOTHING;

-- Seed plants
INSERT INTO pricing_plants (code, name) VALUES
  ('WILRIJK', 'Wilrijk'),
  ('GENK', 'Genk'),
  ('GENT', 'Gent')
ON CONFLICT (code) DO NOTHING;

-- Standaard pallet-regel (config uitbreidbaar; berekening in code)
INSERT INTO pricing_rules (plant_id, product_type_id, name, rule_config)
SELECT p.id, pt.id, 'Pallet standaard Wilrijk', '{"calculator":"PALLET","version":1}'::jsonb
FROM pricing_plants p
CROSS JOIN pricing_product_types pt
WHERE p.code = 'WILRIJK' AND pt.code = 'PALLET'
  AND NOT EXISTS (
    SELECT 1 FROM pricing_rules r
    WHERE r.plant_id = p.id AND r.product_type_id = pt.id AND r.name = 'Pallet standaard Wilrijk'
  );
