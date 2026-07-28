begin;

create extension if not exists pgcrypto;

create table if not exists public.hr_employee_face_profiles (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_path text not null,
  photo_mime_type text not null,
  face_signature jsonb not null,
  face_detection_status text not null default 'not_submitted',
  face_detection_method text null,
  face_count integer null,
  client_captured_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_employee_face_profiles_unique unique (establishment_id, user_id),
  constraint hr_employee_face_profiles_photo_mime_check check (
    photo_mime_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  constraint hr_employee_face_profiles_face_status_check check (
    face_detection_status in ('not_submitted', 'verified', 'not_detected', 'multiple_faces', 'unsupported')
  ),
  constraint hr_employee_face_profiles_face_count_check check (
    face_count is null or face_count >= 0
  )
);

alter table if exists public.hr_time_clock_events
  add column if not exists face_match_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists face_match_score numeric(6, 5) null;

create index if not exists hr_employee_face_profiles_establishment_idx
  on public.hr_employee_face_profiles(establishment_id, user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-face-profiles',
  'employee-face-profiles',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.hr_employee_face_profiles enable row level security;

grant select on table public.hr_employee_face_profiles to authenticated;
grant select, insert, update, delete on table public.hr_employee_face_profiles to service_role;

drop policy if exists "hr_employee_face_profiles_member_select" on public.hr_employee_face_profiles;
create policy "hr_employee_face_profiles_member_select"
on public.hr_employee_face_profiles
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

drop policy if exists "hr_employee_face_profiles_admin_write" on public.hr_employee_face_profiles;
create policy "hr_employee_face_profiles_admin_write"
on public.hr_employee_face_profiles
for all
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin', 'operacao']::text[])))
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin', 'operacao']::text[])));

notify pgrst, 'reload schema';

commit;
