-- Transfer orders: kisten onderweg naar Willebroek (al geproduceerd, nog niet op stock)
CREATE TABLE IF NOT EXISTS grote_inpak_transfer (
  id BIGSERIAL PRIMARY KEY,
  erp_code TEXT NOT NULL,   -- GP-code of item_number uit kolom A van de Excel
  kistnummer TEXT,          -- afgeleid via ERP LINK (kan null zijn, mapping gebeurt in kanban route)
  quantity INTEGER NOT NULL DEFAULT 0,
  source_file TEXT NOT NULL,  -- bestandsnaam als identifier
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_transfer_erp_code ON grote_inpak_transfer(erp_code);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_transfer_kistnummer ON grote_inpak_transfer(kistnummer);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_transfer_source_file ON grote_inpak_transfer(source_file);

ALTER TABLE grote_inpak_transfer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_transfer;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_transfer
  FOR ALL USING (true) WITH CHECK (true);
