-- Manuele vloerstatus per productieorderlijn (Genk → zicht voor Wilrijk).
-- Sleutel = dezelfde als grote_inpak_production_orders na bc_source-migratie.

CREATE TABLE IF NOT EXISTS grote_inpak_production_order_floor_status (
  id              BIGSERIAL PRIMARY KEY,
  prod_order_no   TEXT NOT NULL,
  item_no         TEXT NOT NULL,
  bc_source       TEXT NOT NULL DEFAULT 'bc36',
  floor_status    TEXT NOT NULL
    CHECK (floor_status IN (
      'not_started',
      'sawmill',
      'assembly',
      'ready_transport',
      'completed'
    )),
  note            TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grote_inpak_po_floor_po_item_src
  ON grote_inpak_production_order_floor_status (prod_order_no, item_no, bc_source);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_po_floor_status
  ON grote_inpak_production_order_floor_status (floor_status);

ALTER TABLE grote_inpak_production_order_floor_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_production_order_floor_status;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_production_order_floor_status
  FOR ALL USING (true) WITH CHECK (true);
