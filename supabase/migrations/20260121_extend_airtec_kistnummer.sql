-- Extend Airtec kistnummer length to support >3 digits
ALTER TABLE IF EXISTS incoming_goods_airtec
  ALTER COLUMN kistnummer TYPE VARCHAR(50);

ALTER TABLE IF EXISTS confirmed_items_airtec
  ALTER COLUMN kistnummer TYPE VARCHAR(50);

ALTER TABLE IF EXISTS items_to_pack_airtec
  ALTER COLUMN kistnummer TYPE VARCHAR(50);

ALTER TABLE IF EXISTS packed_items_airtec
  ALTER COLUMN kistnummer TYPE VARCHAR(50);
