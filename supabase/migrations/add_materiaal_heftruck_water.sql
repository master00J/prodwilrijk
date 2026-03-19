create table if not exists public.heftruck_water_log (
  id bigserial primary key,
  employee_id bigint references public.employees(id) on delete set null,
  heftruck varchar(50) not null,
  filled_at timestamp with time zone not null,
  note text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_heftruck_water_log_filled_at on public.heftruck_water_log(filled_at);
create index if not exists idx_heftruck_water_log_employee on public.heftruck_water_log(employee_id);
