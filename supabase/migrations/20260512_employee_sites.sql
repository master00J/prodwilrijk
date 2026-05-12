-- Medewerkers kunnen op meerdere vestigingen inzetbaar zijn.
-- Default blijft Wilrijk zodat bestaande medewerkers meteen zichtbaar blijven.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS sites TEXT[] NOT NULL DEFAULT ARRAY['Wilrijk'];

CREATE INDEX IF NOT EXISTS idx_employees_sites
  ON employees USING GIN (sites);
