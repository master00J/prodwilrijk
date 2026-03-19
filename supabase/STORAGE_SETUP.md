# Supabase Storage Setup

## Storage Bucket voor Item Images

Om foto's te kunnen uploaden, moet je een Storage bucket aanmaken in Supabase:

1. Ga naar je Supabase Dashboard
2. Navigeer naar **Storage** in het menu
3. Klik op **New bucket**
4. Configureer de bucket:
   - **Name**: `item-images`
   - **Public bucket**: ✅ Ja (aanvinken)
   - **File size limit**: 10 MB (of naar wens)
   - **Allowed MIME types**: `image/*` (of specifiek: `image/jpeg,image/png,image/gif,image/webp`)

5. Klik op **Create bucket**

## Storage Policies

Na het aanmaken van de bucket, moet je policies instellen:

1. Ga naar **Storage** → **Policies** → `item-images`
2. Voeg een policy toe voor **INSERT**:
   - Policy name: `Allow authenticated uploads`
   - Allowed operation: `INSERT`
   - Policy definition:
   ```sql
   (bucket_id = 'item-images'::text)
   ```

3. Voeg een policy toe voor **SELECT**:
   - Policy name: `Allow public reads`
   - Allowed operation: `SELECT`
   - Policy definition:
   ```sql
   (bucket_id = 'item-images'::text)
   ```

Of gebruik deze SQL in de SQL Editor:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'item-images');

-- Allow public reads
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'item-images');
```





