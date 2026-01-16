create table if not exists public.grote_inpak_packed_settings (
  id integer primary key default 1,
  po_apf varchar(50),
  po_s4 varchar(50),
  po_s5 varchar(50),
  po_s9 varchar(50),
  po_xx varchar(50),
  po_indus varchar(50),
  indus_suffix varchar(20),
  updated_at timestamp with time zone default now()
);

insert into public.grote_inpak_packed_settings (id, po_apf, po_s4, po_s5, po_s9, po_xx, po_indus, indus_suffix)
values (1, 'MF-4536602', 'MF-4536602', 'MF-4536602', 'MF-4536602', '', 'MF-4581681', 'KC')
on conflict (id) do nothing;

alter table public.grote_inpak_packed_settings enable row level security;

drop policy if exists "Allow all for authenticated users" on public.grote_inpak_packed_settings;
create policy "Allow all for authenticated users" on public.grote_inpak_packed_settings
  for all
  using (true)
  with check (true);
