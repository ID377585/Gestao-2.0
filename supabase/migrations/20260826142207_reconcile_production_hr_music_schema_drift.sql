begin;

create extension if not exists pgcrypto;

create table if not exists public.hr_employee_schedules (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null,
  scheduled_start time null,
  scheduled_end time null,
  break_minutes integer not null default 60,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_employee_schedules_weekday_check check (weekday between 0 and 6),
  constraint hr_employee_schedules_break_check check (break_minutes between 0 and 360),
  constraint hr_employee_schedules_unique unique (establishment_id, user_id, weekday)
);

create table if not exists public.hr_bank_hours (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  balance_minutes integer not null default 0,
  source text not null default 'time_clock',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_bank_hours_source_check check (source in ('time_clock', 'admin_adjustment', 'import')),
  constraint hr_bank_hours_unique unique (establishment_id, user_id, work_date)
);

create table if not exists public.hr_holidays (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  holiday_date date not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint hr_holidays_name_check check (char_length(btrim(name)) > 0),
  constraint hr_holidays_unique unique (establishment_id, holiday_date)
);

alter table public.hr_employee_schedules enable row level security;
alter table public.hr_bank_hours enable row level security;
alter table public.hr_holidays enable row level security;

revoke all on table public.hr_employee_schedules from anon, authenticated;
revoke all on table public.hr_bank_hours from anon, authenticated;
revoke all on table public.hr_holidays from anon, authenticated;

grant select, insert, update, delete on table public.hr_employee_schedules to authenticated;
grant select on table public.hr_bank_hours to authenticated;
grant select, insert, update, delete on table public.hr_holidays to authenticated;

grant select, insert, update, delete on table public.hr_employee_schedules to service_role;
grant select, insert, update, delete on table public.hr_bank_hours to service_role;
grant select, insert, update, delete on table public.hr_holidays to service_role;

drop policy if exists "hr_employee_schedules_member_select" on public.hr_employee_schedules;
create policy "hr_employee_schedules_member_select"
on public.hr_employee_schedules
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.gestify_has_establishment_role(establishment_id, array['admin', 'operacao']::text[]))
);

drop policy if exists "hr_employee_schedules_admin_write" on public.hr_employee_schedules;
create policy "hr_employee_schedules_admin_write"
on public.hr_employee_schedules
for all
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])))
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

drop policy if exists "hr_bank_hours_member_select" on public.hr_bank_hours;
create policy "hr_bank_hours_member_select"
on public.hr_bank_hours
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.gestify_has_establishment_role(establishment_id, array['admin', 'operacao']::text[]))
);

drop policy if exists "hr_holidays_member_select" on public.hr_holidays;
create policy "hr_holidays_member_select"
on public.hr_holidays
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

drop policy if exists "hr_holidays_admin_write" on public.hr_holidays;
create policy "hr_holidays_admin_write"
on public.hr_holidays
for all
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])))
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

alter table if exists public.hr_time_clock_events
  add column if not exists note text null;

alter table if exists public.hr_time_clock_events
  alter column shift_id drop not null,
  alter column created_by drop not null;

do $$
declare
  legacy_shape boolean;
  row_count bigint;
begin
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'hr_time_clock_adjustments'
        and column_name = 'user_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'hr_time_clock_adjustments'
        and column_name = 'adjustment_minutes'
    )
    and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'hr_time_clock_adjustments'
        and column_name = 'event_id'
    )
  into legacy_shape;

  if legacy_shape then
    select count(*) into row_count from public.hr_time_clock_adjustments;
    if row_count > 0 then
      raise exception 'GESTIFY_DRIFT_GUARD: hr_time_clock_adjustments legacy contract contains % row(s); reconciliation aborted', row_count;
    end if;
  end if;
end $$;

alter table if exists public.hr_time_clock_adjustments
  add column if not exists event_id uuid null references public.hr_time_clock_events(id) on delete set null,
  add column if not exists target_user_id uuid null references auth.users(id) on delete cascade,
  add column if not exists actor_user_id uuid null references auth.users(id) on delete restrict,
  add column if not exists action text null,
  add column if not exists before_data jsonb null,
  add column if not exists after_data jsonb null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='hr_time_clock_adjustments' and column_name='user_id'
  ) then
    alter table public.hr_time_clock_adjustments alter column user_id drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='hr_time_clock_adjustments' and column_name='work_date'
  ) then
    alter table public.hr_time_clock_adjustments alter column work_date drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='hr_time_clock_adjustments' and column_name='adjustment_minutes'
  ) then
    alter table public.hr_time_clock_adjustments alter column adjustment_minutes drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='hr_time_clock_adjustments' and column_name='created_by'
  ) then
    alter table public.hr_time_clock_adjustments alter column created_by drop not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hr_time_clock_adjustments'::regclass
      and conname = 'hr_time_clock_adjustments_action_check'
  ) then
    alter table public.hr_time_clock_adjustments
      add constraint hr_time_clock_adjustments_action_check
      check (action in ('create', 'update', 'delete', 'justify'));
  end if;
end $$;

alter table if exists public.hr_time_clock_adjustments
  alter column target_user_id set not null,
  alter column actor_user_id set not null,
  alter column action set not null;

alter table if exists public.hr_time_clock_adjustments enable row level security;

drop policy if exists "hr_time_clock_adjustments_own_or_admin_select" on public.hr_time_clock_adjustments;
drop policy if exists "hr_time_clock_adjustments_admin_select" on public.hr_time_clock_adjustments;
create policy "hr_time_clock_adjustments_admin_select"
on public.hr_time_clock_adjustments
for select
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin', 'operacao']::text[])));

drop policy if exists "hr_time_clock_adjustments_admin_insert" on public.hr_time_clock_adjustments;
create policy "hr_time_clock_adjustments_admin_insert"
on public.hr_time_clock_adjustments
for insert
to authenticated
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

create index if not exists idx_company_subscriptions_plan_slug
  on public.company_subscriptions (plan_slug);
create index if not exists idx_hr_bank_hours_user_id
  on public.hr_bank_hours (user_id);
create index if not exists idx_hr_employee_schedules_user_id
  on public.hr_employee_schedules (user_id);
create index if not exists idx_hr_time_clock_adjustments_event_id
  on public.hr_time_clock_adjustments (event_id);
create index if not exists idx_music_player_settings_default_station_id
  on public.music_player_settings (default_station_id);
create index if not exists idx_tenant_invitations_accepted_by
  on public.tenant_invitations (accepted_by);
create index if not exists idx_tenant_invitations_invited_by
  on public.tenant_invitations (invited_by);
create index if not exists idx_user_module_permissions_updated_by
  on public.user_module_permissions (updated_by);

commit;
