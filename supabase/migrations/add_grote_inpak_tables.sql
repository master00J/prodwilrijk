-- Grote Inpak Tables
-- This migration adds tables for the "Grote Inpak" workflow

-- Cases/Overview Table - Main table for tracking cases
CREATE TABLE IF NOT EXISTS grote_inpak_cases (
  id BIGSERIAL PRIMARY KEY,
  case_label VARCHAR(255) NOT NULL UNIQUE,
  case_type VARCHAR(50),
  arrival_date DATE,
  item_number VARCHAR(255),
  productielocatie VARCHAR(255),
  in_willebroek BOOLEAN DEFAULT FALSE,
  stock_location VARCHAR(255),
  locatie VARCHAR(255),
  status VARCHAR(100),
  priority BOOLEAN DEFAULT FALSE,
  comment TEXT,
  term_werkdagen INTEGER,
  deadline DATE,
  dagen_te_laat INTEGER DEFAULT 0,
  dagen_in_willebroek INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transport Table - For transport management
CREATE TABLE IF NOT EXISTS grote_inpak_transport (
  id BIGSERIAL PRIMARY KEY,
  case_label VARCHAR(255) NOT NULL REFERENCES grote_inpak_cases(case_label) ON DELETE CASCADE,
  transport_needed BOOLEAN DEFAULT FALSE,
  transport_date DATE,
  transport_status VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Data Table - For stock information
CREATE TABLE IF NOT EXISTS grote_inpak_stock (
  id BIGSERIAL PRIMARY KEY,
  item_number VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  quantity INTEGER,
  erp_code VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Forecast Data Table
CREATE TABLE IF NOT EXISTS grote_inpak_forecast (
  id BIGSERIAL PRIMARY KEY,
  item_number VARCHAR(255) NOT NULL,
  forecast_date DATE,
  forecast_quantity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Packed Cases Archive - Historical record of packed cases
CREATE TABLE IF NOT EXISTS grote_inpak_packed (
  id BIGSERIAL PRIMARY KEY,
  case_label VARCHAR(255) NOT NULL,
  packed_date DATE NOT NULL,
  packed_file VARCHAR(255), -- Reference to packed file name
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File Uploads Log - Track uploaded files
CREATE TABLE IF NOT EXISTS grote_inpak_file_uploads (
  id BIGSERIAL PRIMARY KEY,
  file_type VARCHAR(50) NOT NULL, -- 'pils', 'erp', 'stock', 'forecast', 'packed'
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  uploaded_by VARCHAR(255),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
  error_message TEXT
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_case_label ON grote_inpak_cases(case_label);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_case_type ON grote_inpak_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_item_number ON grote_inpak_cases(item_number);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_productielocatie ON grote_inpak_cases(productielocatie);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_in_willebroek ON grote_inpak_cases(in_willebroek);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_status ON grote_inpak_cases(status);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_priority ON grote_inpak_cases(priority);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_arrival_date ON grote_inpak_cases(arrival_date);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_cases_deadline ON grote_inpak_cases(deadline);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_transport_case_label ON grote_inpak_transport(case_label);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_stock_item_number ON grote_inpak_stock(item_number);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_forecast_item_number ON grote_inpak_forecast(item_number);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_packed_case_label ON grote_inpak_packed(case_label);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_packed_packed_date ON grote_inpak_packed(packed_date);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_file_uploads_file_type ON grote_inpak_file_uploads(file_type);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_file_uploads_uploaded_at ON grote_inpak_file_uploads(uploaded_at);

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_grote_inpak_cases_updated_at ON grote_inpak_cases;
CREATE TRIGGER update_grote_inpak_cases_updated_at 
  BEFORE UPDATE ON grote_inpak_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_grote_inpak_transport_updated_at ON grote_inpak_transport;
CREATE TRIGGER update_grote_inpak_transport_updated_at 
  BEFORE UPDATE ON grote_inpak_transport
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_grote_inpak_stock_updated_at ON grote_inpak_stock;
CREATE TRIGGER update_grote_inpak_stock_updated_at 
  BEFORE UPDATE ON grote_inpak_stock
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_grote_inpak_forecast_updated_at ON grote_inpak_forecast;
CREATE TRIGGER update_grote_inpak_forecast_updated_at 
  BEFORE UPDATE ON grote_inpak_forecast
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE grote_inpak_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE grote_inpak_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE grote_inpak_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE grote_inpak_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE grote_inpak_packed ENABLE ROW LEVEL SECURITY;
ALTER TABLE grote_inpak_file_uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users
DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_cases;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_cases
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_transport;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_transport
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_stock;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_stock
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_forecast;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_forecast
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_packed;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_packed
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_file_uploads;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_file_uploads
  FOR ALL
  USING (true)
  WITH CHECK (true);

