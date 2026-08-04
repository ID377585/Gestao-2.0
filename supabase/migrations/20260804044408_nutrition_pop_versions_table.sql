create table if not exists public.nutrition_pop_versions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  pop_id uuid not null references public.nutrition_pops(id) on delete cascade,
  version integer not null default 1,
  content jsonb not null default '{}'::jsonb,
  file_path text null,
  file_name text null,
  mime_type text null,
  file_size_bytes bigint null,
  checksum text null,
  status text not null default 'draft',
  next_review_at date null,
  author_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint nutrition_pop_versions_version_check check (version > 0),
  constraint nutrition_pop_versions_status_check check (
    status in ('draft', 'active', 'archived', 'deleted')
  )
);

alter table public.nutrition_pop_versions enable row level security;

create unique index if not exists nutrition_pop_versions_unique_idx
  on public.nutrition_pop_versions(establishment_id, pop_id, version);

create index if not exists nutrition_pop_versions_tenant_pop_idx
  on public.nutrition_pop_versions(establishment_id, pop_id, version desc);

grant select, insert, update on table public.nutrition_pop_versions to authenticated;
grant select, insert, update, delete on table public.nutrition_pop_versions to service_role;

drop policy if exists nutrition_pop_versions_member_select on public.nutrition_pop_versions;
create policy nutrition_pop_versions_member_select
on public.nutrition_pop_versions
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

drop policy if exists nutrition_pop_versions_member_insert on public.nutrition_pop_versions;
create policy nutrition_pop_versions_member_insert
on public.nutrition_pop_versions
for insert
to authenticated
with check ((select private.gestify_is_establishment_member(establishment_id)));

drop policy if exists nutrition_pop_versions_member_update on public.nutrition_pop_versions;
create policy nutrition_pop_versions_member_update
on public.nutrition_pop_versions
for update
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)))
with check ((select private.gestify_is_establishment_member(establishment_id)));
