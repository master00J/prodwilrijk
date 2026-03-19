-- Opslag-verhuur: OR-nummer, omschrijving klant, Foresco ID, Bare/Verpakt status, m² bare/verpakt, foto's
ALTER TABLE storage_rental_items ADD COLUMN IF NOT EXISTS or_number TEXT;
ALTER TABLE storage_rental_items ADD COLUMN IF NOT EXISTS customer_description TEXT;
ALTER TABLE storage_rental_items ADD COLUMN IF NOT EXISTS foresco_id TEXT;
ALTER TABLE storage_rental_items ADD COLUMN IF NOT EXISTS packing_status TEXT DEFAULT 'bare';
ALTER TABLE storage_rental_items ADD COLUMN IF NOT EXISTS m2_bare NUMERIC;
ALTER TABLE storage_rental_items ADD COLUMN IF NOT EXISTS m2_verpakt NUMERIC;
ALTER TABLE storage_rental_items ADD COLUMN IF NOT EXISTS photos_bare JSONB DEFAULT '[]';
ALTER TABLE storage_rental_items ADD COLUMN IF NOT EXISTS photos_verpakt JSONB DEFAULT '[]';

-- Migreer bestaande m2 naar m2_bare en m2_verpakt
UPDATE storage_rental_items
SET m2_bare = COALESCE(m2_bare, m2),
    m2_verpakt = COALESCE(m2_verpakt, m2)
WHERE m2 IS NOT NULL AND (m2_bare IS NULL OR m2_verpakt IS NULL);

-- Constraint voor packing_status
ALTER TABLE storage_rental_items
  DROP CONSTRAINT IF EXISTS storage_rental_items_packing_status_check;
ALTER TABLE storage_rental_items
  ADD CONSTRAINT storage_rental_items_packing_status_check
  CHECK (packing_status IS NULL OR packing_status IN ('bare', 'verpakt'));

CREATE INDEX IF NOT EXISTS idx_storage_rental_items_or_number ON storage_rental_items(or_number);
COMMENT ON COLUMN storage_rental_items.or_number IS 'Ordernummer (OR-nummer)';
COMMENT ON COLUMN storage_rental_items.customer_description IS 'Omschrijving van de klant';
COMMENT ON COLUMN storage_rental_items.foresco_id IS 'Foresco ID';
COMMENT ON COLUMN storage_rental_items.packing_status IS 'bare = bij lossing, verpakt = na verpakken';
COMMENT ON COLUMN storage_rental_items.m2_bare IS 'm² bij binnenkomst (bare afmeting)';
COMMENT ON COLUMN storage_rental_items.m2_verpakt IS 'm² na verpakken (voor transport/facturatie)';
COMMENT ON COLUMN storage_rental_items.photos_bare IS 'Foto URLs bij lossing (bare)';
COMMENT ON COLUMN storage_rental_items.photos_verpakt IS 'Foto URLs na verpakken';

-- Storage bucket voor opslag-verhuur foto's
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'opslag-verhuur-photos',
  'opslag-verhuur-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "opslag-verhuur photos insert" ON storage.objects;
CREATE POLICY "opslag-verhuur photos insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'opslag-verhuur-photos');

DROP POLICY IF EXISTS "opslag-verhuur photos select" ON storage.objects;
CREATE POLICY "opslag-verhuur photos select" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'opslag-verhuur-photos');

DROP POLICY IF EXISTS "opslag-verhuur photos delete" ON storage.objects;
CREATE POLICY "opslag-verhuur photos delete" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'opslag-verhuur-photos');
