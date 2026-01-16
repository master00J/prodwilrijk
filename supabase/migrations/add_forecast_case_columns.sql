alter table if exists public.grote_inpak_forecast
add column if not exists case_label varchar(255),
add column if not exists case_type varchar(50),
add column if not exists arrival_date date,
add column if not exists source_file varchar(255);

create unique index if not exists idx_grote_inpak_forecast_case_label
on public.grote_inpak_forecast(case_label);
