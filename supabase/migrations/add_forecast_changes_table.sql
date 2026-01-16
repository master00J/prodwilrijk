create table if not exists public.grote_inpak_forecast_changes (
  id bigserial primary key,
  case_label varchar(255) not null,
  case_type varchar(50),
  old_arrival_date date,
  new_arrival_date date,
  source_file varchar(255),
  changed_at timestamp with time zone default now()
);

create index if not exists idx_grote_inpak_forecast_changes_case_label
on public.grote_inpak_forecast_changes(case_label);

create index if not exists idx_grote_inpak_forecast_changes_changed_at
on public.grote_inpak_forecast_changes(changed_at);

alter table public.grote_inpak_forecast_changes enable row level security;

drop policy if exists "Allow all for authenticated users" on public.grote_inpak_forecast_changes;
create policy "Allow all for authenticated users" on public.grote_inpak_forecast_changes
  for all
  using (true)
  with check (true);
