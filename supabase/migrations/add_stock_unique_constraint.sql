-- Add unique constraint on item_number + location for grote_inpak_stock
-- This allows multiple stock entries per item (one per location)

-- First, remove any duplicate entries (keep the most recent one)
DELETE FROM grote_inpak_stock a
USING grote_inpak_stock b
WHERE a.id < b.id
  AND a.item_number = b.item_number
  AND COALESCE(a.location, '') = COALESCE(b.location, '');

-- Add unique constraint
ALTER TABLE grote_inpak_stock
ADD CONSTRAINT unique_item_location UNIQUE (item_number, location);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_grote_inpak_stock_location ON grote_inpak_stock(location);

