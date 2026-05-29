-- Herstel per ongeluk verpakte items (2026-05-29 12:28:29, Glenn)
-- Bron: packed_items_rows.csv — 339 regels, packed_items.id 133739 t/m 134077
-- Uitvoeren in Supabase SQL Editor als één script.

BEGIN;

INSERT INTO items_to_pack (
  id,
  item_number,
  po_number,
  amount,
  date_added,
  priority,
  measurement,
  packed,
  problem,
  problem_comment
)
SELECT
  p.original_id,
  p.item_number,
  p.po_number,
  p.amount,
  p.date_added,
  false,
  false,
  false,
  false,
  null
FROM packed_items p
WHERE p.id BETWEEN 133739 AND 134077
  AND p.date_packed = '2026-05-29 12:28:29.160199+00'
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('items_to_pack', 'id'),
  COALESCE((SELECT MAX(id) FROM items_to_pack), 1)
);

DELETE FROM packed_items
WHERE id BETWEEN 133739 AND 134077
  AND date_packed = '2026-05-29 12:28:29.160199+00';

COMMIT;

-- Controle (los uitvoeren na COMMIT):
-- SELECT COUNT(*) FROM packed_items
--   WHERE id BETWEEN 133739 AND 134077;  -- verwacht: 0
-- SELECT COUNT(*) FROM items_to_pack
--   WHERE id BETWEEN 9324 AND 10664;    -- verwacht: 339 (original_id bereik uit CSV)
