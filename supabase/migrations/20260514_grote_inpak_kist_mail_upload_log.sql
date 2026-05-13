-- Dagelijkse samenvatting kist-aanmelding-mails (mailbox) voor uploadhistoriek.
CREATE TABLE IF NOT EXISTS grote_inpak_kist_mail_upload_log (
  log_date          DATE PRIMARY KEY,
  mail_count        INT NOT NULL DEFAULT 0,
  cases_inserted    INT NOT NULL DEFAULT 0,
  cases_updated     INT NOT NULL DEFAULT 0,
  case_labels       TEXT[] NOT NULL DEFAULT '{}',
  last_event_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_kist_mail_upload_log_last
  ON grote_inpak_kist_mail_upload_log(last_event_at DESC);

COMMENT ON TABLE grote_inpak_kist_mail_upload_log IS 'Per kalenderdag (Europe/Brussels): gebundelde kist-mails uit IMAP.';
