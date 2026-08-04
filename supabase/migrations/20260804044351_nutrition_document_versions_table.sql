create table if not exists public.nutrition_document_versions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  document_id uuid not null references public.nutrition_documents(id) on delete cascade,
  version integer not null default 1,
  file_path text null,
  file_name text null,
  mime_type text null,
  file_size_bytes bigint null,
  checksum text null,
  status text not null default 'active',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint nutrition_document_versions_version_check check (version > 0),
  constraint nutrition_document_versions_status_check check (
    status in ('active', 'archived', 'deleted')
  )
);

alter table public.nutrition_document_versions enable row level security;

create unique index if not exists nutrition_document_versions_unique_idx
  on public.nutrition_document_versions(establishment_id, document_id, version);

create index if not exists nutrition_document_versions_tenant_document_idx
  on public.nutrition_document_versions(establishment_id, document_id, version desc);

grant select, insert, update on table public.nutrition_document_versions to authenticated;
grant select, insert, update, delete on table public.nutrition_document_versions to service_role;

drop policy if exists nutrition_document_versions_member_select on public.nutrition_document_versions;
create policy nutrition_document_versions_member_select
on public.nutrition_document_versions
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

drop policy if exists nutrition_document_versions_member_insert on public.nutrition_document_versions;
create policy nutrition_document_versions_member_insert
on public.nutrition_document_versions
for insert
to authenticated
with check ((select private.gestify_is_establishment_member(establishment_id)));

drop policy if exists nutrition_document_versions_member_update on public.nutrition_document_versions;
create policy nutrition_document_versions_member_update
on public.nutrition_document_versions
for update
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)))
with check ((select private.gestify_is_establishment_member(establishment_id)));
