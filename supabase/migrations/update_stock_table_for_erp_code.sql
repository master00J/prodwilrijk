-- Update grote_inpak_stock table to make item_number optional and use erp_code as primary identifier
-- Stock files: Kolom A = ERP code, Kolom C = quantity, Locatie uit bestandsnaam

-- Make item_number nullable (stock files don't have item_number, only ERP code)
ALTER TABLE grote_inpak_stock 
  ALTER COLUMN item_number DROP NOT NULL;

-- Add unique constraint on erp_code + location (if not exists)
-- First, remove duplicates
DELETE FROM grote_inpak_stock a
USING grote_inpak_stock b
WHERE a.id < b.id
  AND COALESCE(a.erp_code, '') = COALESCE(b.erp_code, '')
  AND COALESCE(a.location, '') = COALESCE(b.location, '');

-- Drop old unique constraint if exists
ALTER TABLE grote_inpak_stock
  DROP CONSTRAINT IF EXISTS grote_inpak_stock_item_number_location_key;

-- Add new unique constraint on erp_code + location
ALTER TABLE grote_inpak_stock
  ADD CONSTRAINT grote_inpak_stock_erp_code_location_key UNIQUE (erp_code, location);

-- Add index on erp_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_grote_inpak_stock_erp_code ON grote_inpak_stock(erp_code);

