-- Add CNH session photos table (multiple photos per session)
CREATE TABLE IF NOT EXISTS cnh_session_photos (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES cnh_sessions(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cnh_session_photos_session_id ON cnh_session_photos(session_id);

ALTER TABLE cnh_session_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON cnh_session_photos;
CREATE POLICY "Allow all for authenticated users" ON cnh_session_photos
  FOR ALL
  USING (true)
  WITH CHECK (true);
