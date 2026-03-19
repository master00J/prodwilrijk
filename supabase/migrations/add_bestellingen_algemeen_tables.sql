create table if not exists public.artikels (
  id bigserial primary key,
  volledige_omschrijving text not null,
  artikelnummer varchar(255) not null
);

create index if not exists idx_artikels_omschrijving on public.artikels (volledige_omschrijving);
create index if not exists idx_artikels_artikelnummer on public.artikels (artikelnummer);

create table if not exists public.bestellingen_algemeen (
  id bigserial primary key,
  artikel_omschrijving text not null,
  artikelnummer varchar(255) not null,
  aantal integer not null,
  ontvangen boolean default false,
  created_at timestamp with time zone default now()
);
