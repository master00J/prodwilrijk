alter table if exists public.grote_inpak_packed
add column if not exists case_type varchar(50);
