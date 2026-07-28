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
  station.name,
  station.stream_url,
  null,
  station.genre,
  'US',
  true
from (
  values
    ('Gestify Ambiente', 'https://stream.radioparadise.com/mp3-128', 'Salão'),
    ('Gestify Lounge', 'https://stream.radioparadise.com/mellow-128', 'Lounge'),
    ('Gestify Rock', 'https://stream.radioparadise.com/rock-128', 'Cozinha'),
    ('Gestify Global', 'https://stream.radioparadise.com/global-128', 'Escritório')
) as station(name, stream_url, genre)
where not exists (
  select 1
  from public.music_radio_stations existing
  where existing.establishment_id is null
    and existing.stream_url = station.stream_url
);

notify pgrst, 'reload schema';

commit;
