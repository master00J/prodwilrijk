CREATE TABLE IF NOT EXISTS airtec_kisten_stock (
  id BIGSERIAL PRIMARY KEY,
  kistnummer VARCHAR(50) NOT NULL UNIQUE,
  erp_code VARCHAR(50),
  huidige_voorraad INTEGER NOT NULL DEFAULT 0,
  minimum_voorraad INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_airtec_kisten_stock_erp ON airtec_kisten_stock(erp_code);

-- Verbruik/levering log voor historiek en analyse
CREATE TABLE IF NOT EXISTS airtec_kisten_stock_log (
  id BIGSERIAL PRIMARY KEY,
  kistnummer VARCHAR(50) NOT NULL,
  change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('consumed', 'delivered', 'manual')),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_airtec_kisten_stock_log_kist ON airtec_kisten_stock_log(kistnummer);
CREATE INDEX idx_airtec_kisten_stock_log_date ON airtec_kisten_stock_log(created_at);

-- RPC functie voor atomaire stock-afname
CREATE OR REPLACE FUNCTION decrement_airtec_kisten_stock(p_kistnummer TEXT, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE airtec_kisten_stock
  SET huidige_voorraad = GREATEST(0, huidige_voorraad - p_quantity),
      updated_at = NOW()
  WHERE kistnummer = p_kistnummer;
END;
$$ LANGUAGE plpgsql;

-- RPC functie voor atomaire stock-toename
CREATE OR REPLACE FUNCTION increment_airtec_kisten_stock(p_kistnummer TEXT, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE airtec_kisten_stock
  SET huidige_voorraad = huidige_voorraad + p_quantity,
      updated_at = NOW()
  WHERE kistnummer = p_kistnummer;
END;
$$ LANGUAGE plpgsql;
