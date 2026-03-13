-- Scan controle log voor items-to-pack-airtec
-- Logt elke scan poging: match, mismatch of error

CREATE TABLE IF NOT EXISTS airtec_scan_log (
  id            bigserial PRIMARY KEY,
  scanned_at    timestamptz NOT NULL DEFAULT NOW(),
  lot_number    varchar(100),            -- genormaliseerd lotnummer (als match/error)
  scan_a_raw    varchar(200),            -- ruwe waarde scan 1
  scan_b_raw    varchar(200),            -- ruwe waarde scan 2
  result        varchar(20)  NOT NULL,   -- 'match' | 'mismatch' | 'error'
  item_id       bigint,                  -- gekoppeld item ID (bij match)
  error_message text                     -- foutmelding (bij error)
);

CREATE INDEX IF NOT EXISTS idx_airtec_scan_log_scanned_at ON airtec_scan_log(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_airtec_scan_log_result     ON airtec_scan_log(result);
CREATE INDEX IF NOT EXISTS idx_airtec_scan_log_lot_number ON airtec_scan_log(lot_number);
