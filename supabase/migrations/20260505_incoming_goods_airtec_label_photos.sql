-- Labelfoto's van de View Airtec scanner: bewaard per incoming_goods_airtec rij (meerdere scans = meerdere URLs).

ALTER TABLE incoming_goods_airtec
  ADD COLUMN IF NOT EXISTS label_scan_photo_urls TEXT[] DEFAULT '{}';

COMMENT ON COLUMN incoming_goods_airtec.label_scan_photo_urls IS
  'Publieke Supabase Storage URLs van labelscans gekoppeld aan deze regel.';

ALTER TABLE items_to_pack_airtec
  ADD COLUMN IF NOT EXISTS label_scan_photo_urls TEXT[] DEFAULT '{}';

ALTER TABLE confirmed_items_airtec
  ADD COLUMN IF NOT EXISTS label_scan_photo_urls TEXT[] DEFAULT '{}';

ALTER TABLE packed_items_airtec
  ADD COLUMN IF NOT EXISTS label_scan_photo_urls TEXT[] DEFAULT '{}';

-- Bucket (zelfde aanpak als airtec-unlisted-photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'airtec-incoming-label-photos',
  'airtec-incoming-label-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "airtec incoming label photos authenticated insert" ON storage.objects;
CREATE POLICY "airtec incoming label photos authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'airtec-incoming-label-photos');

DROP POLICY IF EXISTS "airtec incoming label photos authenticated select" ON storage.objects;
CREATE POLICY "airtec incoming label photos authenticated select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'airtec-incoming-label-photos');

DROP POLICY IF EXISTS "airtec incoming label photos authenticated delete" ON storage.objects;
CREATE POLICY "airtec incoming label photos authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'airtec-incoming-label-photos');

DROP POLICY IF EXISTS "airtec incoming label photos public select" ON storage.objects;
CREATE POLICY "airtec incoming label photos public select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'airtec-incoming-label-photos');
