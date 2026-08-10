begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create schema if not exists private;

create or replace function private.gestify_reject_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if current_user in ('postgres', 'supabase_admin') then
    if tg_level = 'ROW' and tg_op = 'DELETE' then
      return old;
    elsif tg_level = 'ROW' then
      return new;
    end if;

    return null;
  end if;

  raise exception 'audit table %.% is append-only', tg_table_schema, tg_table_name
    using errcode = '42501';
end;
$function$;

revoke all on function private.gestify_reject_audit_mutation()
  from public, anon, authenticated, service_role;

-- The application roles may append and read where explicitly granted, but
-- cannot rewrite history, truncate data, create triggers or add references.
revoke all on table public.audit_logs from public, anon;
revoke update, delete, truncate, references, trigger, insert
  on table public.audit_logs from authenticated;
revoke update, delete, truncate, references, trigger
  on table public.audit_logs from service_role;
grant select on table public.audit_logs to authenticated;
grant select, insert on table public.audit_logs to service_role;

revoke all on table public.user_access_audit_logs from public, anon;
revoke update, delete, truncate, references, trigger, insert
  on table public.user_access_audit_logs from authenticated;
revoke update, delete, truncate, references, trigger
  on table public.user_access_audit_logs from service_role;
grant select on table public.user_access_audit_logs to authenticated;
grant select, insert on table public.user_access_audit_logs to service_role;

revoke all on table public.nutrition_audit_events from public, anon;
revoke update, delete, truncate, references, trigger
  on table public.nutrition_audit_events from authenticated, service_role;
grant select, insert on table public.nutrition_audit_events to authenticated, service_role;

revoke all on table public.gestify_security_migration_audit
  from public, anon, authenticated;
revoke update, delete, truncate, references, trigger
  on table public.gestify_security_migration_audit from service_role;
grant select, insert on table public.gestify_security_migration_audit to service_role;

revoke all on table public.stock_balance_audit from public, anon;
revoke update, delete, truncate, references, trigger
  on table public.stock_balance_audit from authenticated, service_role;
grant select, insert on table public.stock_balance_audit to service_role;

drop policy if exists gestify_tenant_update_staff
  on public.stock_balance_audit;
drop policy if exists gestify_tenant_delete_admin
  on public.stock_balance_audit;

drop trigger if exists gestify_prevent_audit_mutation
  on public.audit_logs;
create trigger gestify_prevent_audit_mutation
before update or delete on public.audit_logs
for each row execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_truncate
  on public.audit_logs;
create trigger gestify_prevent_audit_truncate
before truncate on public.audit_logs
for each statement execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_mutation
  on public.user_access_audit_logs;
create trigger gestify_prevent_audit_mutation
before update or delete on public.user_access_audit_logs
for each row execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_truncate
  on public.user_access_audit_logs;
create trigger gestify_prevent_audit_truncate
before truncate on public.user_access_audit_logs
for each statement execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_mutation
  on public.nutrition_audit_events;
create trigger gestify_prevent_audit_mutation
before update or delete on public.nutrition_audit_events
for each row execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_truncate
  on public.nutrition_audit_events;
create trigger gestify_prevent_audit_truncate
before truncate on public.nutrition_audit_events
for each statement execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_mutation
  on public.gestify_security_migration_audit;
create trigger gestify_prevent_audit_mutation
before update or delete on public.gestify_security_migration_audit
for each row execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_truncate
  on public.gestify_security_migration_audit;
create trigger gestify_prevent_audit_truncate
before truncate on public.gestify_security_migration_audit
for each statement execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_mutation
  on public.stock_balance_audit;
create trigger gestify_prevent_audit_mutation
before update or delete on public.stock_balance_audit
for each row execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_truncate
  on public.stock_balance_audit;
create trigger gestify_prevent_audit_truncate
before truncate on public.stock_balance_audit
for each statement execute function private.gestify_reject_audit_mutation();

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
  v_mutable_audit_grants jsonb;
  v_audit_tables_missing_row_guard jsonb;
  v_audit_tables_missing_truncate_guard jsonb;
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
    into v_mutable_audit_grants
  from (
    select g.table_name,
           g.grantee,
           array_agg(distinct g.privilege_type order by g.privilege_type) as privileges
    from information_schema.table_privileges g
    where g.table_schema = 'public'
      and g.table_name in (
        'audit_logs',
        'user_access_audit_logs',
        'nutrition_audit_events',
        'gestify_security_migration_audit',
        'stock_balance_audit'
      )
      and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
      and g.privilege_type in (
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER'
      )
    group by g.table_name, g.grantee
  ) grants;

  with audit_tables(table_name) as (
    values
      ('audit_logs'),
      ('user_access_audit_logs'),
      ('nutrition_audit_events'),
      ('gestify_security_migration_audit'),
      ('stock_balance_audit')
  )
  select coalesce(jsonb_agg(a.table_name order by a.table_name), '[]'::jsonb)
    into v_audit_tables_missing_row_guard
  from audit_tables a
  where pg_catalog.to_regclass(pg_catalog.format('public.%I', a.table_name)) is not null
    and not exists (
      select 1
      from pg_catalog.pg_trigger tg
      where tg.tgrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', a.table_name)
      )
        and tg.tgname = 'gestify_prevent_audit_mutation'
        and not tg.tgisinternal
    );

  with audit_tables(table_name) as (
    values
      ('audit_logs'),
      ('user_access_audit_logs'),
      ('nutrition_audit_events'),
      ('gestify_security_migration_audit'),
      ('stock_balance_audit')
  )
  select coalesce(jsonb_agg(a.table_name order by a.table_name), '[]'::jsonb)
    into v_audit_tables_missing_truncate_guard
  from audit_tables a
  where pg_catalog.to_regclass(pg_catalog.format('public.%I', a.table_name)) is not null
    and not exists (
      select 1
      from pg_catalog.pg_trigger tg
      where tg.tgrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', a.table_name)
      )
        and tg.tgname = 'gestify_prevent_audit_truncate'
        and not tg.tgisinternal
    );

  return jsonb_build_object(
    'ok',
      jsonb_array_length(v_tables_without_rls) = 0
      and jsonb_array_length(v_anonymous_table_grants) = 0
      and jsonb_array_length(v_internal_table_exposure) = 0
      and jsonb_array_length(v_unexpected_public_buckets) = 0
      and jsonb_array_length(v_critical_anon_rpcs) = 0
      and jsonb_array_length(v_anon_security_definer_functions) = 0
      and jsonb_array_length(v_mutable_audit_grants) = 0
      and jsonb_array_length(v_audit_tables_missing_row_guard) = 0
      and jsonb_array_length(v_audit_tables_missing_truncate_guard) = 0,
    'contract_version', 'gestify-core-v1.2',
    'checked_at', pg_catalog.clock_timestamp(),
    'public_tables_without_rls', v_tables_without_rls,
    'anonymous_table_grants', v_anonymous_table_grants,
    'anon_table_grants', v_anonymous_table_grants,
    'internal_table_exposure', v_internal_table_exposure,
    'unexpected_public_buckets', v_unexpected_public_buckets,
    'allowed_public_buckets', v_allowed_public_buckets,
    'critical_anon_rpcs', v_critical_anon_rpcs,
    'anon_security_definer_functions', v_anon_security_definer_functions,
    'mutable_audit_grants', v_mutable_audit_grants,
    'audit_tables_missing_row_guard', v_audit_tables_missing_row_guard,
    'audit_tables_missing_truncate_guard', v_audit_tables_missing_truncate_guard
  );
end;
$function$;

revoke all on function public.gestify_core_security_audit()
  from public, anon, authenticated;

grant execute on function public.gestify_core_security_audit()
  to service_role;

comment on function private.gestify_reject_audit_mutation() is
  'Rejects UPDATE, DELETE and TRUNCATE on protected audit tables for application roles.';

comment on function public.gestify_core_security_audit() is
  'Service-role-only live security contract for RLS, anonymous/PUBLIC grants, internal tables, privileged RPCs, storage and append-only audit logs.';

notify pgrst, 'reload schema';

commit;
