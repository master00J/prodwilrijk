-- Automatische updated_at triggers voor competentie-matrix tabellen
-- Zorgt ervoor dat updated_at altijd correct bijgewerkt wordt bij elke UPDATE

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger voor machines
DROP TRIGGER IF EXISTS trg_machines_updated_at ON machines;
CREATE TRIGGER trg_machines_updated_at
  BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger voor competencies
DROP TRIGGER IF EXISTS trg_competencies_updated_at ON competencies;
CREATE TRIGGER trg_competencies_updated_at
  BEFORE UPDATE ON competencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger voor employee_daily_status
DROP TRIGGER IF EXISTS trg_employee_daily_status_updated_at ON employee_daily_status;
CREATE TRIGGER trg_employee_daily_status_updated_at
  BEFORE UPDATE ON employee_daily_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
