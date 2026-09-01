begin;

create table if not exists public.user_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  establishment_id uuid null references public.establishments(id) on delete set null,
  terms_version_id text not null,
  document_slug text not null,
  document_title text not null,
  accepted_at timestamptz not null default now(),
  accepted_from_path text null,
  accepted_source text not null,
  ip_address text null,
  user_agent text null,
  auth_session_id text null,
  created_at timestamptz not null default now(),
  constraint user_terms_acceptances_user_version_key unique (user_id, terms_version_id)
);

create table if not exists public.user_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  establishment_id uuid null references public.establishments(id) on delete set null,
  path text null,
  ip_address text null,
  user_agent text null,
  auth_session_id text null,
  created_at timestamptz not null default now()
);

create index if not exists user_terms_acceptances_user_created_idx
  on public.user_terms_acceptances (user_id, accepted_at desc);

create index if not exists user_terms_acceptances_establishment_created_idx
  on public.user_terms_acceptances (establishment_id, accepted_at desc)
  where establishment_id is not null;

create index if not exists user_access_logs_user_created_idx
  on public.user_access_logs (user_id, created_at desc);

create index if not exists user_access_logs_establishment_created_idx
  on public.user_access_logs (establishment_id, created_at desc)
  where establishment_id is not null;

alter table public.user_terms_acceptances enable row level security;
alter table public.user_terms_acceptances force row level security;
alter table public.user_access_logs enable row level security;
alter table public.user_access_logs force row level security;

revoke all on table public.user_terms_acceptances from anon, authenticated, service_role;
revoke all on table public.user_access_logs from anon, authenticated, service_role;
grant select, insert on table public.user_terms_acceptances to service_role;
grant select, insert on table public.user_access_logs to service_role;

drop policy if exists user_terms_acceptances_no_direct_access on public.user_terms_acceptances;
create policy user_terms_acceptances_no_direct_access
  on public.user_terms_acceptances
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists user_access_logs_no_direct_access on public.user_access_logs;
create policy user_access_logs_no_direct_access
  on public.user_access_logs
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.user_terms_acceptances is
  'Append-only server-side ledger of explicit legal terms acceptances.';
comment on table public.user_access_logs is
  'Append-only server-side audit log of authenticated access events.';

commit;
