begin;

alter table public.user_module_permissions
  drop constraint if exists user_module_permissions_module_key_check;

alter table public.user_module_permissions
  add constraint user_module_permissions_module_key_check check (
    module_key in (
      'operacao',
      'estoque',
      'engenharia',
      'compras',
      'fiscal',
      'financeiro',
      'rh',
      'administracao'
    )
  );

insert into public.user_module_permissions (
  establishment_id,
  user_id,
  module_key,
  can_access,
  updated_by
)
select
  m.establishment_id,
  m.user_id,
  'rh',
  case when m.role = 'cliente' then false else true end,
  null
from public.memberships m
where m.establishment_id is not null
  and m.is_active = true
  and exists (
    select 1
    from public.establishments e
    where e.id = m.establishment_id
  )
on conflict (establishment_id, user_id, module_key) do nothing;

create table if not exists public.hr_time_clock_settings (
  establishment_id uuid primary key references public.establishments(id) on delete cascade,
  enabled boolean not null default true,
  daily_minutes integer not null default 480,
  break_minutes integer not null default 60,
  tolerance_minutes integer not null default 10,
  timezone text not null default 'America/Sao_Paulo',
  allow_overnight boolean not null default true,
  max_shift_hours integer not null default 20,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_time_clock_settings_daily_minutes_check
    check (daily_minutes between 1 and 1440),
  constraint hr_time_clock_settings_break_minutes_check
    check (break_minutes between 0 and 480),
  constraint hr_time_clock_settings_tolerance_minutes_check
    check (tolerance_minutes between 0 and 120),
  constraint hr_time_clock_settings_max_shift_hours_check
    check (max_shift_hours between 1 and 36),
  constraint hr_time_clock_settings_timezone_check
    check (char_length(btrim(timezone)) between 1 and 80)
);

create table if not exists public.hr_time_clock_events (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_id uuid not null,
  work_date date not null,
  event_type text not null,
  occurred_at timestamptz not null default clock_timestamp(),
  source text not null default 'web',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint hr_time_clock_events_event_type_check
    check (event_type in ('clock_in', 'break_start', 'break_end', 'clock_out')),
  constraint hr_time_clock_events_source_check
    check (source in ('web', 'mobile', 'tablet', 'admin', 'import')),
  constraint hr_time_clock_events_shift_event_unique
    unique (shift_id, event_type)
);

create table if not exists public.hr_time_clock_adjustments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_id uuid null,
  work_date date not null,
  adjustment_minutes integer not null,
  reason text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint hr_time_clock_adjustments_minutes_check
    check (adjustment_minutes between -1440 and 1440 and adjustment_minutes <> 0),
  constraint hr_time_clock_adjustments_reason_check
    check (char_length(btrim(reason)) between 5 and 500)
);

create index if not exists hr_time_clock_events_user_date_idx
  on public.hr_time_clock_events(establishment_id, user_id, work_date desc, occurred_at desc);

create index if not exists hr_time_clock_events_shift_idx
  on public.hr_time_clock_events(establishment_id, shift_id, occurred_at);

create index if not exists hr_time_clock_adjustments_user_date_idx
  on public.hr_time_clock_adjustments(establishment_id, user_id, work_date desc);

alter table public.hr_time_clock_settings enable row level security;
alter table public.hr_time_clock_settings force row level security;
alter table public.hr_time_clock_events enable row level security;
alter table public.hr_time_clock_events force row level security;
alter table public.hr_time_clock_adjustments enable row level security;
alter table public.hr_time_clock_adjustments force row level security;

revoke all privileges on table public.hr_time_clock_settings from anon;
revoke all privileges on table public.hr_time_clock_events from anon;
revoke all privileges on table public.hr_time_clock_adjustments from anon;

grant select, insert, update, delete on table public.hr_time_clock_settings to authenticated;
grant select on table public.hr_time_clock_events to authenticated;
grant select on table public.hr_time_clock_adjustments to authenticated;
grant all privileges on table public.hr_time_clock_settings to service_role;
grant all privileges on table public.hr_time_clock_events to service_role;
grant all privileges on table public.hr_time_clock_adjustments to service_role;

drop policy if exists "hr_time_clock_settings_member_select" on public.hr_time_clock_settings;
drop policy if exists "hr_time_clock_settings_admin_insert" on public.hr_time_clock_settings;
drop policy if exists "hr_time_clock_settings_admin_update" on public.hr_time_clock_settings;
drop policy if exists "hr_time_clock_settings_admin_delete" on public.hr_time_clock_settings;

create policy "hr_time_clock_settings_member_select"
on public.hr_time_clock_settings
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

create policy "hr_time_clock_settings_admin_insert"
on public.hr_time_clock_settings
for insert
to authenticated
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

create policy "hr_time_clock_settings_admin_update"
on public.hr_time_clock_settings
for update
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])))
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

create policy "hr_time_clock_settings_admin_delete"
on public.hr_time_clock_settings
for delete
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

drop policy if exists "hr_time_clock_events_own_or_admin_select" on public.hr_time_clock_events;
create policy "hr_time_clock_events_own_or_admin_select"
on public.hr_time_clock_events
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
);

drop policy if exists "hr_time_clock_adjustments_own_or_admin_select" on public.hr_time_clock_adjustments;
create policy "hr_time_clock_adjustments_own_or_admin_select"
on public.hr_time_clock_adjustments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
);

drop trigger if exists trg_hr_time_clock_settings_updated_at on public.hr_time_clock_settings;
create trigger trg_hr_time_clock_settings_updated_at
before update on public.hr_time_clock_settings
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

commit;
