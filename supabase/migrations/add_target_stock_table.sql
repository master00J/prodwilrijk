-- Target Stock Table for Wood Inventory
-- This table stores target stock levels for automatic ordering

CREATE TABLE IF NOT EXISTS wood_target_stock (
  id BIGSERIAL PRIMARY KEY,
  houtsoort VARCHAR(50) NOT NULL,
  dikte DECIMAL(10,2) NOT NULL,
  breedte DECIMAL(10,2) NOT NULL,
  target_packs INTEGER NOT NULL DEFAULT 0,
  desired_length INTEGER, -- Desired length in mm
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Unique constraint: one target per combination of houtsoort, dikte, breedte, desired_length
  UNIQUE(houtsoort, dikte, breedte, desired_length)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wood_target_stock_lookup ON wood_target_stock(houtsoort, dikte, breedte);
CREATE INDEX IF NOT EXISTS idx_wood_target_stock_houtsoort ON wood_target_stock(houtsoort);

