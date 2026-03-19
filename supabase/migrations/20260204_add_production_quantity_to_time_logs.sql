-- Aantal stuks per tijdregistratie (voor "per stuk klaarmelden")
ALTER TABLE time_logs
  ADD COLUMN IF NOT EXISTS production_quantity INTEGER;

COMMENT ON COLUMN time_logs.production_quantity IS 'Aantal stuks waarvoor deze tijdregistratie geldt (bijv. 2 van 5).';
