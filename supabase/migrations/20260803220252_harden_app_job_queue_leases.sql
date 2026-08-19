-- Harden job queue lease handling without modifying tenant business data.

alter table public.app_job_queue
  add column if not exists locked_until timestamptz null,
  add column if not exists lock_token uuid null,
  add column if not exists last_heartbeat_at timestamptz null;

create index if not exists app_job_queue_processing_lease_idx
  on public.app_job_queue (status, locked_until)
  where status = 'processing';

create index if not exists app_job_queue_dead_idx
  on public.app_job_queue (status, updated_at)
  where status = 'dead';

create or replace function public.claim_app_jobs(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer
)
returns setof public.app_job_queue
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with params as (
    select
      nullif(trim(coalesce(p_worker_id, '')), '') as worker_id,
      least(greatest(coalesce(p_limit, 10), 1), 50) as batch_size,
      make_interval(secs => least(greatest(coalesce(p_lease_seconds, 1200), 60), 86400)) as lease_interval
  ),
  picked as (
    select job.id
    from public.app_job_queue job, params
    where (
        job.status = 'pending'
        or (
          job.status = 'processing'
          and coalesce(job.locked_until, job.locked_at + interval '20 minutes') <= now()
        )
      )
      and job.available_at <= now()
      and job.attempts < job.max_attempts
    order by
      case job.status when 'processing' then 0 else 1 end,
      job.priority asc,
      job.available_at asc,
      job.created_at asc
    limit (select batch_size from params)
    for update skip locked
  )
  update public.app_job_queue as job
  set status = 'processing',
      locked_at = now(),
      locked_until = now() + (select lease_interval from params),
      last_heartbeat_at = now(),
      lock_token = gen_random_uuid(),
      locked_by = (select worker_id from params),
      attempts = case
        when job.status = 'pending' then job.attempts + 1
        else job.attempts
      end,
      last_error = case
        when job.status = 'processing' then 'Job recuperado automaticamente apos lease expirado.'
        else job.last_error
      end,
      updated_at = now()
  from picked
  where job.id = picked.id
  returning job.*;
$function$;

revoke all on function public.claim_app_jobs(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_app_jobs(text, integer, integer)
  to service_role;

-- Keep the older two-argument signature and its historical default available for
-- existing callers. CREATE OR REPLACE cannot remove an existing argument default.
create or replace function public.claim_app_jobs(
  p_worker_id text,
  p_limit integer default 10
)
returns setof public.app_job_queue
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select *
  from public.claim_app_jobs(p_worker_id, p_limit, 1200);
$function$;

revoke all on function public.claim_app_jobs(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_app_jobs(text, integer)
  to service_role;