begin;

do $$
declare
  routine record;
begin
  for routine in
    select
      n.nspname as schema_name,
      p.proname as routine_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_admin_in_establishment',
        'my_role_in_establishment',
        'is_staff',
        'active_membership',
        'get_active_membership'
      )
  loop
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      routine.schema_name,
      routine.routine_name,
      routine.identity_args
    );
  end loop;
end $$;

grant select on table public.suppliers to authenticated;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '202605170004_gestify_grant_entries_read_helpers',
  'Granted authenticated EXECUTE only on safe authorization helpers used by RLS and SELECT on suppliers for catalog reads required by purchase entries.'
)
on conflict (migration_name) do nothing;

commit;
