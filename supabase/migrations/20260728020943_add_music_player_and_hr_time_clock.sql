begin;

create extension if not exists pgcrypto;

create table if not exists public.music_radio_stations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid null,
  name text not null,
  stream_url text not null,
  logo_url text null,
  genre text null,
  country text null default 'BR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint music_radio_stations_name_check check (char_length(btrim(name)) > 0),
  constraint music_radio_stations_stream_url_check check (stream_url ~* '^https?://')
);

create table if not exists public.music_player_settings (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null unique,
  enabled boolean not null default false,
  default_station_id uuid null references public.music_radio_stations(id) on delete set null,
  autoplay boolean not null default false,
  default_volume numeric(4, 3) not null default 0.6,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint music_player_settings_volume_check check (default_volume >= 0 and default_volume <= 1)
);

alter table if exists public.music_player_settings
  add column if not exists station_name text not null default 'Rádio do estabelecimento',
  add column if not exists stream_url text null,
  add column if not exists logo_url text null,
  add column if not exists genre text null,
  add column if not exists created_by uuid null references auth.users(id) on delete set null,
  add column if not exists updated_by uuid null references auth.users(id) on delete set null,
  add column if not exists default_station_id uuid null,
  add column if not exists autoplay boolean not null default false;

create table if not exists public.hr_time_clock_settings (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null unique,
  default_daily_minutes integer not null default 480,
  default_break_minutes integer not null default 60,
  tolerance_minutes integer not null default 10,
  timezone text not null default 'America/Sao_Paulo',
  require_selfie boolean not null default true,
  require_face_detection boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_time_clock_settings_daily_check check (default_daily_minutes between 1 and 1440),
  constraint hr_time_clock_settings_break_check check (default_break_minutes between 0 and 360),
  constraint hr_time_clock_settings_tolerance_check check (tolerance_minutes between 0 and 120)
);

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

create table if not exists public.hr_time_clock_shifts (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  status text not null default 'open',
  opened_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint hr_time_clock_shifts_status_check check (status in ('open', 'closed')),
  constraint hr_time_clock_shifts_closed_at_check check (
    (status = 'open' and closed_at is null)
    or (status = 'closed' and closed_at is not null)
  )
);

create table if not exists public.hr_time_clock_events (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_id uuid null references public.hr_time_clock_shifts(id) on delete restrict,
  work_date date not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  source text not null default 'web',
  note text null,
  selfie_path text null,
  selfie_mime_type text null,
  face_detection_status text not null default 'not_submitted',
  face_detection_method text null,
  face_count integer null,
  client_captured_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint hr_time_clock_events_event_type_check check (
    event_type in (
      'entrada',
      'saida_refeicao',
      'retorno_refeicao',
      'saida',
      'clock_in',
      'break_start',
      'break_end',
      'clock_out'
    )
  ),
  constraint hr_time_clock_events_source_check check (
    source in ('web', 'mobile', 'tablet', 'admin', 'admin_adjustment', 'import', 'system')
  ),
  constraint hr_time_clock_events_face_detection_status_check check (
    face_detection_status in ('not_submitted', 'verified', 'not_detected', 'multiple_faces', 'unsupported')
  ),
  constraint hr_time_clock_events_face_count_check check (face_count is null or face_count >= 0),
  constraint hr_time_clock_events_unique_day_type unique (
    establishment_id,
    user_id,
    work_date,
    event_type
  )
);

alter table if exists public.hr_time_clock_settings
  add column if not exists default_daily_minutes integer not null default 480,
  add column if not exists default_break_minutes integer not null default 60,
  add column if not exists require_selfie boolean not null default true,
  add column if not exists require_face_detection boolean not null default true;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hr_time_clock_settings'
      and column_name = 'daily_minutes'
  ) then
    update public.hr_time_clock_settings
    set default_daily_minutes = daily_minutes
    where daily_minutes is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hr_time_clock_settings'
      and column_name = 'break_minutes'
  ) then
    update public.hr_time_clock_settings
    set default_break_minutes = break_minutes
    where break_minutes is not null;
  end if;
end $$;

alter table if exists public.hr_time_clock_events
  add column if not exists shift_id uuid null references public.hr_time_clock_shifts(id) on delete restrict,
  add column if not exists note text null,
  add column if not exists selfie_path text null,
  add column if not exists selfie_mime_type text null,
  add column if not exists face_detection_status text not null default 'not_submitted',
  add column if not exists face_detection_method text null,
  add column if not exists face_count integer null,
  add column if not exists client_captured_at timestamptz null;

alter table if exists public.hr_time_clock_events
  drop constraint if exists hr_time_clock_events_event_type_check;

alter table if exists public.hr_time_clock_events
  add constraint hr_time_clock_events_event_type_check check (
    event_type in (
      'entrada',
      'saida_refeicao',
      'retorno_refeicao',
      'saida',
      'clock_in',
      'break_start',
      'break_end',
      'clock_out'
    )
  );

alter table if exists public.hr_time_clock_events
  drop constraint if exists hr_time_clock_events_source_check;

alter table if exists public.hr_time_clock_events
  add constraint hr_time_clock_events_source_check check (
    source in ('web', 'mobile', 'tablet', 'admin', 'admin_adjustment', 'import', 'system')
  );

create table if not exists public.hr_time_clock_adjustments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  event_id uuid null references public.hr_time_clock_events(id) on delete set null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  before_data jsonb null,
  after_data jsonb null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint hr_time_clock_adjustments_action_check check (
    action in ('create', 'update', 'delete', 'justify')
  ),
  constraint hr_time_clock_adjustments_reason_check check (char_length(btrim(reason)) >= 3)
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

create index if not exists music_radio_stations_establishment_idx
  on public.music_radio_stations(establishment_id, is_active);

create index if not exists hr_time_clock_events_user_day_idx
  on public.hr_time_clock_events(establishment_id, user_id, work_date, occurred_at);

create index if not exists hr_time_clock_events_recent_idx
  on public.hr_time_clock_events(establishment_id, user_id, occurred_at desc);

create index if not exists hr_time_clock_shifts_user_date_idx
  on public.hr_time_clock_shifts(establishment_id, user_id, work_date desc);

create unique index if not exists hr_time_clock_shifts_one_open_per_user_idx
  on public.hr_time_clock_shifts(establishment_id, user_id)
  where status = 'open';

create index if not exists hr_time_clock_adjustments_target_idx
  on public.hr_time_clock_adjustments(establishment_id, target_user_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'time-clock-selfies',
  'time-clock-selfies',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.music_radio_stations enable row level security;
alter table public.music_player_settings enable row level security;
alter table public.hr_time_clock_settings enable row level security;
alter table public.hr_employee_schedules enable row level security;
alter table public.hr_time_clock_shifts enable row level security;
alter table public.hr_time_clock_events enable row level security;
alter table public.hr_time_clock_adjustments enable row level security;
alter table public.hr_bank_hours enable row level security;
alter table public.hr_holidays enable row level security;

grant select on table public.music_radio_stations to authenticated;
grant select on table public.music_player_settings to authenticated;
grant select on table public.hr_time_clock_settings to authenticated;
grant select, insert, update on table public.hr_time_clock_shifts to authenticated;
grant select, insert on table public.hr_time_clock_events to authenticated;
grant select on table public.hr_employee_schedules to authenticated;
grant select on table public.hr_time_clock_adjustments to authenticated;
grant select on table public.hr_bank_hours to authenticated;
grant select on table public.hr_holidays to authenticated;

grant select, insert, update, delete on table public.music_radio_stations to service_role;
grant select, insert, update, delete on table public.music_player_settings to service_role;
grant select, insert, update, delete on table public.hr_time_clock_settings to service_role;
grant select, insert, update, delete on table public.hr_employee_schedules to service_role;
grant select, insert, update, delete on table public.hr_time_clock_shifts to service_role;
grant select, insert, update, delete on table public.hr_time_clock_events to service_role;
grant select, insert, update, delete on table public.hr_time_clock_adjustments to service_role;
grant select, insert, update, delete on table public.hr_bank_hours to service_role;
grant select, insert, update, delete on table public.hr_holidays to service_role;

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

drop policy if exists "music_radio_stations_admin_write" on public.music_radio_stations;
create policy "music_radio_stations_admin_write"
on public.music_radio_stations
for all
to authenticated
using (
  establishment_id is not null
  and (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
)
with check (
  establishment_id is not null
  and (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
);

drop policy if exists "music_player_settings_member_select" on public.music_player_settings;
create policy "music_player_settings_member_select"
on public.music_player_settings
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

drop policy if exists "music_player_settings_admin_write" on public.music_player_settings;
create policy "music_player_settings_admin_write"
on public.music_player_settings
for all
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])))
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

drop policy if exists "hr_time_clock_settings_member_select" on public.hr_time_clock_settings;
create policy "hr_time_clock_settings_member_select"
on public.hr_time_clock_settings
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

drop policy if exists "hr_time_clock_settings_admin_write" on public.hr_time_clock_settings;
create policy "hr_time_clock_settings_admin_write"
on public.hr_time_clock_settings
for all
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])))
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

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

drop policy if exists "hr_time_clock_shifts_select" on public.hr_time_clock_shifts;
create policy "hr_time_clock_shifts_select"
on public.hr_time_clock_shifts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.gestify_has_establishment_role(establishment_id, array['admin', 'operacao']::text[]))
);

drop policy if exists "hr_time_clock_shifts_insert_own" on public.hr_time_clock_shifts;
create policy "hr_time_clock_shifts_insert_own"
on public.hr_time_clock_shifts
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and created_by = (select auth.uid())
  and (select private.gestify_is_establishment_member(establishment_id))
);

drop policy if exists "hr_time_clock_shifts_update_own_close" on public.hr_time_clock_shifts;
create policy "hr_time_clock_shifts_update_own_close"
on public.hr_time_clock_shifts
for update
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
)
with check (
  user_id = (select auth.uid())
  or (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
);

drop policy if exists "hr_time_clock_events_select" on public.hr_time_clock_events;
create policy "hr_time_clock_events_select"
on public.hr_time_clock_events
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.gestify_has_establishment_role(establishment_id, array['admin', 'operacao']::text[]))
);

drop policy if exists "hr_time_clock_events_insert_own" on public.hr_time_clock_events;
create policy "hr_time_clock_events_insert_own"
on public.hr_time_clock_events
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and created_by = (select auth.uid())
  and (select private.gestify_is_establishment_member(establishment_id))
);

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

insert into public.hr_time_clock_settings (establishment_id)
select distinct m.establishment_id
from public.memberships m
where m.establishment_id is not null
on conflict (establishment_id) do nothing;

insert into public.music_player_settings (establishment_id)
select distinct m.establishment_id
from public.memberships m
where m.establishment_id is not null
on conflict (establishment_id) do nothing;

alter table public.user_module_permissions
  drop constraint if exists user_module_permissions_module_key_check;

alter table public.user_module_permissions
  add constraint user_module_permissions_module_key_check
  check (
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
  updated_at
)
select
  m.establishment_id,
  m.user_id,
  'rh',
  coalesce(m.role, 'cliente') <> 'cliente',
  now()
from public.memberships m
where m.establishment_id is not null
on conflict (establishment_id, user_id, module_key) do nothing;

notify pgrst, 'reload schema';

commit;
