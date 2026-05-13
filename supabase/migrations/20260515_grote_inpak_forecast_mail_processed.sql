-- Dedupe voor automatische forecast-mailimport (Message-ID).
CREATE TABLE IF NOT EXISTS grote_inpak_forecast_mail_processed (
  message_id TEXT PRIMARY KEY,
  source_file TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_forecast_mail_processed_at
  ON grote_inpak_forecast_mail_processed (processed_at DESC);
