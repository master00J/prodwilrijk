-- Wood Inventory System Tables

-- Wood Orders Table (bestellingen)
CREATE TABLE IF NOT EXISTS wood_orders (
  id BIGSERIAL PRIMARY KEY,
  houtsoort VARCHAR(50) NOT NULL, -- SXT, SCH, NHV, OSB, MEP, HDB
  min_lengte INTEGER NOT NULL, -- Minimum length in mm
  dikte INTEGER NOT NULL, -- Thickness in mm
  breedte INTEGER NOT NULL, -- Width in mm
  aantal_pakken INTEGER NOT NULL, -- Number of packages ordered
  planken_per_pak INTEGER DEFAULT 50, -- Planks per package
  opmerkingen TEXT,
  priority BOOLEAN DEFAULT FALSE,
  besteld_op TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ontvangen_pakken INTEGER DEFAULT 0, -- Number of packages received
  open_pakken INTEGER GENERATED ALWAYS AS (aantal_pakken - ontvangen_pakken) STORED, -- Calculated open packages
  bc_code VARCHAR(255), -- BC code
  locatie VARCHAR(255), -- Location
  gearchiveerd BOOLEAN DEFAULT FALSE, -- Archived flag
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wood Packages Table (aangemelde pakketten voor ontvangst)
CREATE TABLE IF NOT EXISTS wood_packages (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES wood_orders(id) ON DELETE SET NULL,
  pakketnummer VARCHAR(255) UNIQUE NOT NULL, -- Package number (unique)
  houtsoort VARCHAR(50) NOT NULL,
  exacte_dikte DECIMAL(10,2) NOT NULL, -- Exact thickness in mm
  exacte_breedte DECIMAL(10,2) NOT NULL, -- Exact width in mm
  exacte_lengte INTEGER NOT NULL, -- Exact length in mm
  planken_per_pak INTEGER NOT NULL,
  opmerking TEXT, -- Comment from registration
  aangemeld_op TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ontvangen BOOLEAN DEFAULT FALSE, -- Whether package has been received
  locatie VARCHAR(255), -- Location when received
  ontvangen_op TIMESTAMP WITH TIME ZONE, -- When package was received
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wood Stock Table (voorraad)
CREATE TABLE IF NOT EXISTS wood_stock (
  id BIGSERIAL PRIMARY KEY,
  package_id BIGINT REFERENCES wood_packages(id) ON DELETE SET NULL,
  houtsoort VARCHAR(50) NOT NULL,
  pakketnummer VARCHAR(255),
  dikte DECIMAL(10,2) NOT NULL, -- Thickness in mm
  breedte DECIMAL(10,2) NOT NULL, -- Width in mm
  lengte INTEGER NOT NULL, -- Length in mm
  locatie VARCHAR(255) NOT NULL, -- Location in warehouse
  aantal INTEGER NOT NULL DEFAULT 1, -- Number of planks
  ontvangen_op TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wood Consumption Table (verbruik)
CREATE TABLE IF NOT EXISTS wood_consumption (
  id BIGSERIAL PRIMARY KEY,
  stock_id BIGINT REFERENCES wood_stock(id) ON DELETE SET NULL,
  houtsoort VARCHAR(50) NOT NULL,
  lengte INTEGER NOT NULL, -- Length in mm
  breedte DECIMAL(10,2) NOT NULL, -- Width in mm
  dikte DECIMAL(10,2) NOT NULL, -- Thickness in mm
  aantal INTEGER NOT NULL, -- Number of planks consumed
  datum_verbruik TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opmerking TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wood_orders_houtsoort ON wood_orders(houtsoort);
CREATE INDEX IF NOT EXISTS idx_wood_orders_besteld_op ON wood_orders(besteld_op);
CREATE INDEX IF NOT EXISTS idx_wood_orders_gearchiveerd ON wood_orders(gearchiveerd);
CREATE INDEX IF NOT EXISTS idx_wood_orders_priority ON wood_orders(priority);

CREATE INDEX IF NOT EXISTS idx_wood_packages_pakketnummer ON wood_packages(pakketnummer);
CREATE INDEX IF NOT EXISTS idx_wood_packages_order_id ON wood_packages(order_id);
CREATE INDEX IF NOT EXISTS idx_wood_packages_ontvangen ON wood_packages(ontvangen);
CREATE INDEX IF NOT EXISTS idx_wood_packages_aangemeld_op ON wood_packages(aangemeld_op);

CREATE INDEX IF NOT EXISTS idx_wood_stock_houtsoort ON wood_stock(houtsoort);
CREATE INDEX IF NOT EXISTS idx_wood_stock_locatie ON wood_stock(locatie);
CREATE INDEX IF NOT EXISTS idx_wood_stock_pakketnummer ON wood_stock(pakketnummer);
CREATE INDEX IF NOT EXISTS idx_wood_stock_package_id ON wood_stock(package_id);

CREATE INDEX IF NOT EXISTS idx_wood_consumption_houtsoort ON wood_consumption(houtsoort);
CREATE INDEX IF NOT EXISTS idx_wood_consumption_datum_verbruik ON wood_consumption(datum_verbruik);
CREATE INDEX IF NOT EXISTS idx_wood_consumption_stock_id ON wood_consumption(stock_id);



