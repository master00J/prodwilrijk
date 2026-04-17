-- CNH: koppel laadsessies aan templates zodat we achteraf kunnen zien
-- welke template er gebruikt is, en maak template-namen uniek.

-- Voeg template_id kolom toe aan cnh_sessions (nullable, oude sessies hebben geen template)
ALTER TABLE cnh_sessions
  ADD COLUMN IF NOT EXISTS template_id BIGINT NULL REFERENCES cnh_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cnh_sessions_template_id ON cnh_sessions(template_id);

-- Zorg dat template-namen uniek zijn zodat bureau duidelijke namen kan afdwingen.
-- We gebruiken een unique constraint op lower(name) om case-insensitieve duplicaten te vermijden.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cnh_templates_name_unique
  ON cnh_templates (lower(name));
