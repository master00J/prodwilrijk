-- Volgorde van productieorderlijnen op de TV-productieorders slide.
-- 0 = geen expliciete prioriteit; lager positief nummer komt hoger.

ALTER TABLE production_order_lines
  ADD COLUMN IF NOT EXISTS tv_priority INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_production_order_lines_tv_priority
  ON production_order_lines(production_order_id, tv_priority);
