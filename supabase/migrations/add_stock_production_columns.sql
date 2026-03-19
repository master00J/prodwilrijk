alter table if exists public.grote_inpak_stock
add column if not exists stock integer default 0,
add column if not exists inkoop integer default 0,
add column if not exists productie integer default 0,
add column if not exists in_transfer integer default 0,
add column if not exists kistnummer varchar(50);
