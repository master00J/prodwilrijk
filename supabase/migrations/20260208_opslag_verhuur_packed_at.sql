-- packed_at: datum waarop status naar verpakt ging (voor correcte prijsberekening per periode)
ALTER TABLE storage_rental_items ADD COLUMN IF NOT EXISTS packed_at DATE;
COMMENT ON COLUMN storage_rental_items.packed_at IS 'Datum waarop verpakt. Voor prijsberekening: period vóór packed_at = m² bare, daarna = m² verpakt.';
