-- Fix grote_inpak schema: Add missing columns and constraints
-- Run this migration to fix transport and stock issues

-- 1. Add erp_code and stapel to grote_inpak_cases (if not exists)
ALTER TABLE grote_inpak_cases
  ADD COLUMN IF NOT EXISTS erp_code VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stapel INTEGER DEFAULT 1;

-- Add index on erp_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_erp_code ON grote_inpak_cases(erp_code);

-- 2. Make item_number nullable in grote_inpak_stock (if NOT NULL constraint exists)
-- First check if column exists and has NOT NULL constraint
DO $$ 
BEGIN
    -- Check if item_number column has NOT NULL constraint
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'grote_inpak_stock' 
        AND column_name = 'item_number'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE grote_inpak_stock 
          ALTER COLUMN item_number DROP NOT NULL;
    END IF;
END $$;

-- 3. Ensure unique constraint on erp_code + location exists
-- First, remove any duplicates
DELETE FROM grote_inpak_stock a
USING grote_inpak_stock b
WHERE a.id < b.id
  AND COALESCE(a.erp_code, '') = COALESCE(b.erp_code, '')
  AND COALESCE(a.location, '') = COALESCE(b.location, '');

-- Drop old unique constraints if exists (on item_number + location)
ALTER TABLE grote_inpak_stock
  DROP CONSTRAINT IF EXISTS grote_inpak_stock_item_number_location_key,
  DROP CONSTRAINT IF EXISTS unique_item_location;

-- Add unique constraint on erp_code + location (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'grote_inpak_stock_erp_code_location_key'
    ) THEN
        ALTER TABLE grote_inpak_stock
          ADD CONSTRAINT grote_inpak_stock_erp_code_location_key UNIQUE (erp_code, location);
    END IF;
END $$;

-- Add index on erp_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_grote_inpak_stock_erp_code ON grote_inpak_stock(erp_code);

-- 4. Add bestemming column to grote_inpak_transport if it doesn't exist
ALTER TABLE grote_inpak_transport
  ADD COLUMN IF NOT EXISTS bestemming VARCHAR(255) DEFAULT 'Willebroek';

