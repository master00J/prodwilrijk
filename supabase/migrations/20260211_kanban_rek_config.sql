-- Vaste rekindeling voor C-kisten in Willebroek
-- Elke rij = één kisttype met zijn reklocatie, stapelhoogte en aantal posities
-- max_voorraad = posities * stapel * stapels_per_positie (standaard 2)

CREATE TABLE IF NOT EXISTS grote_inpak_kanban_config (
  id              serial PRIMARY KEY,
  case_type       varchar(20)  NOT NULL UNIQUE,
  rek_sectie      varchar(20),           -- 'Links' of 'Rechts'
  rek_niveau      int,                   -- 1 (grond) t/m 4 (hoogste)
  rek_kolom       int,                   -- 1-8
  productielocatie varchar(10),          -- 'Genk' of 'Wilrijk'
  stapel          int NOT NULL DEFAULT 1,
  posities        int NOT NULL DEFAULT 1, -- aantal rekposities bezet
  stapels_per_pos int NOT NULL DEFAULT 2,
  verbruik_per_dag numeric(6,2),
  prioriteit      varchar(20),           -- 'critical','high','medium','low','very-low'
  actief          boolean NOT NULL DEFAULT true,
  notitie         text,
  updated_at      timestamptz DEFAULT NOW()
);

-- Trigger voor updated_at
CREATE OR REPLACE FUNCTION update_kanban_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kanban_config_updated_at ON grote_inpak_kanban_config;
CREATE TRIGGER trg_kanban_config_updated_at
  BEFORE UPDATE ON grote_inpak_kanban_config
  FOR EACH ROW EXECUTE FUNCTION update_kanban_config_updated_at();

-- ── Seed data uit kanban.html ─────────────────────────────────────────────
-- LINKS - Niveau 4 (hoogste)
INSERT INTO grote_inpak_kanban_config (case_type, rek_sectie, rek_niveau, rek_kolom, productielocatie, stapel, posities, verbruik_per_dag, prioriteit)
VALUES
  ('C352', 'Links', 4, 1, 'Wilrijk', 1, 1, 0.03, 'very-low'),
  ('C793', 'Links', 4, 2, 'Wilrijk', 1, 1, 0.02, 'very-low'),
  ('C168', 'Links', 4, 3, 'Wilrijk', 1, 1, 0.01, 'very-low'),
  ('C350', 'Links', 4, 4, 'Wilrijk', 4, 1, 0.01, 'very-low'),
  ('C351', 'Links', 4, 5, 'Wilrijk', 4, 1, 0.01, 'very-low')
ON CONFLICT (case_type) DO NOTHING;

-- LINKS - Niveau 3
INSERT INTO grote_inpak_kanban_config (case_type, rek_sectie, rek_niveau, rek_kolom, productielocatie, stapel, posities, verbruik_per_dag, prioriteit)
VALUES
  ('C870', 'Links', 3, 1, 'Wilrijk', 1, 1, 0.21, 'very-low'),
  ('C859', 'Links', 3, 2, 'Wilrijk', 1, 1, 0.10, 'very-low'),
  ('C869', 'Links', 3, 3, 'Wilrijk', 1, 1, 0.09, 'very-low'),
  ('C853', 'Links', 3, 4, 'Wilrijk', 1, 1, 0.07, 'very-low'),
  ('C473', 'Links', 3, 5, 'Wilrijk', 1, 1, 0.06, 'very-low'),
  ('C624', 'Links', 3, 6, 'Wilrijk', 1, 1, 0.06, 'very-low'),
  ('C850', 'Links', 3, 7, 'Wilrijk', 1, 1, 0.04, 'very-low')
ON CONFLICT (case_type) DO NOTHING;

-- LINKS - Niveau 2
INSERT INTO grote_inpak_kanban_config (case_type, rek_sectie, rek_niveau, rek_kolom, productielocatie, stapel, posities, verbruik_per_dag, prioriteit)
VALUES
  ('C650', 'Links', 2, 1, 'Wilrijk', 1, 1, 0.10, 'low'),
  ('C833', 'Links', 2, 2, 'Wilrijk', 1, 1, 0.14, 'low'),
  ('C846', 'Links', 2, 3, 'Wilrijk', 1, 1, 0.14, 'low'),
  ('C848', 'Links', 2, 4, 'Wilrijk', 1, 1, 0.17, 'low'),
  ('C847', 'Links', 2, 5, 'Wilrijk', 1, 1, 0.10, 'low'),
  ('C840', 'Links', 2, 6, 'Wilrijk', 1, 1, 0.12, 'low'),
  ('C849', 'Links', 2, 7, 'Wilrijk', 1, 1, 0.09, 'low'),
  ('C845', 'Links', 2, 8, 'Wilrijk', 1, 1, 0.09, 'low')
ON CONFLICT (case_type) DO NOTHING;

-- LINKS - Niveau 1 (grond)
INSERT INTO grote_inpak_kanban_config (case_type, rek_sectie, rek_niveau, rek_kolom, productielocatie, stapel, posities, verbruik_per_dag, prioriteit)
VALUES
  ('C592', 'Links', 1, 1, 'Genk',   8, 2, 2.18, 'critical'),
  ('C509', 'Links', 1, 3, 'Wilrijk', 1, 1, 2.00, 'critical'),
  ('C789', 'Links', 1, 4, 'Wilrijk', 1, 1, 2.00, 'critical'),
  ('C882', 'Links', 1, 5, 'Genk',   7, 2, 1.56, 'critical'),
  ('C165', 'Links', 1, 7, 'Wilrijk', 5, 2, 1.42, 'high')
ON CONFLICT (case_type) DO NOTHING;

-- RECHTS - Niveau 4 (hoogste)
INSERT INTO grote_inpak_kanban_config (case_type, rek_sectie, rek_niveau, rek_kolom, productielocatie, stapel, posities, verbruik_per_dag, prioriteit)
VALUES
  ('C201', 'Rechts', 4, 1, 'Wilrijk', 2, 1, 0.12, 'low'),
  ('C202', 'Rechts', 4, 2, 'Wilrijk', 4, 1, 0.12, 'low'),
  ('C147', 'Rechts', 4, 3, 'Wilrijk', 1, 1, 0.12, 'low'),
  ('C775', 'Rechts', 4, 4, 'Wilrijk', 1, 1, 0.18, 'very-low'),
  ('C835', 'Rechts', 4, 5, 'Wilrijk', 1, 1, 0.08, 'very-low'),
  ('C791', 'Rechts', 4, 6, 'Wilrijk', 1, 1, 0.07, 'very-low'),
  ('C507', 'Rechts', 4, 7, 'Wilrijk', 1, 1, 0.06, 'very-low'),
  ('C851', 'Rechts', 4, 8, 'Wilrijk', 1, 1, 0.04, 'very-low')
ON CONFLICT (case_type) DO NOTHING;

-- RECHTS - Niveau 3
INSERT INTO grote_inpak_kanban_config (case_type, rek_sectie, rek_niveau, rek_kolom, productielocatie, stapel, posities, verbruik_per_dag, prioriteit)
VALUES
  ('C167', 'Rechts', 3, 1, 'Wilrijk', 5, 1, 0.26, 'low'),
  ('C200', 'Rechts', 3, 2, 'Wilrijk', 4, 1, 0.23, 'low'),
  ('C640', 'Rechts', 3, 3, 'Wilrijk', 1, 1, 0.21, 'low'),
  ('C651', 'Rechts', 3, 4, 'Wilrijk', 1, 1, 0.17, 'low'),
  ('C722', 'Rechts', 3, 5, 'Wilrijk', 1, 1, 0.15, 'low'),
  ('C837', 'Rechts', 3, 6, 'Wilrijk', 1, 1, 0.15, 'low'),
  ('C142', 'Rechts', 3, 7, 'Wilrijk', 1, 1, 0.14, 'low'),
  ('C725', 'Rechts', 3, 8, 'Wilrijk', 1, 1, 0.13, 'low')
ON CONFLICT (case_type) DO NOTHING;

-- RECHTS - Niveau 2
INSERT INTO grote_inpak_kanban_config (case_type, rek_sectie, rek_niveau, rek_kolom, productielocatie, stapel, posities, verbruik_per_dag, prioriteit)
VALUES
  ('C886', 'Rechts', 2, 1, 'Genk',   8,  1, 0.70, 'high'),
  ('C593', 'Rechts', 2, 2, 'Genk',   10, 1, 0.69, 'medium'),
  ('C670', 'Rechts', 2, 3, 'Genk',   4,  1, 0.62, 'medium'),
  ('C166', 'Rechts', 2, 4, 'Wilrijk', 5, 1, 0.52, 'medium'),
  ('C830', 'Rechts', 2, 5, 'Wilrijk', 1, 1, 0.44, 'medium'),
  ('C660', 'Rechts', 2, 6, 'Wilrijk', 1, 1, 0.37, 'medium'),
  ('C549', 'Rechts', 2, 7, 'Wilrijk', 1, 1, 0.33, 'medium'),
  ('C548', 'Rechts', 2, 8, 'Wilrijk', 1, 1, 0.29, 'medium')
ON CONFLICT (case_type) DO NOTHING;

-- RECHTS - Niveau 1 (grond)
INSERT INTO grote_inpak_kanban_config (case_type, rek_sectie, rek_niveau, rek_kolom, productielocatie, stapel, posities, verbruik_per_dag, prioriteit)
VALUES
  ('C883', 'Rechts', 1, 1, 'Genk',   10, 1, 1.11, 'high'),
  ('C887', 'Rechts', 1, 2, 'Genk',   8,  1, 1.11, 'high'),
  ('C790', 'Rechts', 1, 3, 'Wilrijk', 1, 1, 1.00, 'high'),
  ('C479', 'Rechts', 1, 4, 'Wilrijk', 1, 1, 1.00, 'high'),
  ('C508', 'Rechts', 1, 5, 'Wilrijk', 1, 1, 1.00, 'high'),
  ('C233', 'Rechts', 1, 6, 'Genk',   6,  1, 0.95, 'high'),
  ('C234', 'Rechts', 1, 7, 'Genk',   6,  1, 0.89, 'high'),
  ('C792', 'Rechts', 1, 8, 'Wilrijk', 1, 1, 0.71, 'high')
ON CONFLICT (case_type) DO NOTHING;
