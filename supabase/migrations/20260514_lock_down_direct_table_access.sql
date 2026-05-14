do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'artikels',
    'audit_logs',
    'bc_item_mapping',
    'lumipaper_imports',
    'grote_inpak_forecast_changes',
    'tv_screens',
    'tv_screen_slides',
    'tv_slides',
    'tv_transport_entries'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists %I on public.%I', 'Allow all for ' || table_name, table_name);
      execute format('drop policy if exists %I on public.%I', 'Allow all for authenticated users', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
      execute format(
        'create policy %I on public.%I for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()))',
        table_name || '_admin_all',
        table_name
      );
    end if;
  end loop;
end $$;
