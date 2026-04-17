-- Telronde-ondersteuning voor wood stock
-- Voegt een audit-tabel toe voor stockcorrecties (via /wood/stock-count) én een kolom
-- om bij te houden wanneer elke voorraadpositie laatst werd geteld.

ALTER TABLE wood_stock
  ADD COLUMN IF NOT EXISTS laatst_geteld_op TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS wood_stock_corrections (
  id BIGSERIAL PRIMARY KEY,
  stock_id BIGINT NULL,
  houtsoort TEXT NULL,
  pakketnummer TEXT NULL,
  locatie TEXT NULL,
  dikte NUMERIC NULL,
  breedte NUMERIC NULL,
  lengte NUMERIC NULL,
  oud_aantal INTEGER NULL,
  nieuw_aantal INTEGER NOT NULL,
  verschil INTEGER NOT NULL,
  reden TEXT NULL,
  opmerking TEXT NULL,
  gebruiker_id TEXT NULL,
  gebruiker_email TEXT NULL,
  client_created_at TIMESTAMPTZ NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wood_stock_corrections_stock_id
  ON wood_stock_corrections (stock_id);

CREATE INDEX IF NOT EXISTS idx_wood_stock_corrections_created_at
  ON wood_stock_corrections (created_at DESC);

-- Fall-forward: kolom met default null, geen data-migratie nodig.
