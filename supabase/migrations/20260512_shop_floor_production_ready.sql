-- Verdere shop-floor basis voor multi-site productiegebruik.
-- Bestaande data blijft onder Wilrijk werken.

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS site TEXT NOT NULL DEFAULT 'Wilrijk';

ALTER TABLE time_logs
  ADD COLUMN IF NOT EXISTS site TEXT NOT NULL DEFAULT 'Wilrijk';

ALTER TABLE tv_screens
  ADD COLUMN IF NOT EXISTS site TEXT NOT NULL DEFAULT 'Wilrijk';

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS allowed_sites TEXT[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_production_orders_site_order
  ON production_orders(site, order_number);

CREATE INDEX IF NOT EXISTS idx_production_orders_site_time_registration
  ON production_orders(site, for_time_registration, finished_at);

CREATE INDEX IF NOT EXISTS idx_time_logs_site_start_time
  ON time_logs(site, start_time);

CREATE INDEX IF NOT EXISTS idx_time_logs_site_production
  ON time_logs(site, production_order_number, production_item_number, production_step);

CREATE INDEX IF NOT EXISTS idx_tv_screens_site
  ON tv_screens(site);

CREATE INDEX IF NOT EXISTS idx_user_roles_allowed_sites
  ON user_roles USING GIN (allowed_sites);
