-- Measurements Table for Opmetingen
CREATE TABLE IF NOT EXISTS measurements (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES items_to_pack(id) ON DELETE CASCADE,
  packaging_method VARCHAR(255), -- Verpakkingsmethode
  dimensions VARCHAR(255), -- Afmetingen (bijv. "50x30x20 cm")
  net_weight DECIMAL(10, 2), -- Netto gewicht (in kg)
  special_instructions TEXT, -- Speciale instructies
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255), -- Optioneel: wie heeft het ingevuld
  UNIQUE(item_id) -- Eén opmeting per item
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_measurements_item_id ON measurements(item_id);
CREATE INDEX IF NOT EXISTS idx_measurements_created_at ON measurements(created_at);

-- RLS Policies
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read measurements
CREATE POLICY "Allow authenticated users to read measurements"
ON measurements
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert measurements
CREATE POLICY "Allow authenticated users to insert measurements"
ON measurements
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update measurements
CREATE POLICY "Allow authenticated users to update measurements"
ON measurements
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete measurements
CREATE POLICY "Allow authenticated users to delete measurements"
ON measurements
FOR DELETE
TO authenticated
USING (true);
