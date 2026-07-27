begin;

alter table public.losses
  add column if not exists photo_path text,
  add column if not exists photo_file_name text,
  add column if not exists photo_mime_type text;

comment on column public.losses.photo_path is
  'Private Supabase Storage path for the loss evidence photo.';
comment on column public.losses.photo_file_name is
  'Original file name for the loss evidence photo.';
comment on column public.losses.photo_mime_type is
  'MIME type for the loss evidence photo.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'loss-photos',
  'loss-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
