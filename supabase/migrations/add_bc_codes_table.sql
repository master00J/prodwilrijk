-- BC Codes Table for Wood Inventory
-- This table stores BC codes (product codes) for wood types based on dimensions

CREATE TABLE IF NOT EXISTS bc_codes (
  id BIGSERIAL PRIMARY KEY,
  breedte INTEGER NOT NULL, -- Width in mm
  dikte INTEGER NOT NULL, -- Thickness in mm
  houtsoort VARCHAR(50) NOT NULL, -- Wood type (SXT, SCH, NHV, OSB, MEP, HDB)
  bc_code VARCHAR(255) NOT NULL, -- BC code / product code
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Unique constraint: one BC code per combination of breedte, dikte, houtsoort
  UNIQUE(breedte, dikte, houtsoort)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bc_codes_lookup ON bc_codes(breedte, dikte, houtsoort);
CREATE INDEX IF NOT EXISTS idx_bc_codes_houtsoort ON bc_codes(houtsoort);


