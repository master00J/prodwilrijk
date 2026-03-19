-- CNH Photos Storage Bucket Migration
-- This migration creates the storage bucket for CNH container photos

-- Create the storage bucket for CNH photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cnh-photos',
  'cnh-photos',
  true, -- Public bucket so photos can be accessed via public URL
  52428800, -- 50MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow authenticated users to upload photos
DROP POLICY IF EXISTS "Allow authenticated users to upload photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cnh-photos' AND
  auth.role() = 'authenticated'
);

-- Create storage policy to allow authenticated users to read photos
DROP POLICY IF EXISTS "Allow authenticated users to read photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to read photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cnh-photos' AND
  auth.role() = 'authenticated'
);

-- Create storage policy to allow authenticated users to delete photos
DROP POLICY IF EXISTS "Allow authenticated users to delete photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cnh-photos' AND
  auth.role() = 'authenticated'
);

-- Create storage policy to allow public read access (since bucket is public)
DROP POLICY IF EXISTS "Allow public read access to photos" ON storage.objects;
CREATE POLICY "Allow public read access to photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'cnh-photos');

