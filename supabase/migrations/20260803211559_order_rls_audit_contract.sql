begin;

create or replace function public.gestify_order_rls_audit()
returns jsonb
language sql
security definer
set search_path to 'public', 'pg_catalog', 'pg_temp'
as $function$
  with policy_rows as (
    select
      p.schemaname,
      p.tablename,
      p.policyname,
      p.roles,
      p.cmd,
      p.qual,
      p.with_check
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename in ('orders', 'order_status_events')
  ),
  policy_summary as (
    select
      pr.tablename,
      count(*)::integer as total,
      coalesce(
        jsonb_object_agg(pr.cmd, pr.command_count order by pr.cmd),
        '{}'::jsonb
      ) as by_command
    from (
      select tablename, cmd, count(*)::integer as command_count
      from policy_rows
      group by tablename, cmd
    ) pr
    group by pr.tablename
  ),
  function_rows as (
    select
      n.nspname as schema,
      p.proname as function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
      p.prosecdef as security_definer,
      pg_catalog.pg_get_functiondef(p.oid) as definition,
      coalesce(
        array_agg(distinct r.rolname order by r.rolname)
          filter (where r.rolname is not null),
        array[]::name[]
      ) as executable_by
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    left join pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) x on true
    left join pg_catalog.pg_roles r on r.oid = x.grantee
    where n.nspname = 'public'
      and p.proname in (
        'advance_order_status',
        'cancel_order',
        'reopen_order',
        'gestify_ensure_stock_balance_for_product',
        'claim_app_jobs'
      )
    group by n.nspname, p.proname, p.oid, p.prosecdef
  )
  select jsonb_build_object(
    'policies',
    coalesce(
      (
        select jsonb_agg(to_jsonb(policy_rows) order by tablename, cmd, policyname)
        from policy_rows
      ),
      '[]'::jsonb
    ),
    'policySummary',
    coalesce(
      (
        select jsonb_object_agg(
          tablename,
          jsonb_build_object('total', total, 'byCommand', by_command)
          order by tablename
        )
        from policy_summary
      ),
      '{}'::jsonb
    ),
    'functions',
    coalesce(
      (
        select jsonb_agg(to_jsonb(function_rows) order by function_name, args)
        from function_rows
      ),
      '[]'::jsonb
    )
  );
$function$;

revoke all on function public.gestify_order_rls_audit() from public, anon, authenticated;
grant execute on function public.gestify_order_rls_audit() to service_role;

notify pgrst, 'reload schema';

commit;
