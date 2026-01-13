-- CNH Tables Migration
-- This migration adds tables for the CNH flow

-- Bodems Stock Table (voorraad van bodems)
CREATE TABLE IF NOT EXISTS bodems_stock (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'laag' or 'hoog'
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(type)
);

-- CNH Motors Table
CREATE TABLE IF NOT EXISTS cnh_motors (
  id BIGSERIAL PRIMARY KEY,
  motor_nr VARCHAR(255) NOT NULL,
  type VARCHAR(255),
  location VARCHAR(255), -- China, Amerika, UZB, etc.
  shipping_note VARCHAR(255),
  state VARCHAR(50) NOT NULL DEFAULT 'received', -- received, packaged, loaded
  bodem_low INTEGER DEFAULT 0,
  bodem_high INTEGER DEFAULT 0,
  load_reference VARCHAR(255),
  container_number VARCHAR(255),
  truck_plate VARCHAR(255),
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  packaged_at TIMESTAMP WITH TIME ZONE,
  loaded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CNH Sessions Table (packaging and loading sessions)
CREATE TABLE IF NOT EXISTS cnh_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_type VARCHAR(50) NOT NULL, -- 'pack' or 'load'
  location VARCHAR(255),
  packaging_persons INTEGER DEFAULT 1,
  loading_persons INTEGER DEFAULT 1,
  packaging_minutes INTEGER DEFAULT 0,
  loading_minutes INTEGER DEFAULT 0,
  packaging_count INTEGER DEFAULT 0,
  loading_count INTEGER DEFAULT 0,
  operator_minutes INTEGER DEFAULT 0,
  load_reference VARCHAR(255),
  container_no VARCHAR(255),
  truck_plate VARCHAR(255),
  booking_ref VARCHAR(255),
  your_ref VARCHAR(255),
  container_tarra DECIMAL(10,2),
  container_photo_url TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stopped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CNH Session Motors Junction Table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS cnh_session_motors (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES cnh_sessions(id) ON DELETE CASCADE,
  motor_id BIGINT NOT NULL REFERENCES cnh_motors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, motor_id)
);

-- CNH Templates Table (load templates)
CREATE TABLE IF NOT EXISTS cnh_templates (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  load_location VARCHAR(255),
  load_reference VARCHAR(255),
  container_number VARCHAR(255),
  truck_plate VARCHAR(255),
  booking_ref VARCHAR(255),
  your_ref VARCHAR(255),
  container_tarra DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CNH Logs Table (activity logs)
CREATE TABLE IF NOT EXISTS cnh_logs (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(255) NOT NULL,
  motor_id BIGINT REFERENCES cnh_motors(id),
  session_id BIGINT REFERENCES cnh_sessions(id),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cnh_motors_motor_nr ON cnh_motors(motor_nr);
CREATE INDEX IF NOT EXISTS idx_cnh_motors_state ON cnh_motors(state);
CREATE INDEX IF NOT EXISTS idx_cnh_motors_location ON cnh_motors(location);
CREATE INDEX IF NOT EXISTS idx_cnh_motors_shipping_note ON cnh_motors(shipping_note);
CREATE INDEX IF NOT EXISTS idx_cnh_motors_received_at ON cnh_motors(received_at);
CREATE INDEX IF NOT EXISTS idx_cnh_sessions_session_type ON cnh_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_cnh_sessions_started_at ON cnh_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_cnh_session_motors_session_id ON cnh_session_motors(session_id);
CREATE INDEX IF NOT EXISTS idx_cnh_session_motors_motor_id ON cnh_session_motors(motor_id);
CREATE INDEX IF NOT EXISTS idx_cnh_logs_created_at ON cnh_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_cnh_logs_motor_id ON cnh_logs(motor_id);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at for cnh_motors
DROP TRIGGER IF EXISTS update_cnh_motors_updated_at ON cnh_motors;
CREATE TRIGGER update_cnh_motors_updated_at 
  BEFORE UPDATE ON cnh_motors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at for cnh_sessions
DROP TRIGGER IF EXISTS update_cnh_sessions_updated_at ON cnh_sessions;
CREATE TRIGGER update_cnh_sessions_updated_at 
  BEFORE UPDATE ON cnh_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at for cnh_templates
DROP TRIGGER IF EXISTS update_cnh_templates_updated_at ON cnh_templates;
CREATE TRIGGER update_cnh_templates_updated_at 
  BEFORE UPDATE ON cnh_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Initialize bodems stock if not exists
INSERT INTO bodems_stock (type, quantity) 
VALUES ('laag', 0), ('hoog', 0)
ON CONFLICT (type) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE bodems_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnh_motors ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnh_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnh_session_motors ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnh_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnh_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all for authenticated users
DROP POLICY IF EXISTS "Allow all for authenticated users" ON bodems_stock;
CREATE POLICY "Allow all for authenticated users" ON bodems_stock
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON cnh_motors;
CREATE POLICY "Allow all for authenticated users" ON cnh_motors
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON cnh_sessions;
CREATE POLICY "Allow all for authenticated users" ON cnh_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON cnh_session_motors;
CREATE POLICY "Allow all for authenticated users" ON cnh_session_motors
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON cnh_templates;
CREATE POLICY "Allow all for authenticated users" ON cnh_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON cnh_logs;
CREATE POLICY "Allow all for authenticated users" ON cnh_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

