-- Runtime setup for the operational notifications engine.
-- Enables Realtime publication, adds compatibility columns and schedules periodic alert checks when pg_cron is available.

create extension if not exists pgcrypto;

-- Keep compatibility with the previous preferences table used by the app, if it exists.
do $$
begin
  if to_regclass('public.user_notification_preferences') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_notification_preferences'
        and column_name = 'sound_notifications'
    ) then
      alter table public.user_notification_preferences
        add column sound_notifications boolean not null default true;
    end if;
  end if;
end $$;

-- Make sure Realtime can listen to notifications.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
exception
  when undefined_table then
    raise notice 'notifications table not found yet. Apply 202605250210_notifications_engine.sql first.';
  when duplicate_object then
    null;
  when others then
    raise notice 'Could not add public.notifications to supabase_realtime: %', sqlerrm;
end $$;

-- Helper function for manual and scheduled execution.
create or replace function public.run_operational_notification_checks()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select public.run_notification_checks() into v_result;

  insert into public.notifications (
    type,
    priority,
    title,
    message,
    payload,
    dedupe_key
  ) values (
    'notification_checks_ran',
    'info',
    'Verificação automática concluída',
    'As regras de alerta operacional foram verificadas.',
    jsonb_build_object('result', v_result, 'checked_at', now()),
    'notification_checks_ran:' || to_char(now(), 'YYYY-MM-DD-HH24-MI')
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return v_result;
end;
$$;

-- Schedule checks every 15 minutes when pg_cron is available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('operational-notification-checks');
  end if;
exception
  when others then
    null;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'operational-notification-checks',
      '*/15 * * * *',
      $$ select public.run_operational_notification_checks(); $$
    );
  else
    raise notice 'pg_cron is not enabled. Enable Supabase Cron or call public.run_operational_notification_checks() from the app/API.';
  end if;
exception
  when others then
    raise notice 'Could not schedule operational-notification-checks: %', sqlerrm;
end $$;
