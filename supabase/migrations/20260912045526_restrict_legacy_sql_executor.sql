-- Legacy diagnostic RPCs are not application endpoints. Keep definitions and
-- all business data intact, but remove execution from browser/API roles.
begin;
do $$
declare signature text;
begin
  for signature in
    select p.oid::regprocedure::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sql_run'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
  end loop;
end;
$$;
notify pgrst, 'reload schema';
commit;
