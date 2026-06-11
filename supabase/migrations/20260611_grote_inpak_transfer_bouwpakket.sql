-- Bouwpakketten in transfer: BC bouwpakket-codes (ERP LINK kolom bouwpakket_code)
-- worden bij de transfer-upload herkend en als aparte rijen opgeslagen.
ALTER TABLE grote_inpak_transfer
  ADD COLUMN IF NOT EXISTS is_bouwpakket BOOLEAN NOT NULL DEFAULT FALSE;
