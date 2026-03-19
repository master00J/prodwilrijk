-- Add special_instructions column to measurements table
ALTER TABLE measurements 
ADD COLUMN IF NOT EXISTS special_instructions TEXT;
