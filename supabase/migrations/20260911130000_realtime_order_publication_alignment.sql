-- Keep the Realtime publication aligned with the order subscriptions used by the app.
-- Additive only: no table rows or publication entries are removed.

do $$
begin
  if to_regclass('public.orders') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if to_regclass('public.order_status_events') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'order_status_events'
     ) then
    alter publication supabase_realtime add table public.order_status_events;
  end if;
end
$$;
