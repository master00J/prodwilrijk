CREATE TABLE IF NOT EXISTS production_planning_items (
  id BIGSERIAL PRIMARY KEY,
  production_order_id BIGINT REFERENCES production_orders(id) ON DELETE SET NULL,
  production_order_line_id BIGINT REFERENCES production_order_lines(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  sales_order_number TEXT,
  item_number TEXT,
  description TEXT,
  production_step TEXT NOT NULL,
  planned_date DATE NOT NULL,
  shift VARCHAR(20) NOT NULL DEFAULT 'dag'
    CHECK (shift IN ('dag', 'vroeg', 'laat', 'nacht')),
  machine_id BIGINT REFERENCES machines(id) ON DELETE SET NULL,
  assigned_employee_ids BIGINT[] NOT NULL DEFAULT '{}',
  planned_quantity NUMERIC,
  planned_minutes INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'released', 'in_progress', 'done', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_production_planning_date
  ON production_planning_items (planned_date);

CREATE INDEX IF NOT EXISTS idx_production_planning_order
  ON production_planning_items (order_number);

CREATE INDEX IF NOT EXISTS idx_production_planning_line
  ON production_planning_items (production_order_line_id);

CREATE INDEX IF NOT EXISTS idx_production_planning_machine
  ON production_planning_items (machine_id);

CREATE INDEX IF NOT EXISTS idx_production_planning_status
  ON production_planning_items (status);

ALTER TABLE production_planning_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON production_planning_items;
CREATE POLICY "Allow all for authenticated users" ON production_planning_items
  FOR ALL USING (true) WITH CHECK (true);
