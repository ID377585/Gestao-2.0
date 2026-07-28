begin;

create table if not exists public.music_player_settings (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null unique references public.establishments(id) on delete cascade,
  enabled boolean not null default false,
  station_name text not null default 'Rádio do estabelecimento',
  stream_url text null,
  logo_url text null,
  genre text null,
  default_volume numeric(4,3) not null default 0.650,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint music_player_settings_volume_check
    check (default_volume >= 0 and default_volume <= 1),
  constraint music_player_settings_station_name_check
    check (char_length(btrim(station_name)) between 1 and 120),
  constraint music_player_settings_stream_url_check
    check (stream_url is null or stream_url ~* '^https://'),
  constraint music_player_settings_logo_url_check
    check (logo_url is null or logo_url ~* '^https://')
);

create index if not exists music_player_settings_establishment_idx
  on public.music_player_settings(establishment_id);

alter table public.music_player_settings enable row level security;
alter table public.music_player_settings force row level security;

revoke all privileges on table public.music_player_settings from anon;
grant select, insert, update, delete on table public.music_player_settings to authenticated;
grant all privileges on table public.music_player_settings to service_role;

drop policy if exists "music_player_settings_member_select" on public.music_player_settings;
drop policy if exists "music_player_settings_admin_insert" on public.music_player_settings;
drop policy if exists "music_player_settings_admin_update" on public.music_player_settings;
drop policy if exists "music_player_settings_admin_delete" on public.music_player_settings;

create policy "music_player_settings_member_select"
on public.music_player_settings
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

create policy "music_player_settings_admin_insert"
on public.music_player_settings
for insert
to authenticated
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

create policy "music_player_settings_admin_update"
on public.music_player_settings
for update
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])))
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

create policy "music_player_settings_admin_delete"
on public.music_player_settings
for delete
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

drop trigger if exists trg_music_player_settings_updated_at on public.music_player_settings;
create trigger trg_music_player_settings_updated_at
before update on public.music_player_settings
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

commit;
