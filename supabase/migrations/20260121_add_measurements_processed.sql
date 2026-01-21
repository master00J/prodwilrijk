-- Add processed flag for measurements
ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;
