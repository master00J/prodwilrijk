-- Tijdens de BC-overgang willen we uploads uit zowel de oude omgeving (GP-codes,
-- locaties PACK-WILR/PACK-GENK/PACK-WILL) als de nieuwe omgeving (FP-codes,
-- locaties Wilrijk/Willebroek/GENK_EIK) naast elkaar in de tabel bewaren.
--
--   'legacy' = oude BC export (item_no = GP-code, location_code = PACK-*)
--   'bc36'   = nieuwe BC36 export (item_no = FP-code)

ALTER TABLE grote_inpak_production_orders
  ADD COLUMN IF NOT EXISTS bc_source TEXT NOT NULL DEFAULT 'bc36';

CREATE INDEX IF NOT EXISTS idx_grote_inpak_production_orders_bc_source
  ON grote_inpak_production_orders (bc_source);

-- Bestaand uniek index op (prod_order_no, item_no) vervangen door één die ook
-- bc_source meeneemt: dezelfde PO-nr kan in beide BC-omgevingen voorkomen
-- (al is dat in de praktijk niet zo, de safety blijft aanwezig).
DROP INDEX IF EXISTS uq_grote_inpak_production_orders_po_item;
CREATE UNIQUE INDEX IF NOT EXISTS uq_grote_inpak_production_orders_po_item_src
  ON grote_inpak_production_orders (prod_order_no, item_no, bc_source);
