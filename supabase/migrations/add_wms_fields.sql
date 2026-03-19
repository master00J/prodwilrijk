-- Migration: Add WMS fields to items_to_pack table
-- Run this if the table already exists and you need to add the new columns

-- Add wms_line_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items_to_pack' AND column_name = 'wms_line_id'
    ) THEN
        ALTER TABLE items_to_pack ADD COLUMN wms_line_id VARCHAR(255);
    END IF;
END $$;

-- Add wms_import_date column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items_to_pack' AND column_name = 'wms_import_date'
    ) THEN
        ALTER TABLE items_to_pack ADD COLUMN wms_import_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create index on wms_line_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_items_to_pack_wms_line_id ON items_to_pack(wms_line_id);

-- Create unique index on wms_line_id (only for non-null values) if it doesn't exist
DROP INDEX IF EXISTS idx_items_to_pack_wms_line_unique;
CREATE UNIQUE INDEX idx_items_to_pack_wms_line_unique ON items_to_pack(wms_line_id) WHERE wms_line_id IS NOT NULL;





