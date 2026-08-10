begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists avatar_updated_at timestamptz;

update public.profiles
set
  avatar_path = nullif(
    split_part(
      split_part(avatar_url, '/storage/v1/object/public/avatars/', 2),
      '?',
      1
    ),
    ''
  ),
  avatar_updated_at = coalesce(avatar_updated_at, now())
where nullif(btrim(coalesce(avatar_path, '')), '') is null
  and avatar_url like '%/storage/v1/object/public/avatars/%';

comment on column public.profiles.avatar_path is
  'Private Storage object path for the profile avatar. Never expose as an authorization decision.';

comment on column public.profiles.avatar_updated_at is
  'Last avatar change timestamp used only for cache invalidation.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg']
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Kept alongside the legacy public-read policy during the compatibility phase.
-- The public policy and bucket flag are removed only after the signed-avatar
-- backend is deployed to the production branch.
drop policy if exists "Users can read own avatars" on storage.objects;

create policy "Users can read own avatars"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';

commit;
