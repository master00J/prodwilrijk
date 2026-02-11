-- Zelfde velden als incoming_goods_airtec voor "items niet in lijst"
ALTER TABLE airtec_unlisted_items
  ADD COLUMN IF NOT EXISTS lot_number VARCHAR(255),
  ADD COLUMN IF NOT EXISTS datum_opgestuurd TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS kistnummer VARCHAR(3),
  ADD COLUMN IF NOT EXISTS divisie VARCHAR(255);
