begin;

-- Phase 1 hardening for production readiness:
-- - lock down public radio stations with RLS and narrow grants;
-- - remove anonymous SQL grants from dashboard/business tables;
-- - add missing FK integrity and indexes for new RH/player tables;
-- - quarantine the operational product-cost backup from public API roles;
-- - keep service_role available for trusted server-side flows.

revoke all privileges on table public.music_radio_stations from anon;
revoke all privileges on table public.music_radio_stations from authenticated;
grant select, insert, update, delete on table public.music_radio_stations to authenticated;
grant select, insert, update, delete on table public.music_radio_stations to service_role;

alter table public.music_radio_stations enable row level security;
alter table public.music_radio_stations force row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'music_radio_stations_establishment_id_fkey'
      and conrelid = 'public.music_radio_stations'::regclass
  ) then
    alter table public.music_radio_stations
      add constraint music_radio_stations_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete cascade;
  end if;
end $$;

create index if not exists music_radio_stations_active_global_idx
  on public.music_radio_stations (is_active, name)
  where establishment_id is null;

create index if not exists music_radio_stations_establishment_active_idx
  on public.music_radio_stations (establishment_id, is_active, name)
  where establishment_id is not null;

drop policy if exists "music_radio_stations_member_select" on public.music_radio_stations;
create policy "music_radio_stations_member_select"
on public.music_radio_stations
for select
to authenticated
using (
  is_active
  and (
    establishment_id is null
    or (select private.gestify_is_establishment_member(establishment_id))
  )
);

drop policy if exists "music_radio_stations_admin_insert" on public.music_radio_stations;
create policy "music_radio_stations_admin_insert"
on public.music_radio_stations
for insert
to authenticated
with check (
  establishment_id is not null
  and (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
);

drop policy if exists "music_radio_stations_admin_update" on public.music_radio_stations;
create policy "music_radio_stations_admin_update"
on public.music_radio_stations
for update
to authenticated
using (
  establishment_id is not null
  and (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
)
with check (
  establishment_id is not null
  and (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
);

drop policy if exists "music_radio_stations_admin_delete" on public.music_radio_stations;
create policy "music_radio_stations_admin_delete"
on public.music_radio_stations
for delete
to authenticated
using (
  establishment_id is not null
  and (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
);

drop policy if exists "music_radio_stations_admin_write" on public.music_radio_stations;

-- Dashboard/business data should never be directly accessible with the anon role.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers',
    'inventory_count_items',
    'inventory_counts',
    'inventory_labels',
    'order_billing_drafts',
    'order_status_events',
    'orders',
    'stock_movements',
    'technical_sheets',
    'music_player_settings',
    'user_module_permissions',
    'inventory_sessions',
    'stock_balances'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all privileges on table public.%I from anon', table_name);
    end if;
  end loop;
end $$;

-- Keep authenticated SQL grants narrow on tables currently used through the browser/client.
grant select on table public.user_module_permissions to authenticated;
grant select, insert, update, delete on table public.inventory_sessions to authenticated;
grant select, insert, update, delete on table public.stock_balances to authenticated;
grant select, insert, update, delete on table public.music_player_settings to authenticated;
grant select, insert, update, delete on table public.technical_sheets to authenticated;

-- Server-side maintenance/RPCs.
grant execute on function public.run_operational_notification_checks() to service_role;
grant execute on function public.run_notification_checks() to service_role;

-- New RH/player FK integrity and indexes.
do $$
begin
  if to_regclass('public.hr_time_clock_settings') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'hr_time_clock_settings_establishment_id_fkey'
         and conrelid = 'public.hr_time_clock_settings'::regclass
     ) then
    alter table public.hr_time_clock_settings
      add constraint hr_time_clock_settings_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete cascade;
  end if;

  if to_regclass('public.hr_employee_face_profiles') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'hr_employee_face_profiles_establishment_id_fkey'
         and conrelid = 'public.hr_employee_face_profiles'::regclass
     ) then
    alter table public.hr_employee_face_profiles
      add constraint hr_employee_face_profiles_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete cascade;
  end if;

  if to_regclass('public.hr_time_clock_shifts') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'hr_time_clock_shifts_establishment_id_fkey'
         and conrelid = 'public.hr_time_clock_shifts'::regclass
     ) then
    alter table public.hr_time_clock_shifts
      add constraint hr_time_clock_shifts_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete cascade;
  end if;

  if to_regclass('public.hr_time_clock_events') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'hr_time_clock_events_establishment_id_fkey'
         and conrelid = 'public.hr_time_clock_events'::regclass
     ) then
    alter table public.hr_time_clock_events
      add constraint hr_time_clock_events_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete cascade;
  end if;

  if to_regclass('public.hr_time_clock_adjustments') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'hr_time_clock_adjustments_establishment_id_fkey'
         and conrelid = 'public.hr_time_clock_adjustments'::regclass
     ) then
    alter table public.hr_time_clock_adjustments
      add constraint hr_time_clock_adjustments_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete cascade;
  end if;
end $$;

create index if not exists hr_employee_face_profiles_user_id_idx
  on public.hr_employee_face_profiles (user_id);
create index if not exists hr_employee_face_profiles_created_by_idx
  on public.hr_employee_face_profiles (created_by)
  where created_by is not null;
create index if not exists hr_employee_face_profiles_updated_by_idx
  on public.hr_employee_face_profiles (updated_by)
  where updated_by is not null;

create index if not exists hr_time_clock_events_user_id_idx
  on public.hr_time_clock_events (user_id);
create index if not exists hr_time_clock_events_face_match_user_id_idx
  on public.hr_time_clock_events (face_match_user_id)
  where face_match_user_id is not null;
create index if not exists hr_time_clock_events_created_by_idx
  on public.hr_time_clock_events (created_by)
  where created_by is not null;
create index if not exists hr_time_clock_events_shift_id_idx
  on public.hr_time_clock_events (shift_id);

create index if not exists hr_time_clock_shifts_user_id_idx
  on public.hr_time_clock_shifts (user_id);
create index if not exists hr_time_clock_shifts_created_by_idx
  on public.hr_time_clock_shifts (created_by);

-- hr_time_clock_adjustments has two historical shapes in deployed projects.
-- Index whichever FK columns are actually present so both legacy Production and
-- fresh replay remain valid without silently changing either data model.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hr_time_clock_adjustments'
      and column_name = 'user_id'
  ) then
    execute 'create index if not exists hr_time_clock_adjustments_user_id_idx on public.hr_time_clock_adjustments (user_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hr_time_clock_adjustments'
      and column_name = 'created_by'
  ) then
    execute 'create index if not exists hr_time_clock_adjustments_created_by_idx on public.hr_time_clock_adjustments (created_by)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hr_time_clock_adjustments'
      and column_name = 'target_user_id'
  ) then
    execute 'create index if not exists hr_time_clock_adjustments_target_user_id_idx on public.hr_time_clock_adjustments (target_user_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hr_time_clock_adjustments'
      and column_name = 'actor_user_id'
  ) then
    execute 'create index if not exists hr_time_clock_adjustments_actor_user_id_idx on public.hr_time_clock_adjustments (actor_user_id)';
  end if;
end $$;

create index if not exists music_player_settings_created_by_idx
  on public.music_player_settings (created_by)
  where created_by is not null;
create index if not exists music_player_settings_updated_by_idx
  on public.music_player_settings (updated_by)
  where updated_by is not null;

-- Remove only truly duplicate/redundant indexes.
drop index if exists public.hr_employee_face_profiles_establishment_idx;
drop index if exists public.idx_technical_sheet_ingredients_sheet;
drop index if exists public.idx_technical_sheet_scales_sheet;
drop index if exists public.user_module_permissions_establishment_user_module_unique;

-- Quarantine operational backup table from public Data API roles.
do $$
begin
  if to_regclass('public.products_cost_backup_20260527') is not null then
    revoke all privileges on table public.products_cost_backup_20260527 from anon;
    revoke all privileges on table public.products_cost_backup_20260527 from authenticated;
    grant select on table public.products_cost_backup_20260527 to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;