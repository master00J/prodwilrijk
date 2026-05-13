-- Idempotent verwerking van "Kist … type … in te pakken"-mails (IMAP Message-ID of hash).
CREATE TABLE IF NOT EXISTS grote_inpak_kist_mail_processed (
  message_id   TEXT PRIMARY KEY,
  case_label   TEXT,
  imported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_kist_mail_processed_imported_at
  ON grote_inpak_kist_mail_processed(imported_at DESC);
