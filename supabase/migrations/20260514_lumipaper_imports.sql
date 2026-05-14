create table if not exists lumipaper_imports (
  id uuid primary key default gen_random_uuid(),
  message_id text unique,
  order_number text not null,
  subject text,
  source_email text,
  source_file text,
  total_lines integer not null default 0,
  generated_files jsonb not null default '[]'::jsonb,
  parsed_lines jsonb not null default '[]'::jsonb,
  unmapped_lines jsonb not null default '[]'::jsonb,
  status text not null default 'processed',
  error text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lumipaper_imports_created_at
  on lumipaper_imports (created_at desc);

create index if not exists idx_lumipaper_imports_order_number
  on lumipaper_imports (order_number);
