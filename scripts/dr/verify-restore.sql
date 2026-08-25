\set ON_ERROR_STOP on

DO $$
DECLARE
  table_name text;
  missing_tables text[] := ARRAY[]::text[];
  rls_disabled text[] := ARRAY[]::text[];
  audit_guard_count integer;
  audit_function_ok boolean;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'establishments',
    'profiles',
    'memberships',
    'products',
    'orders',
    'audit_logs'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      missing_tables := array_append(missing_tables, table_name);
    END IF;
  END LOOP;

  IF cardinality(missing_tables) > 0 THEN
    RAISE EXCEPTION 'Restore incompleto: tabelas ausentes: %', missing_tables;
  END IF;

  SELECT array_agg(relation.relname ORDER BY relation.relname)
  INTO rls_disabled
  FROM pg_catalog.pg_class relation
  JOIN pg_catalog.pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = ANY (ARRAY[
      'establishments',
      'profiles',
      'memberships',
      'products',
      'orders',
      'audit_logs'
    ])
    AND relation.relrowsecurity = false;

  IF coalesce(cardinality(rls_disabled), 0) > 0 THEN
    RAISE EXCEPTION 'Restore inseguro: RLS desabilitada em %', rls_disabled;
  END IF;

  IF (SELECT count(*) FROM public.establishments) <> 2 THEN
    RAISE EXCEPTION 'Contagem inválida de establishments';
  END IF;

  IF (SELECT count(*) FROM public.profiles) <> 2 THEN
    RAISE EXCEPTION 'Contagem inválida de profiles';
  END IF;

  IF (SELECT count(*) FROM public.memberships) <> 2 THEN
    RAISE EXCEPTION 'Contagem inválida de memberships';
  END IF;

  IF (SELECT count(*) FROM public.products) <> 2 THEN
    RAISE EXCEPTION 'Contagem inválida de products';
  END IF;

  IF (SELECT count(*) FROM public.orders) <> 2 THEN
    RAISE EXCEPTION 'Contagem inválida de orders';
  END IF;

  IF (SELECT count(*) FROM public.audit_logs) <> 1 THEN
    RAISE EXCEPTION 'Contagem inválida de audit_logs';
  END IF;

  SELECT count(*)
  INTO audit_guard_count
  FROM pg_catalog.pg_trigger trigger
  JOIN pg_catalog.pg_class relation ON relation.oid = trigger.tgrelid
  JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'audit_logs'
    AND trigger.tgname = 'gestify_dr_audit_logs_append_only'
    AND trigger.tgisinternal = false;

  IF audit_guard_count <> 1 THEN
    RAISE EXCEPTION 'Trigger append-only ausente';
  END IF;

  SELECT
    procedure.prosecdef
    AND NOT has_function_privilege('anon', procedure.oid, 'EXECUTE')
    AND NOT has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  INTO audit_function_ok
  FROM pg_catalog.pg_proc procedure
  JOIN pg_catalog.pg_namespace namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'gestify_core_security_audit'
    AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) = '';

  IF coalesce(audit_function_ok, false) = false THEN
    RAISE EXCEPTION 'Contrato de segurança não foi restaurado com grants seguros';
  END IF;

  BEGIN
    UPDATE public.audit_logs
    SET event_type = event_type
    WHERE id = 'aaaaaaaa-5555-4555-8555-555555555555';

    RAISE EXCEPTION 'Trigger append-only não bloqueou a mutação';
  EXCEPTION
    WHEN SQLSTATE '55000' THEN
      NULL;
  END;
END;
$$;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-0000-4000-8000-000000000001',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

DO $$
DECLARE
  visible_orders integer;
  updated_rows integer;
BEGIN
  SELECT count(*) INTO visible_orders FROM public.orders;
  IF visible_orders <> 1 THEN
    RAISE EXCEPTION 'Tenant A visualizou % pedidos; esperado 1', visible_orders;
  END IF;

  UPDATE public.orders
  SET note = 'tentativa cross-tenant'
  WHERE id = 'bbbbbbbb-4444-4444-8444-444444444444';
  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  IF updated_rows <> 0 THEN
    RAISE EXCEPTION 'Tenant A alterou pedido do tenant B';
  END IF;
END;
$$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-0000-4000-8000-000000000002',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

DO $$
DECLARE
  visible_orders integer;
BEGIN
  SELECT count(*) INTO visible_orders FROM public.orders;
  IF visible_orders <> 1 THEN
    RAISE EXCEPTION 'Tenant B visualizou % pedidos; esperado 1', visible_orders;
  END IF;
END;
$$;
ROLLBACK;

SELECT jsonb_build_object(
  'ok', true,
  'establishments', (SELECT count(*) FROM public.establishments),
  'profiles', (SELECT count(*) FROM public.profiles),
  'memberships', (SELECT count(*) FROM public.memberships),
  'products', (SELECT count(*) FROM public.products),
  'orders', (SELECT count(*) FROM public.orders),
  'audit_logs', (SELECT count(*) FROM public.audit_logs),
  'security_contract', public.gestify_core_security_audit(),
  'verified_at', now()
)::text;
