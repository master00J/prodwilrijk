-- Items niet in lijst: geleverd door klant maar niet in de standaardlijst.
-- Gebruikt om een overzicht naar de klant te mailen met de vraag of deze verpakt mogen worden.

CREATE TABLE IF NOT EXISTS airtec_unlisted_items (
  id BIGSERIAL PRIMARY KEY,
  beschrijving VARCHAR(500) NOT NULL,
  item_number VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  opmerking TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending | email_sent | approved | rejected
  email_sent_at TIMESTAMP WITH TIME ZONE,
  photo_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_airtec_unlisted_items_status ON airtec_unlisted_items(status);
CREATE INDEX IF NOT EXISTS idx_airtec_unlisted_items_created_at ON airtec_unlisted_items(created_at);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_airtec_unlisted_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_airtec_unlisted_items_updated_at ON airtec_unlisted_items;
CREATE TRIGGER update_airtec_unlisted_items_updated_at
  BEFORE UPDATE ON airtec_unlisted_items
  FOR EACH ROW
  EXECUTE FUNCTION update_airtec_unlisted_items_updated_at();

ALTER TABLE airtec_unlisted_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON airtec_unlisted_items;
CREATE POLICY "Allow all for authenticated users" ON airtec_unlisted_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Storage bucket voor foto's van niet-lijst items
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'airtec-unlisted-photos',
  'airtec-unlisted-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;
