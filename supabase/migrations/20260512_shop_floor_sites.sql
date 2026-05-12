-- Multi-site basis voor shop-floor planning.
-- BC Location Code / productielocatie wordt later gemapt naar deze site-code.

ALTER TABLE production_planning_items
  ADD COLUMN IF NOT EXISTS site TEXT NOT NULL DEFAULT 'Wilrijk';

CREATE INDEX IF NOT EXISTS idx_production_planning_site_date
  ON production_planning_items (site, planned_date);

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS site TEXT NOT NULL DEFAULT 'Wilrijk';

CREATE INDEX IF NOT EXISTS idx_machines_site
  ON machines (site);

ALTER TABLE employee_daily_status
  ADD COLUMN IF NOT EXISTS site TEXT NOT NULL DEFAULT 'Wilrijk';

CREATE INDEX IF NOT EXISTS idx_daily_status_site_date
  ON employee_daily_status (site, date);
