-- Historisch verbruik van C-kisten op basis van PACKED_Y/N mails
-- Elke rij = aantal gepakte kisten van een bepaald type op een bepaalde dag

CREATE TABLE IF NOT EXISTS grote_inpak_packed_consumption (
  id          serial PRIMARY KEY,
  case_type   varchar(20) NOT NULL,
  scan_date   date NOT NULL,
  quantity    int NOT NULL DEFAULT 0,
  source_type varchar(10) NOT NULL DEFAULT 'Y', -- 'Y' of 'N' (PACKED_Y of PACKED_N)
  created_at  timestamptz DEFAULT NOW(),
  UNIQUE(case_type, scan_date, source_type)
);

CREATE INDEX IF NOT EXISTS idx_packed_consumption_case_type ON grote_inpak_packed_consumption(case_type);
CREATE INDEX IF NOT EXISTS idx_packed_consumption_scan_date  ON grote_inpak_packed_consumption(scan_date);
