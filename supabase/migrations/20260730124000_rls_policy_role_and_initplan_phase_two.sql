begin;

-- Phase 2 hardening:
-- - remove anonymous SQL access from operational tables that still had broad grants;
-- - restrict legacy PUBLIC policies to authenticated users;
-- - convert direct auth.uid()/auth.role() calls in policy expressions to initPlan-friendly SELECT calls.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inventory_movements',
    'kitchen_checklist_run_items',
    'kitchen_checklist_runs',
    'kitchen_checklist_template_items',
    'kitchen_checklist_templates',
    'losses',
    'order_items',
    'order_line_items',
    'order_separation_sessions',
    'order_timeline',
    'product_nutrition_facts',
    'shipping_carriers',
    'technical_sheet_ingredients',
    'technical_sheet_nutrition_snapshots'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all privileges on table public.%I from anon', table_name);
      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    end if;
  end loop;
end $$;

do $$
declare
  policy_record record;
  statement text;
  normalized_qual text;
  normalized_with_check text;
begin
  for policy_record in
    select schemaname, tablename, policyname, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        'public' = any(roles)
        or qual like '%auth.uid()%'
        or with_check like '%auth.uid()%'
        or qual like '%auth.role()%'
        or with_check like '%auth.role()%'
      )
  loop
    normalized_qual := policy_record.qual;
    normalized_with_check := policy_record.with_check;

    if normalized_qual is not null then
      normalized_qual := replace(normalized_qual, 'auth.uid()', '(select auth.uid())');
      normalized_qual := replace(normalized_qual, 'auth.role()', '(select auth.role())');
    end if;

    if normalized_with_check is not null then
      normalized_with_check := replace(normalized_with_check, 'auth.uid()', '(select auth.uid())');
      normalized_with_check := replace(normalized_with_check, 'auth.role()', '(select auth.role())');
    end if;

    statement := format(
      'alter policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );

    if 'public' = any(policy_record.roles) then
      statement := statement || ' to authenticated';
    end if;

    if normalized_qual is not null then
      statement := statement || format(' using (%s)', normalized_qual);
    end if;

    if normalized_with_check is not null then
      statement := statement || format(' with check (%s)', normalized_with_check);
    end if;

    execute statement;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
