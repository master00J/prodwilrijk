-- Tracking wie welk item heeft ingepakt (vanuit employees tabel)
-- packed_by_employee_id: FK naar employees voor joins
-- packed_by_name: naam snapshot zodat historische data klopt bij verwijdering employee

ALTER TABLE packed_items
  ADD COLUMN IF NOT EXISTS packed_by_employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS packed_by_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_packed_items_packed_by_employee_id
  ON packed_items(packed_by_employee_id);
