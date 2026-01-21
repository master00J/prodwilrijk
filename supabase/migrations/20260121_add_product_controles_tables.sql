-- Product controles & checklist templates
CREATE TABLE IF NOT EXISTS checklist_templates (
  id BIGSERIAL PRIMARY KEY,
  naam VARCHAR(255) NOT NULL,
  afdeling VARCHAR(255),
  beschrijving TEXT,
  is_actief BOOLEAN NOT NULL DEFAULT TRUE,
  aangemaakt_op TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  laatst_gewijzigd_op TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checklist_template_items (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  item_beschrijving TEXT NOT NULL,
  item_type VARCHAR(50) DEFAULT 'ok/niet ok/n.v.t.',
  volgorde INTEGER DEFAULT 0,
  is_verplicht BOOLEAN DEFAULT FALSE,
  hulptekst TEXT
);

CREATE TABLE IF NOT EXISTS product_controles (
  id BIGSERIAL PRIMARY KEY,
  product_naam TEXT NOT NULL,
  order_nummer TEXT,
  uitgevoerd_door TEXT NOT NULL,
  gecontroleerde_persoon TEXT NOT NULL,
  afdeling TEXT,
  algemene_opmerkingen TEXT,
  status TEXT NOT NULL DEFAULT 'in behandeling',
  checklist_template_id BIGINT REFERENCES checklist_templates(id) ON DELETE SET NULL,
  controle_datum TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS controle_checklist_items (
  id BIGSERIAL PRIMARY KEY,
  controle_id BIGINT NOT NULL REFERENCES product_controles(id) ON DELETE CASCADE,
  template_item_id BIGINT REFERENCES checklist_template_items(id) ON DELETE SET NULL,
  item_beschrijving TEXT NOT NULL,
  antwoord_waarde TEXT,
  opmerking_bij_antwoord TEXT
);

CREATE TABLE IF NOT EXISTS controle_fotos (
  id BIGSERIAL PRIMARY KEY,
  controle_id BIGINT NOT NULL REFERENCES product_controles(id) ON DELETE CASCADE,
  bestandsnaam TEXT NOT NULL,
  image_url TEXT,
  upload_datum TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_afdeling ON checklist_templates(afdeling);
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template ON checklist_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_product_controles_datum ON product_controles(controle_datum);
CREATE INDEX IF NOT EXISTS idx_product_controles_status ON product_controles(status);
CREATE INDEX IF NOT EXISTS idx_product_controles_template ON product_controles(checklist_template_id);
CREATE INDEX IF NOT EXISTS idx_controle_items_controle ON controle_checklist_items(controle_id);
CREATE INDEX IF NOT EXISTS idx_controle_fotos_controle ON controle_fotos(controle_id);

-- RLS
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_controles ENABLE ROW LEVEL SECURITY;
ALTER TABLE controle_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE controle_fotos ENABLE ROW LEVEL SECURITY;

-- Policies (authenticated users)
DROP POLICY IF EXISTS "Allow authenticated read checklist templates" ON checklist_templates;
CREATE POLICY "Allow authenticated read checklist templates"
ON checklist_templates
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated read checklist template items" ON checklist_template_items;
CREATE POLICY "Allow authenticated read checklist template items"
ON checklist_template_items
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated read product controles" ON product_controles;
CREATE POLICY "Allow authenticated read product controles"
ON product_controles
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert product controles" ON product_controles;
CREATE POLICY "Allow authenticated insert product controles"
ON product_controles
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update product controles" ON product_controles;
CREATE POLICY "Allow authenticated update product controles"
ON product_controles
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read controle checklist items" ON controle_checklist_items;
CREATE POLICY "Allow authenticated read controle checklist items"
ON controle_checklist_items
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert controle checklist items" ON controle_checklist_items;
CREATE POLICY "Allow authenticated insert controle checklist items"
ON controle_checklist_items
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read controle fotos" ON controle_fotos;
CREATE POLICY "Allow authenticated read controle fotos"
ON controle_fotos
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert controle fotos" ON controle_fotos;
CREATE POLICY "Allow authenticated insert controle fotos"
ON controle_fotos
FOR INSERT
TO authenticated
WITH CHECK (true);
