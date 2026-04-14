-- TV Slides tabel voor live productiehal display
CREATE TABLE IF NOT EXISTS tv_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('werkorders', 'tekst', 'afbeelding')),
  title text,
  content jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE tv_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for tv_slides" ON tv_slides FOR ALL USING (true) WITH CHECK (true);

-- Realtime inschakelen
ALTER PUBLICATION supabase_realtime ADD TABLE tv_slides;
