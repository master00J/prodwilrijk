-- Klantvragen voor forecast-units die nog niet noodzakelijk op PILS staan.
-- Koppeling gebeurt bewust via case_label zonder FK: forecast wordt regelmatig vervangen.

CREATE TABLE IF NOT EXISTS grote_inpak_customer_requests (
  id BIGSERIAL PRIMARY KEY,
  case_label VARCHAR(255) NOT NULL,
  case_type VARCHAR(50),
  customer_name TEXT,
  request_text TEXT NOT NULL,
  requested_action TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'waiting_forecast', 'on_pils', 'handled', 'cancelled')),
  due_date DATE,
  created_from TEXT NOT NULL DEFAULT 'forecast',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_customer_requests_case_label
  ON grote_inpak_customer_requests(case_label);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_customer_requests_status
  ON grote_inpak_customer_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grote_inpak_customer_requests_open_case_label
  ON grote_inpak_customer_requests(case_label)
  WHERE status IN ('open', 'waiting_forecast', 'on_pils');

CREATE OR REPLACE FUNCTION update_grote_inpak_customer_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status IN ('handled', 'cancelled') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at = NOW();
  ELSIF NEW.status NOT IN ('handled', 'cancelled') THEN
    NEW.resolved_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grote_inpak_customer_requests_updated_at ON grote_inpak_customer_requests;
CREATE TRIGGER trg_grote_inpak_customer_requests_updated_at
  BEFORE UPDATE ON grote_inpak_customer_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_grote_inpak_customer_requests_updated_at();

ALTER TABLE grote_inpak_customer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON grote_inpak_customer_requests;
CREATE POLICY "Allow all for authenticated users" ON grote_inpak_customer_requests
  FOR ALL USING (true) WITH CHECK (true);
