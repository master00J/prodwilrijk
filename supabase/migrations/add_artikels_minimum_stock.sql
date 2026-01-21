alter table if exists public.artikels
add column if not exists minimum_stock integer default 0;
