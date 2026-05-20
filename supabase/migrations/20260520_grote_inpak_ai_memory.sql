-- Persistent geheugen voor de Grote Inpak AI-assistent.
-- Voor feiten die via voice/tekst worden doorgegeven en later opnieuw door de AI moeten worden gebruikt.

CREATE TABLE IF NOT EXISTS grote_inpak_ai_memory (
  id            BIGSERIAL PRIMARY KEY,
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('case_type', 'case_label', 'production_order', 'general')),
  subject_key   TEXT NOT NULL,
  memory_type   TEXT NOT NULL DEFAULT 'note',
  value         TEXT NOT NULL,
  note          TEXT,
  source        TEXT NOT NULL DEFAULT 'ai_assistant',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_ai_memory_subject
  ON grote_inpak_ai_memory (subject_type, subject_key, is_active);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_ai_memory_type
  ON grote_inpak_ai_memory (memory_type, is_active);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_ai_memory_updated
  ON grote_inpak_ai_memory (updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grote_inpak_ai_memory_active_subject_type
  ON grote_inpak_ai_memory (subject_type, subject_key, memory_type)
  WHERE is_active = TRUE;

CREATE OR REPLACE FUNCTION update_grote_inpak_ai_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grote_inpak_ai_memory_updated_at ON grote_inpak_ai_memory;
CREATE TRIGGER trg_grote_inpak_ai_memory_updated_at
  BEFORE UPDATE ON grote_inpak_ai_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_grote_inpak_ai_memory_updated_at();

ALTER TABLE grote_inpak_ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_ai_memory;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_ai_memory
  FOR ALL USING (true) WITH CHECK (true);
