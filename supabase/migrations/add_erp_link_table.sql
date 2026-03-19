-- ERP LINK Table - For managing ERP LINK data (kistnummer, ERP code, productielocatie)
CREATE TABLE IF NOT EXISTS grote_inpak_erp_link (
  id BIGSERIAL PRIMARY KEY,
  kistnummer VARCHAR(255) NOT NULL UNIQUE,
  erp_code VARCHAR(255),
  productielocatie VARCHAR(255), -- 'Wilrijk' or 'Genk'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_grote_inpak_erp_link_kistnummer ON grote_inpak_erp_link(kistnummer);
CREATE INDEX IF NOT EXISTS idx_grote_inpak_erp_link_productielocatie ON grote_inpak_erp_link(productielocatie);

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_grote_inpak_erp_link_updated_at ON grote_inpak_erp_link;
CREATE TRIGGER update_grote_inpak_erp_link_updated_at 
  BEFORE UPDATE ON grote_inpak_erp_link
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE grote_inpak_erp_link ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users
DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_erp_link;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_erp_link
  FOR ALL
  USING (true)
  WITH CHECK (true);

