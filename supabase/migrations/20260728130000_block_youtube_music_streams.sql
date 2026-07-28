begin;

update public.music_radio_stations
set is_active = false
where stream_url ~* '(youtube\.com|youtu\.be)';

with default_radio as (
  select id, name, stream_url, logo_url, genre
  from public.music_radio_stations
  where establishment_id is null
    and stream_url = 'https://stream.radioparadise.com/mp3-128'
    and is_active is true
  limit 1
)
update public.music_player_settings settings
set
  enabled = true,
  default_station_id = default_radio.id,
  station_name = default_radio.name,
  stream_url = default_radio.stream_url,
  logo_url = default_radio.logo_url,
  genre = default_radio.genre
from default_radio
where settings.stream_url ~* '(youtube\.com|youtu\.be)'
  or not exists (
    select 1
    from public.music_radio_stations station
    where station.id = settings.default_station_id
      and station.is_active is true
  );

alter table public.music_radio_stations
  drop constraint if exists music_radio_stations_no_active_youtube_stream,
  add constraint music_radio_stations_no_active_youtube_stream
    check (
      is_active is not true
      or stream_url !~* '(youtube\.com|youtu\.be)'
    );

alter table public.music_player_settings
  drop constraint if exists music_player_settings_no_youtube_stream,
  add constraint music_player_settings_no_youtube_stream
    check (
      stream_url is null
      or stream_url !~* '(youtube\.com|youtu\.be)'
    );

notify pgrst, 'reload schema';

commit;
