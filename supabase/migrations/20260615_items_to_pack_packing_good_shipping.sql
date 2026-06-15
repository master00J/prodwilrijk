ALTER TABLE items_to_pack
  ADD COLUMN IF NOT EXISTS current_package_no VARCHAR(255),
  ADD COLUMN IF NOT EXISTS packing_good_status VARCHAR(100),
  ADD COLUMN IF NOT EXISTS packing_good_imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_status VARCHAR(50) NOT NULL DEFAULT 'open'
    CHECK (shipping_status IN ('open', 'shipped')),
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_scan_id BIGINT REFERENCES prepack_scans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_items_to_pack_current_package_no
  ON items_to_pack(current_package_no)
  WHERE current_package_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_items_to_pack_shipping_status
  ON items_to_pack(shipping_status);

ALTER TABLE packed_items
  ADD COLUMN IF NOT EXISTS current_package_no VARCHAR(255),
  ADD COLUMN IF NOT EXISTS packing_good_status VARCHAR(100),
  ADD COLUMN IF NOT EXISTS packing_good_imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_status VARCHAR(50) NOT NULL DEFAULT 'open'
    CHECK (shipping_status IN ('open', 'shipped')),
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_scan_id BIGINT REFERENCES prepack_scans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_packed_items_current_package_no
  ON packed_items(current_package_no)
  WHERE current_package_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_packed_items_shipping_status
  ON packed_items(shipping_status);

