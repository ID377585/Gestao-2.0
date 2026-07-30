begin;

create table if not exists public.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid null,
  user_id uuid not null,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  response_status integer null,
  response_body jsonb null,
  error_message text null,
  locked_until timestamptz not null default (now() + interval '5 minutes'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, establishment_id, operation, idempotency_key)
);

create unique index if not exists api_idempotency_keys_user_global_key
  on public.api_idempotency_keys (user_id, operation, idempotency_key)
  where establishment_id is null;

create index if not exists api_idempotency_keys_expires_at_idx
  on public.api_idempotency_keys (expires_at);

create index if not exists api_idempotency_keys_status_locked_idx
  on public.api_idempotency_keys (status, locked_until);

alter table public.api_idempotency_keys enable row level security;
alter table public.api_idempotency_keys force row level security;
revoke all privileges on table public.api_idempotency_keys from public, anon, authenticated;
grant all privileges on table public.api_idempotency_keys to service_role;

create table if not exists public.app_job_queue (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid null,
  queue_name text not null default 'default',
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'dead')),
  priority integer not null default 100,
  available_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz null,
  locked_by text null,
  processed_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_job_queue_dedupe_active_idx
  on public.app_job_queue (queue_name, job_type, dedupe_key)
  where dedupe_key is not null
    and status in ('pending', 'processing', 'completed');

create index if not exists app_job_queue_claim_idx
  on public.app_job_queue (status, available_at, priority, created_at)
  where status = 'pending';

create index if not exists app_job_queue_establishment_idx
  on public.app_job_queue (establishment_id);

alter table public.app_job_queue enable row level security;
alter table public.app_job_queue force row level security;
revoke all privileges on table public.app_job_queue from public, anon, authenticated;
grant all privileges on table public.app_job_queue to service_role;

create or replace function public.claim_app_jobs(
  p_worker_id text,
  p_limit integer default 10
)
returns setof public.app_job_queue
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with picked as (
    select id
    from public.app_job_queue
    where status = 'pending'
      and available_at <= now()
      and attempts < max_attempts
    order by priority asc, available_at asc, created_at asc
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
    for update skip locked
  )
  update public.app_job_queue as job
  set status = 'processing',
      locked_at = now(),
      locked_by = nullif(trim(p_worker_id), ''),
      attempts = attempts + 1,
      updated_at = now()
  from picked
  where job.id = picked.id
  returning job.*;
$function$;

revoke all on function public.claim_app_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_app_jobs(text, integer) to service_role;

commit;
