\set ON_ERROR_STOP on

DO $$
DECLARE
  missing_tables text[];
  tables_without_rls text[];
  anonymous_grants text[];
  contract_ok boolean;
BEGIN
  SELECT array_agg(expected.table_name ORDER BY expected.table_name)
  INTO missing_tables
  FROM (
    VALUES
      ('establishments'),
      ('memberships'),
      ('profiles'),
      ('products'),
      ('orders')
  ) AS expected(table_name)
  WHERE to_regclass(format('public.%I', expected.table_name)) IS NULL;

  IF coalesce(cardinality(missing_tables), 0) > 0 THEN
    RAISE EXCEPTION 'Restore incompleto: tabelas críticas ausentes: %', missing_tables;
  END IF;

  SELECT array_agg(relation.relname ORDER BY relation.relname)
  INTO tables_without_rls
  FROM pg_catalog.pg_class relation
  JOIN pg_catalog.pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'r'
    AND relation.relrowsecurity = false;

  IF coalesce(cardinality(tables_without_rls), 0) > 0 THEN
    RAISE EXCEPTION 'Restore inseguro: tabelas públicas sem RLS: %', tables_without_rls;
  END IF;

  SELECT array_agg(
    format('%s:%s:%s', grant_row.table_name, grant_row.grantee, grant_row.privilege_type)
    ORDER BY grant_row.table_name, grant_row.grantee, grant_row.privilege_type
  )
  INTO anonymous_grants
  FROM information_schema.table_privileges grant_row
  WHERE grant_row.table_schema = 'public'
    AND grant_row.grantee IN ('anon', 'PUBLIC');

  IF coalesce(cardinality(anonymous_grants), 0) > 0 THEN
    RAISE EXCEPTION 'Restore inseguro: grants anônimos/PUBLIC encontrados: %', anonymous_grants;
  END IF;

  IF to_regprocedure('public.gestify_core_security_audit()') IS NULL THEN
    RAISE EXCEPTION 'Contrato vivo gestify_core_security_audit() ausente';
  END IF;

  EXECUTE
    'select coalesce((public.gestify_core_security_audit() ->> ''ok'')::boolean, false)'
  INTO contract_ok;

  IF contract_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Contrato vivo de segurança reprovou o banco restaurado';
  END IF;
END;
$$;

SELECT jsonb_build_object(
  'ok', true,
  'public_table_count', (
    SELECT count(*)
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
  ),
  'public_tables_without_rls', 0,
  'anonymous_public_table_grants', 0,
  'security_contract', public.gestify_core_security_audit(),
  'verified_at', now()
)::text;
