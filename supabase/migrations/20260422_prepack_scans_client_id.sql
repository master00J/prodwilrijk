-- Voegt een client_id kolom toe aan prepack_scans zodat de tablet offline kan
-- scannen en later idempotent kan syncen (retries geven geen duplicaten).
-- Bestaande rijen krijgen NULL; de UNIQUE constraint is compatibel met
-- meerdere NULL-waarden (Postgres default gedrag).

ALTER TABLE public.prepack_scans
  ADD COLUMN IF NOT EXISTS client_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_prepack_scans_client_id
  ON public.prepack_scans(client_id)
  WHERE client_id IS NOT NULL;
