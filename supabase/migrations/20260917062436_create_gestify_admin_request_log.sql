begin;

create table if not exists public.gestify_admin_request_log (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  token_id text not null,
  issuer text not null,
  action text not null,
  target_establishment_id uuid null references public.establishments(id) on delete set null,
  result_status text not null check (result_status in ('started','succeeded','denied','failed')),
  response_count integer null check (response_count is null or response_count >= 0),
  duration_ms integer null check (duration_ms is null or duration_ms >= 0),
  error_code text null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint gestify_admin_request_log_token_id_unique unique (token_id)
);

create index if not exists gestify_admin_request_log_correlation_idx
  on public.gestify_admin_request_log (correlation_id);
create index if not exists gestify_admin_request_log_created_at_idx
  on public.gestify_admin_request_log (created_at desc);
create index if not exists gestify_admin_request_log_target_created_idx
  on public.gestify_admin_request_log (target_establishment_id, created_at desc)
  where target_establishment_id is not null;

alter table public.gestify_admin_request_log enable row level security;

revoke all on table public.gestify_admin_request_log from public, anon, authenticated;
grant select, insert, update on table public.gestify_admin_request_log to service_role;

comment on table public.gestify_admin_request_log is
  'Server-only audit and replay-prevention ledger for the Gestify Admin M2 read boundary. Never exposed to tenant clients.';
comment on column public.gestify_admin_request_log.token_id is
  'Unique M2M JWT jti. Uniqueness makes each administrative token one-shot and rejects replay.';

commit;
