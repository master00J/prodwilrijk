-- BC Production Order Lines (uit "Prod. Order Line List" export).
-- We nemen alleen rijen waarvan:
--   1) Location Code één van GENK_EIK / Wilrijk / Willebroek is
--   2) Het FP-item in de ERP LINK terugkomt (via bc_item_mapping FP→GP)
-- Deze data geeft real-time zicht op wat er in BC op productie staat per kist.

CREATE TABLE IF NOT EXISTS grote_inpak_production_orders (
  id              BIGSERIAL PRIMARY KEY,
  status          TEXT,                 -- bv. "Firm Planned", "Released", "Simulated"
  prod_order_no   TEXT,                 -- bv. "POF26-000001"
  item_no         TEXT,                 -- FP-code uit kolom C
  description     TEXT,
  location_code   TEXT,                 -- raw waarde uit Excel (bv. "GENK_EIK")
  productielocatie TEXT,                -- genormaliseerd: Genk / Wilrijk / Willebroek
  kistnummer      TEXT,                 -- gematcht via FP→GP→erp_link
  quantity            NUMERIC,          -- kol L
  finished_quantity   NUMERIC,          -- kol K
  remaining_quantity  NUMERIC,          -- kol M
  due_date        DATE,                 -- kol Q
  starting_date   TIMESTAMPTZ,          -- kol R
  ending_date     TIMESTAMPTZ,          -- kol S
  source_file     TEXT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_production_orders_kistnummer
  ON grote_inpak_production_orders (kistnummer);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_production_orders_productielocatie
  ON grote_inpak_production_orders (productielocatie);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_production_orders_ending_date
  ON grote_inpak_production_orders (ending_date);

-- Eén unieke prod-order-line-combinatie (een PO kan meerdere FP lijnen hebben).
-- Upload mag dezelfde regel opnieuw inserten zonder duplicate via upsert.
CREATE UNIQUE INDEX IF NOT EXISTS uq_grote_inpak_production_orders_po_item
  ON grote_inpak_production_orders (prod_order_no, item_no);
