begin;

-- Reconstructed from the applied staging state on 2026-09-18.
-- This bridge is only for M2 staging homologation and is further hard-pinned
-- by the follow-up host-scope migration.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.gestify_admin_staging_secret_ok()
returns boolean
language plpgsql
stable
set search_path to 'public', 'extensions'
as $function$
declare
  headers jsonb;
  supplied text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return false;
  end;

  supplied := coalesce(headers ->> 'x-gestify-admin-staging-secret', '');
  if supplied = '' then
    return false;
  end if;

  return encode(extensions.digest(supplied, 'sha256'), 'hex')
    = '3117cc43e389e695525d8a59861834d0d61fead5e0888a6148cec3f0c601cba4';
end;
$function$;

revoke all on function public.gestify_admin_staging_secret_ok() from public;
grant execute on function public.gestify_admin_staging_secret_ok() to anon, authenticated, service_role;

grant select on table
  public.establishments,
  public.memberships,
  public.orders,
  public.products,
  public.technical_sheets,
  public.company_subscriptions,
  public.establishment_entitlements
to anon;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'establishments',
    'memberships',
    'orders',
    'products',
    'technical_sheets',
    'company_subscriptions',
    'establishment_entitlements'
  ]
  loop
    execute format('drop policy if exists gestify_admin_staging_select on public.%I', table_name);
    execute format(
      'create policy gestify_admin_staging_select on public.%I for select to anon using (public.gestify_admin_staging_secret_ok())',
      table_name
    );
  end loop;
end $$;

grant select, insert, update on table public.gestify_admin_request_log to anon;

drop policy if exists gestify_admin_staging_insert on public.gestify_admin_request_log;
create policy gestify_admin_staging_insert
  on public.gestify_admin_request_log
  for insert to anon
  with check (public.gestify_admin_staging_secret_ok());

drop policy if exists gestify_admin_staging_select on public.gestify_admin_request_log;
create policy gestify_admin_staging_select
  on public.gestify_admin_request_log
  for select to anon
  using (public.gestify_admin_staging_secret_ok());

drop policy if exists gestify_admin_staging_update on public.gestify_admin_request_log;
create policy gestify_admin_staging_update
  on public.gestify_admin_request_log
  for update to anon
  using (public.gestify_admin_staging_secret_ok())
  with check (public.gestify_admin_staging_secret_ok());

create or replace function public.gestify_admin_staging_user_profile(p_user_id uuid)
returns table(user_id uuid, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $function$
begin
  if not public.gestify_admin_staging_secret_ok() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select u.id, u.created_at, u.last_sign_in_at
  from auth.users u
  where u.id = p_user_id
  limit 1;
end;
$function$;

revoke all on function public.gestify_admin_staging_user_profile(uuid) from public;
grant execute on function public.gestify_admin_staging_user_profile(uuid) to service_role;

commit;
