-- Zaag slijpen: leverancier haalt zagen op en brengt ze terug — tracking + foto's + handtekeningen.

CREATE TABLE IF NOT EXISTS saw_sharpening_rounds (
  id BIGSERIAL PRIMARY KEY,
  pickup_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  return_at TIMESTAMPTZ,
  driver_name TEXT,
  notes TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  signature_supplier_url TEXT,
  signature_foresco_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saw_sharpening_lines (
  id BIGSERIAL PRIMARY KEY,
  round_id BIGINT NOT NULL REFERENCES saw_sharpening_rounds(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity_pickup INT NOT NULL DEFAULT 0 CHECK (quantity_pickup >= 0),
  quantity_return INT CHECK (quantity_return IS NULL OR quantity_return >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saw_sharpening_lines_round_id ON saw_sharpening_lines(round_id);
CREATE INDEX IF NOT EXISTS idx_saw_sharpening_rounds_pickup_at ON saw_sharpening_rounds(pickup_at DESC);

CREATE OR REPLACE FUNCTION update_saw_sharpening_rounds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_saw_sharpening_rounds_updated ON saw_sharpening_rounds;
CREATE TRIGGER tr_saw_sharpening_rounds_updated
  BEFORE UPDATE ON saw_sharpening_rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_saw_sharpening_rounds_updated_at();

ALTER TABLE saw_sharpening_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE saw_sharpening_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all saw_sharpening_rounds" ON saw_sharpening_rounds;
CREATE POLICY "Allow all saw_sharpening_rounds" ON saw_sharpening_rounds
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all saw_sharpening_lines" ON saw_sharpening_lines;
CREATE POLICY "Allow all saw_sharpening_lines" ON saw_sharpening_lines
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'saw-sharpening-attachments',
  'saw-sharpening-attachments',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "saw sharpening attachments insert" ON storage.objects;
CREATE POLICY "saw sharpening attachments insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'saw-sharpening-attachments');

DROP POLICY IF EXISTS "saw sharpening attachments select auth" ON storage.objects;
CREATE POLICY "saw sharpening attachments select auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'saw-sharpening-attachments');

DROP POLICY IF EXISTS "saw sharpening attachments delete" ON storage.objects;
CREATE POLICY "saw sharpening attachments delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'saw-sharpening-attachments');

DROP POLICY IF EXISTS "saw sharpening attachments public select" ON storage.objects;
CREATE POLICY "saw sharpening attachments public select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'saw-sharpening-attachments');
