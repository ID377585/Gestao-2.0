-- Nutrition is an authenticated tenant module. RLS had no anon policies,
-- but the tables still inherited broad anon grants. Remove that extra surface.

do $$
declare
  v_relation record;
begin
  for v_relation in
    select n.nspname as schema_name, c.relname as relation_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname like 'nutrition\_%' escape '\'
  loop
    execute format(
      'revoke all privileges on table %I.%I from anon',
      v_relation.schema_name,
      v_relation.relation_name
    );
  end loop;

  for v_relation in
    select n.nspname as schema_name, c.relname as relation_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and c.relname like 'nutrition\_%' escape '\'
  loop
    execute format(
      'revoke all privileges on sequence %I.%I from anon',
      v_relation.schema_name,
      v_relation.relation_name
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
