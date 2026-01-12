# Database Migration Guide

## Adding WMS Fields to Existing Database

Als je de fout krijgt: `column "wms_line_id" does not exist`, betekent dit dat de tabel `items_to_pack` al bestaat maar de nieuwe kolommen nog niet heeft.

### Oplossing 1: Migration Script (Aanbevolen)

Voer het migration script uit in Supabase SQL Editor:

```sql
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
```

### Oplossing 2: Volledig Schema Opnieuw Uitvoeren

Als je geen data hebt die je wilt behouden, kun je het volledige `schema.sql` bestand opnieuw uitvoeren. Dit werkt alleen als je `CREATE TABLE IF NOT EXISTS` gebruikt (wat we doen).

### Oplossing 3: Handmatig ALTER TABLE

Voer deze commando's direct uit:

```sql
ALTER TABLE items_to_pack ADD COLUMN IF NOT EXISTS wms_line_id VARCHAR(255);
ALTER TABLE items_to_pack ADD COLUMN IF NOT EXISTS wms_import_date TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_items_to_pack_wms_line_id ON items_to_pack(wms_line_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_to_pack_wms_line_unique ON items_to_pack(wms_line_id) WHERE wms_line_id IS NOT NULL;
```

## Nieuwe Tabel: confirmed_incoming_goods

Als je ook de nieuwe `confirmed_incoming_goods` tabel nodig hebt, voer dan dit uit:

```sql
CREATE TABLE IF NOT EXISTS confirmed_incoming_goods (
  id BIGSERIAL PRIMARY KEY,
  item_number VARCHAR(255) NOT NULL,
  po_number VARCHAR(255) NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  date_added TIMESTAMP WITH TIME ZONE NOT NULL,
  date_confirmed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  original_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confirmed_incoming_item_number ON confirmed_incoming_goods(item_number);
CREATE INDEX IF NOT EXISTS idx_confirmed_incoming_po_number ON confirmed_incoming_goods(po_number);
CREATE INDEX IF NOT EXISTS idx_confirmed_incoming_date_confirmed ON confirmed_incoming_goods(date_confirmed);

ALTER TABLE confirmed_incoming_goods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON confirmed_incoming_goods;
CREATE POLICY "Allow all for authenticated users" ON confirmed_incoming_goods
  FOR ALL
  USING (true)
  WITH CHECK (true);
```




