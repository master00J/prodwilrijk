-- Narrowcasting beheer voor TV-schermen.

ALTER TABLE tv_screens
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS screen_group TEXT NOT NULL DEFAULT 'Algemeen',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tv_screens_active
  ON tv_screens(active);

CREATE INDEX IF NOT EXISTS idx_tv_screens_group
  ON tv_screens(screen_group);
