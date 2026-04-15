-- TV Screens: elk fysiek toestel krijgt een slug
CREATE TABLE IF NOT EXISTS tv_screens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tv_screens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for tv_screens" ON tv_screens FOR ALL USING (true) WITH CHECK (true);

-- Many-to-many koppeling slides <-> schermen
CREATE TABLE IF NOT EXISTS tv_screen_slides (
  screen_id UUID NOT NULL REFERENCES tv_screens(id) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES tv_slides(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (screen_id, slide_id)
);

ALTER TABLE tv_screen_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for tv_screen_slides" ON tv_screen_slides FOR ALL USING (true) WITH CHECK (true);

-- Transportplanning entries
CREATE TABLE IF NOT EXISTS tv_transport_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transport_date DATE NOT NULL,
  transport_type VARCHAR(50) NOT NULL DEFAULT 'eigen',
  destination VARCHAR(255),
  description TEXT,
  transporter_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tv_transport_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for tv_transport_entries" ON tv_transport_entries
  FOR ALL USING (true) WITH CHECK (true);

-- Slide type uitbreiden met transportplanning
ALTER TABLE tv_slides DROP CONSTRAINT IF EXISTS tv_slides_type_check;
ALTER TABLE tv_slides ADD CONSTRAINT tv_slides_type_check
  CHECK (type IN ('werkorders','tekst','afbeelding','productieorders',
    'inpakstatistiek','dagplanning','countdown','weer','priorities','transportplanning'));
