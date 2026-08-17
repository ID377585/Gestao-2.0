create or replace function public.gestify_core_security_audit()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, information_schema, public, storage, pg_temp
as $function$
declare
  v_tables_without_rls jsonb;
  v_anonymous_table_grants jsonb;
  v_internal_table_exposure jsonb;
  v_unexpected_public_buckets jsonb;
  v_allowed_public_buckets jsonb;
  v_critical_anon_rpcs jsonb;
  v_anon_security_definer_functions jsonb;
begin
  select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    into v_tables_without_rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity = false;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', grants.table_name,
        'grantee', grants.grantee,
        'privileges', grants.privileges
      )
      order by grants.table_name, grants.grantee
    ),
    '[]'::jsonb
  )
    into v_anonymous_table_grants
  from (
    select g.table_name,
           g.grantee,
           array_agg(distinct g.privilege_type order by g.privilege_type) as privileges
    from information_schema.table_privileges g
    where g.table_schema = 'public'
      and g.grantee in ('anon', 'PUBLIC')
    group by g.table_name, g.grantee
  ) grants;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', exposure.table_name,
        'grantee', exposure.grantee,
        'privileges', exposure.privileges
      )
      order by exposure.table_name, exposure.grantee
    ),
    '[]'::jsonb
  )
    into v_internal_table_exposure
  from (
    select g.table_name,
           g.grantee,
           array_agg(distinct g.privilege_type order by g.privilege_type) as privileges
    from information_schema.table_privileges g
    where g.table_schema = 'public'
      and g.table_name in ('api_idempotency_keys', 'app_job_queue')
      and g.grantee in ('anon', 'authenticated', 'PUBLIC')
    group by g.table_name, g.grantee
  ) exposure;

  select coalesce(jsonb_agg(b.id order by b.id), '[]'::jsonb)
    into v_unexpected_public_buckets
  from storage.buckets b
  where b.public = true
    and b.id <> 'avatars';

  select coalesce(jsonb_agg(b.id order by b.id), '[]'::jsonb)
    into v_allowed_public_buckets
  from storage.buckets b
  where b.public = true
    and b.id = 'avatars';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', p.proname,
        'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid)
      )
      order by p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)
    ),
    '[]'::jsonb
  )
    into v_critical_anon_rpcs
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'advance_order_status',
      'cancel_order',
      'reopen_order',
      'enqueue_nutrition_notification',
      'gestify_ensure_stock_balance_for_product',
      'claim_app_jobs',
      'gestify_contract_check',
      'gestify_core_security_audit'
    )
    and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', p.proname,
        'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid)
      )
      order by p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)
    ),
    '[]'::jsonb
  )
    into v_anon_security_definer_functions
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true
    and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE');

  return jsonb_build_object(
    'ok',
      jsonb_array_length(v_tables_without_rls) = 0
      and jsonb_array_length(v_anonymous_table_grants) = 0
      and jsonb_array_length(v_internal_table_exposure) = 0
      and jsonb_array_length(v_unexpected_public_buckets) = 0
      and jsonb_array_length(v_critical_anon_rpcs) = 0
      and jsonb_array_length(v_anon_security_definer_functions) = 0,
    'contract_version', 'gestify-core-v1.1',
    'checked_at', pg_catalog.clock_timestamp(),
    'public_tables_without_rls', v_tables_without_rls,
    'anonymous_table_grants', v_anonymous_table_grants,
    'anon_table_grants', v_anonymous_table_grants,
    'internal_table_exposure', v_internal_table_exposure,
    'unexpected_public_buckets', v_unexpected_public_buckets,
    'allowed_public_buckets', v_allowed_public_buckets,
    'critical_anon_rpcs', v_critical_anon_rpcs,
    'anon_security_definer_functions', v_anon_security_definer_functions
  );
end;
$function$;

revoke all on function public.gestify_core_security_audit()
  from public, anon, authenticated;

grant execute on function public.gestify_core_security_audit()
  to service_role;

comment on function public.gestify_core_security_audit() is
  'Service-role-only live security contract for public-table RLS, anonymous/PUBLIC grants, internal tables, privileged RPCs and public storage buckets.';

notify pgrst, 'reload schema';
