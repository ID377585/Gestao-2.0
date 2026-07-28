begin;

insert into public.music_radio_stations (
  establishment_id,
  name,
  stream_url,
  logo_url,
  genre,
  country,
  is_active
)
select
  null,
  'Radio Paradise',
  'https://stream.radioparadise.com/mp3-128',
  null,
  'Eclectic',
  'US',
  true
where not exists (
  select 1
  from public.music_radio_stations
  where establishment_id is null
    and stream_url = 'https://stream.radioparadise.com/mp3-128'
);

insert into public.music_player_settings (
  establishment_id,
  enabled,
  station_name,
  stream_url,
  genre,
  default_volume
)
select distinct
  m.establishment_id,
  true,
  'Radio Paradise',
  'https://stream.radioparadise.com/mp3-128',
  'Eclectic',
  0.650
from public.memberships m
join public.establishments e on e.id = m.establishment_id
where m.establishment_id is not null
on conflict (establishment_id) do update
set
  enabled = true,
  station_name = coalesce(nullif(public.music_player_settings.station_name, ''), excluded.station_name),
  stream_url = coalesce(public.music_player_settings.stream_url, excluded.stream_url),
  genre = coalesce(public.music_player_settings.genre, excluded.genre),
  default_volume = coalesce(public.music_player_settings.default_volume, excluded.default_volume),
  updated_at = now();

notify pgrst, 'reload schema';

commit;
