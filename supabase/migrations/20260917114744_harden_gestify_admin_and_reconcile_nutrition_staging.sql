begin;

-- Explicit deny-all policy for the server-only Gestify Admin audit ledger.
drop policy if exists gestify_admin_request_log_no_client_access
  on public.gestify_admin_request_log;
create policy gestify_admin_request_log_no_client_access
  on public.gestify_admin_request_log
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Reconcile staging with the already-hardened Production contract:
-- public facade is SECURITY INVOKER; privileged implementation remains private.
create or replace function public.enqueue_nutrition_notification(
  p_establishment_id uuid,
  p_type text,
  p_priority text,
  p_title text,
  p_message text,
  p_resource_type text default null::text,
  p_resource_id uuid default null::uuid,
  p_target_user_id uuid default null::uuid,
  p_due_at timestamptz default null::timestamptz,
  p_dedupe_key text default null::text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path to 'public', 'private', 'auth', 'pg_temp'
as $function$
begin
  return private.enqueue_nutrition_notification_impl(
    p_establishment_id,
    p_type,
    p_priority,
    p_title,
    p_message,
    p_resource_type,
    p_resource_id,
    p_target_user_id,
    p_due_at,
    p_dedupe_key,
    p_payload
  );
end;
$function$;

revoke execute on function public.enqueue_nutrition_notification(uuid,text,text,text,text,text,uuid,uuid,timestamptz,text,jsonb) from anon;
grant execute on function public.enqueue_nutrition_notification(uuid,text,text,text,text,text,uuid,uuid,timestamptz,text,jsonb) to authenticated, service_role;

commit;
