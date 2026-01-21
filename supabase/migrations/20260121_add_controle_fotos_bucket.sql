-- Controle fotos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'controle-fotos',
  'controle-fotos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated users to upload controle fotos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload controle fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'controle-fotos' AND
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Allow authenticated users to read controle fotos" ON storage.objects;
CREATE POLICY "Allow authenticated users to read controle fotos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'controle-fotos' AND
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Allow authenticated users to delete controle fotos" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete controle fotos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'controle-fotos' AND
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Allow public read access to controle fotos" ON storage.objects;
CREATE POLICY "Allow public read access to controle fotos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'controle-fotos');
