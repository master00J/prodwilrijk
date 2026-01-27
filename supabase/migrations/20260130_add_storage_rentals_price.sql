ALTER TABLE storage_rental_items
ADD COLUMN IF NOT EXISTS price_per_m2 NUMERIC;
