-- Stock telling (snelle voorraad-scan met labels)
create table if not exists stock_count_sessions (
  id bigserial primary key,
  name text not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  created_by text,
  closed_at timestamptz,
  note text
);

create index if not exists stock_count_sessions_status_idx on stock_count_sessions(status);
create index if not exists stock_count_sessions_created_idx on stock_count_sessions(created_at desc);

create table if not exists stock_count_scans (
  id bigserial primary key,
  session_id bigint not null references stock_count_sessions(id) on delete cascade,
  item_number text not null,
  pallet_number text,
  quantity integer not null default 1 check (quantity >= 0),
  description text,
  label_type text,
  source text not null default 'camera' check (source in ('camera','manual','edit')),
  raw_label jsonb,
  photo_data_url text,
  note text,
  duplicate_of bigint references stock_count_scans(id) on delete set null,
  scanned_at timestamptz not null default now(),
  scanned_by text
);

create index if not exists stock_count_scans_session_idx on stock_count_scans(session_id, scanned_at desc);
create index if not exists stock_count_scans_item_pallet_idx on stock_count_scans(session_id, item_number, pallet_number);
