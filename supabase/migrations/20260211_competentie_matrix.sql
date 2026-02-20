-- Machines / werkplekken
CREATE TABLE IF NOT EXISTS machines (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  category    VARCHAR(100) DEFAULT 'machine', -- 'machine' | 'werkplek' | 'overig'
  active      BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competenties: medewerker × machine
-- level: 0 = geen kennis, 1 = in opleiding, 2 = basiskennis, 3 = gevorderd, 4 = expert/zelfstandig
CREATE TABLE IF NOT EXISTS competencies (
  id          BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  machine_id  BIGINT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  level       SMALLINT NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 4),
  notes       TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (employee_id, machine_id)
);

-- Dagelijkse status per medewerker
-- status: 'aanwezig' | 'afwezig' | 'verlof' | 'ziek' | 'thuiswerk'
CREATE TABLE IF NOT EXISTS employee_daily_status (
  id                  BIGSERIAL PRIMARY KEY,
  employee_id         BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  status              VARCHAR(50) NOT NULL DEFAULT 'aanwezig',
  assigned_machine_id BIGINT REFERENCES machines(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (employee_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_competencies_employee ON competencies(employee_id);
CREATE INDEX IF NOT EXISTS idx_competencies_machine  ON competencies(machine_id);
CREATE INDEX IF NOT EXISTS idx_daily_status_date     ON employee_daily_status(date);
CREATE INDEX IF NOT EXISTS idx_daily_status_employee ON employee_daily_status(employee_id);
