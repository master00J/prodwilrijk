-- Capaciteit per machine/werkplek: hoeveel personen er tegelijk aan kunnen werken
ALTER TABLE machines ADD COLUMN IF NOT EXISTS capacity SMALLINT NOT NULL DEFAULT 1;
