-- Prioriteit voor TV display (hoger = belangrijker, 0 = geen prioriteit)
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS tv_priority integer NOT NULL DEFAULT 0;
