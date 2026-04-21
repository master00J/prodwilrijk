-- Tijdens de overgang van de oude BC-omgeving (GP... codes) naar BC36 (FP... codes)
-- moeten er tegelijk stock-uploads bestaan uit beide omgevingen. Ze dragen per kist
-- samen bij aan de totaalvoorraad (optellen in de UI-aggregatie).
--
-- We voegen een bron-kolom toe zodat de upload-flow alleen de rijen van dezelfde
-- bron + locatie wist (en niet de andere bron per ongeluk ook).
--   'legacy' = BC export met GP-codes
--   'bc36'   = BC36 export met FP-codes

ALTER TABLE grote_inpak_stock
  ADD COLUMN IF NOT EXISTS bc_source TEXT NOT NULL DEFAULT 'legacy';

-- Snel filteren op (location, bc_source) is belangrijk voor de delete-voor-insert
-- in de upload-endpoint. Een samengestelde index dekt ook het kleinere lookup-
-- patroon op enkel location.
CREATE INDEX IF NOT EXISTS idx_grote_inpak_stock_location_bc_source
  ON grote_inpak_stock (location, bc_source);
