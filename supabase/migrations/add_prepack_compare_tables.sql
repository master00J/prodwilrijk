create table if not exists public.prepack_sessions (
  id bigserial primary key,
  day date not null,
  label text,
  bc_employee_id bigint references public.employees(id) on delete set null,
  web_employee_id bigint references public.employees(id) on delete set null,
  bc_total integer default 0,
  web_total integer default 0,
  only_in_bc integer default 0,
  only_in_web integer default 0,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.prepack_scans (
  id bigserial primary key,
  ts varchar(64),
  code varchar(255) not null,
  location varchar(255),
  note text,
  employee_id bigint references public.employees(id) on delete set null,
  session_id bigint references public.prepack_sessions(id) on delete set null,
  created_at timestamp with time zone default now()
);

create table if not exists public.prepack_session_diffs (
  id bigserial primary key,
  session_id bigint references public.prepack_sessions(id) on delete cascade,
  pac varchar(255) not null,
  side varchar(20) not null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_prepack_scans_created_at on public.prepack_scans(created_at);
create index if not exists idx_prepack_scans_code on public.prepack_scans(code);
create index if not exists idx_prepack_scans_session_id on public.prepack_scans(session_id);
create index if not exists idx_prepack_sessions_day on public.prepack_sessions(day);
create index if not exists idx_prepack_session_diffs_session_id on public.prepack_session_diffs(session_id);
create index if not exists idx_prepack_session_diffs_side on public.prepack_session_diffs(side);
