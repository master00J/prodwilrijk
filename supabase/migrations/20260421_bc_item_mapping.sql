-- Mapping tussen oude en nieuwe Business Central artikelnummers.
-- Kolom A van de mapping-Excel (oud) → old_code
-- Kolom B (nieuw, huidige BC-omgeving)   → new_code
-- Kolom C (vrije beschrijving)           → description
--
-- De DB blijft oude codes bewaren; bij weergave in de frontend wordt elke code
-- live vertaald naar het nieuwe nummer via deze tabel (en het oude nummer wordt
-- als hover/tooltip getoond).

create table if not exists bc_item_mapping (
  old_code text primary key,
  new_code text not null,
  description text,
  updated_at timestamptz not null default now()
);

create index if not exists bc_item_mapping_new_code_idx on bc_item_mapping(new_code);
