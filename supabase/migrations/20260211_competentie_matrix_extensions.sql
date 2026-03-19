-- Uitbreidingen competentie-matrix: historiek, opleidingsplanning, shift

-- 1. Historiek van competentiewijzigingen
CREATE TABLE IF NOT EXISTS competency_history (
  id          bigserial PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES employees(id)  ON DELETE CASCADE,
  machine_id  bigint NOT NULL REFERENCES machines(id)   ON DELETE CASCADE,
  old_level   int    NOT NULL DEFAULT 0,
  new_level   int    NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comp_hist_emp ON competency_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_comp_hist_mach ON competency_history(machine_id);

-- 2. Opleidingsplanning
CREATE TABLE IF NOT EXISTS training_plans (
  id          bigserial PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES employees(id)  ON DELETE CASCADE,
  machine_id  bigint NOT NULL REFERENCES machines(id)   ON DELETE CASCADE,
  target_date date,
  trainer_id  bigint REFERENCES employees(id),
  notes       text,
  completed   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_training_emp  ON training_plans(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_mach ON training_plans(machine_id);

DROP TRIGGER IF EXISTS trg_training_plans_updated_at ON training_plans;
CREATE TRIGGER trg_training_plans_updated_at
  BEFORE UPDATE ON training_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Shift/ploeg kolom op dagplanning
ALTER TABLE employee_daily_status
  ADD COLUMN IF NOT EXISTS shift varchar(20) NOT NULL DEFAULT 'dag';
