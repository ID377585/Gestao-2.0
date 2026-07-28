begin;

update public.music_radio_stations
set is_active = false
where establishment_id is null
  and stream_url in (
    'https://stream.radioparadise.com/mellow-128',
    'https://stream.radioparadise.com/rock-128',
    'https://stream.radioparadise.com/global-128'
  );

update public.music_radio_stations
set is_active = false
where stream_url ~* '(youtube\.com|youtu\.be)';

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
  station.name,
  station.stream_url,
  station.logo_url,
  station.genre,
  station.country,
  true
from (
  values
    (
      'Italian',
      'https://icy.unitedradio.it/um020.mp3',
      'https://www.unitedradio.it/favicon.ico',
      'Italia 70',
      'IT'
    ),
    (
      'Deep House',
      'https://stream.technolovers.fm/deep-house?ref=radiobrowser',
      null,
      'Technolovers Deep House',
      'DE'
    ),
    (
      'Eletrônicas',
      'https://dancewave.online/dance.mp3',
      'https://dancewave.online/dw_logo.png',
      'Dance Wave!',
      'HU'
    ),
    (
      'MPB',
      'https://stream-163.zeno.fm/mrutsyhkc3quv',
      'https://img.radios.com.br/radio/lg/radio112934_1562066435.png',
      'Rádio Joli MPB',
      'BR'
    ),
    (
      'Latino',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/XEJP_AM_SC',
      null,
      'El Fonógrafo',
      'MX'
    ),
    (
      'Clássica',
      'https://uk2.streamingpulse.com/ssl/vcr1',
      null,
      'Venice Classic Radio',
      'IT'
    ),
    (
      'Sertanejo',
      'https://sc4s.cdn.upx.com:8067/stream',
      'https://assets.clubefm.com.br/uploads/site/logo/2/106-sertaneja-4fff3e1f118ab621432fa4d74136e042e86b6eedbabf561ded0dfd61123d980e.png',
      'Sertaneja 106.7',
      'BR'
    ),
    (
      'Flashback',
      'https://stm4.voxhd.com.br:7086/;',
      'https://www.wix.com/favicon.ico',
      'Radio Amigos do Flashback',
      'BR'
    ),
    (
      'Pagode',
      'https://cast4.audiostream.com.br:2652/mp3',
      null,
      'Eldorado FM',
      'BR'
    ),
    (
      'Samba',
      'https://stm8.voxhd.com.br:8342/',
      null,
      'Rádio Amigos do Samba',
      'BR'
    )
) as station(name, stream_url, logo_url, genre, country)
where not exists (
  select 1
  from public.music_radio_stations existing
  where existing.establishment_id is null
    and existing.stream_url = station.stream_url
);

update public.music_radio_stations existing
set
  name = station.name,
  logo_url = station.logo_url,
  genre = station.genre,
  country = station.country,
  is_active = true
from (
  values
    (
      'Italian',
      'https://icy.unitedradio.it/um020.mp3',
      'https://www.unitedradio.it/favicon.ico',
      'Italia 70',
      'IT'
    ),
    (
      'Deep House',
      'https://stream.technolovers.fm/deep-house?ref=radiobrowser',
      null,
      'Technolovers Deep House',
      'DE'
    ),
    (
      'Eletrônicas',
      'https://dancewave.online/dance.mp3',
      'https://dancewave.online/dw_logo.png',
      'Dance Wave!',
      'HU'
    ),
    (
      'MPB',
      'https://stream-163.zeno.fm/mrutsyhkc3quv',
      'https://img.radios.com.br/radio/lg/radio112934_1562066435.png',
      'Rádio Joli MPB',
      'BR'
    ),
    (
      'Latino',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/XEJP_AM_SC',
      null,
      'El Fonógrafo',
      'MX'
    ),
    (
      'Clássica',
      'https://uk2.streamingpulse.com/ssl/vcr1',
      null,
      'Venice Classic Radio',
      'IT'
    ),
    (
      'Sertanejo',
      'https://sc4s.cdn.upx.com:8067/stream',
      'https://assets.clubefm.com.br/uploads/site/logo/2/106-sertaneja-4fff3e1f118ab621432fa4d74136e042e86b6eedbabf561ded0dfd61123d980e.png',
      'Sertaneja 106.7',
      'BR'
    ),
    (
      'Flashback',
      'https://stm4.voxhd.com.br:7086/;',
      'https://www.wix.com/favicon.ico',
      'Radio Amigos do Flashback',
      'BR'
    ),
    (
      'Pagode',
      'https://cast4.audiostream.com.br:2652/mp3',
      null,
      'Eldorado FM',
      'BR'
    ),
    (
      'Samba',
      'https://stm8.voxhd.com.br:8342/',
      null,
      'Rádio Amigos do Samba',
      'BR'
    )
) as station(name, stream_url, logo_url, genre, country)
where existing.establishment_id is null
  and existing.stream_url = station.stream_url;

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
where settings.default_station_id is null
  or settings.stream_url is null
  or settings.stream_url = ''
  or settings.stream_url ~* '(youtube\.com|youtu\.be)'
  or not exists (
    select 1
    from public.music_radio_stations station
    where station.id = settings.default_station_id
      and station.is_active is true
  );

notify pgrst, 'reload schema';

commit;
