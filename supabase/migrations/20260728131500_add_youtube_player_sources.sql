begin;

alter table public.music_radio_stations
  add column if not exists source_type text not null default 'stream',
  add column if not exists external_url text null,
  add column if not exists youtube_video_id text null,
  add column if not exists youtube_playlist_id text null;

alter table public.music_player_settings
  add column if not exists source_type text not null default 'stream',
  add column if not exists external_url text null,
  add column if not exists youtube_video_id text null,
  add column if not exists youtube_playlist_id text null;

update public.music_radio_stations
set
  source_type = 'stream',
  external_url = coalesce(external_url, stream_url)
where source_type is null
  or source_type = '';

update public.music_player_settings
set
  source_type = 'stream',
  external_url = coalesce(external_url, stream_url)
where source_type is null
  or source_type = '';

with parsed as (
  select
    id,
    stream_url as original_url,
    substring(
      stream_url
      from '(?:v=|youtu\.be/|embed/|shorts/|live/)([A-Za-z0-9_-]{6,32})'
    ) as video_id,
    case
      when stream_url ~* '[?&]start_radio=1'
        or substring(stream_url from '[?&]list=([A-Za-z0-9_-]{6,128})') ~* '^RD'
        then null
      else substring(stream_url from '[?&]list=([A-Za-z0-9_-]{6,128})')
    end as playlist_id,
    coalesce(
      substring(stream_url from '[?&](?:start|t)=([0-9]+)s?'),
      '0'
    ) as start_seconds
  from public.music_radio_stations
  where stream_url ~* '(youtube\.com|youtu\.be)'
)
update public.music_radio_stations station
set
  source_type = 'youtube',
  external_url = parsed.original_url,
  youtube_video_id = parsed.video_id,
  youtube_playlist_id = parsed.playlist_id,
  is_active = true,
  stream_url =
    case
      when parsed.video_id is not null then
        'https://www.youtube.com/embed/' || parsed.video_id ||
        '?feature=oembed&playsinline=1&rel=0' ||
        case
          when parsed.playlist_id is not null then '&list=' || parsed.playlist_id
          else ''
        end ||
        case
          when parsed.start_seconds::integer > 0 then
            '&start=' || parsed.start_seconds
          else ''
        end
      else
        'https://www.youtube.com/embed/videoseries?feature=oembed&playsinline=1&rel=0&list=' ||
        parsed.playlist_id
    end
from parsed
where station.id = parsed.id
  and (parsed.video_id is not null or parsed.playlist_id is not null);

alter table public.music_radio_stations
  drop constraint if exists music_radio_stations_no_active_youtube_stream,
  drop constraint if exists music_radio_stations_source_type_check,
  drop constraint if exists music_radio_stations_source_url_check,
  add constraint music_radio_stations_source_type_check
    check (source_type in ('stream', 'youtube')),
  add constraint music_radio_stations_source_url_check
    check (
      (
        source_type = 'stream'
        and stream_url like 'http%'
        and position('youtube.com' in lower(stream_url)) = 0
        and position('youtu.be' in lower(stream_url)) = 0
      )
      or (
        source_type = 'youtube'
        and stream_url like 'https://www.youtube.com/embed/%'
        and external_url like 'https://%'
        and (youtube_video_id is not null or youtube_playlist_id is not null)
      )
    );

alter table public.music_player_settings
  drop constraint if exists music_player_settings_no_youtube_stream,
  drop constraint if exists music_player_settings_source_type_check,
  drop constraint if exists music_player_settings_source_url_check,
  add constraint music_player_settings_source_type_check
    check (source_type in ('stream', 'youtube')),
  add constraint music_player_settings_source_url_check
    check (
      stream_url is null
      or (
        source_type = 'stream'
        and position('youtube.com' in lower(stream_url)) = 0
        and position('youtu.be' in lower(stream_url)) = 0
      )
      or (
        source_type = 'youtube'
        and stream_url like 'https://www.youtube.com/embed/%'
        and external_url like 'https://%'
        and (youtube_video_id is not null or youtube_playlist_id is not null)
      )
    );

notify pgrst, 'reload schema';

commit;
