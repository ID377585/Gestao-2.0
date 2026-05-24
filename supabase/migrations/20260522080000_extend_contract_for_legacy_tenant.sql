begin;

create schema if not exists private;

create or replace function private.gestify_legacy_table_names()
returns text[]
language sql
stable
as $$
  select array[
    'suppliers',
    'purchase_requests',
    'purchase_request_items',
    'purchase_orders',
    'purchase_order_items',
    'goods_receipts',
    'goods_receipt_items',
    'supplier_action_plans',
    'supplier_contact_history',
    'supplier_score_reviews',
    'purchase_action_queue',
    'buyer_monthly_goals',
    'purchase_history',
    'financial_categories',
    'cost_centers',
    'bank_accounts',
    'accounts_payable',
    'accounts_receivable',
    'financial_history',
    'bank_reconciliation_entries'
  ];
$$;

create or replace function public.gestify_contract_check()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, information_schema, pg_temp
as $$
declare
  v_missing_tables jsonb;
  v_missing_columns jsonb;
  v_missing_functions jsonb;
  v_missing_order_statuses jsonb;
  v_missing_legacy_tables jsonb;
  v_missing_legacy_columns jsonb;
  v_legacy_rls_disabled jsonb;
  v_missing_legacy_policies jsonb;
begin
  with required_tables(table_name) as (
    values
      ('orders'),
      ('order_items'),
      ('order_line_items'),
      ('inventory_labels'),
      ('inventory_movements'),
      ('stock_balances'),
      ('losses'),
      ('order_items_labels'),
      ('order_billing_drafts'),
      ('shipping_carriers')
  )
  select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
    into v_missing_tables
  from required_tables
  where to_regclass(format('public.%I', table_name)) is null;

  with required_columns(table_name, column_name) as (
    values
      ('orders', 'id'),
      ('orders', 'establishment_id'),
      ('orders', 'status'),
      ('order_items', 'order_id'),
      ('order_items', 'unit'),
      ('order_line_items', 'order_id'),
      ('order_line_items', 'establishment_id'),
      ('order_line_items', 'unit_label'),
      ('inventory_labels', 'label_code'),
      ('inventory_labels', 'qty_balance'),
      ('inventory_labels', 'status'),
      ('inventory_movements', 'order_id'),
      ('inventory_movements', 'qty_delta'),
      ('stock_balances', 'establishment_id'),
      ('stock_balances', 'product_id'),
      ('stock_balances', 'unit_label'),
      ('stock_balances', 'quantity'),
      ('losses', 'establishment_id'),
      ('losses', 'product_id'),
      ('losses', 'label_id'),
      ('losses', 'qty'),
      ('losses', 'stock_before'),
      ('losses', 'stock_after'),
      ('order_items_labels', 'order_id'),
      ('order_billing_drafts', 'base_cost'),
      ('order_billing_drafts', 'items'),
      ('order_billing_drafts', 'total_value'),
      ('order_billing_drafts', 'created_by'),
      ('order_billing_drafts', 'carrier_id')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('table', rc.table_name, 'column', rc.column_name)
      order by rc.table_name, rc.column_name
    ),
    '[]'::jsonb
  )
    into v_missing_columns
  from required_columns rc
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = rc.table_name
      and c.column_name = rc.column_name
  );

  with required_functions(function_name) as (
    values
      ('accept_order'),
      ('advance_order_status'),
      ('separate_label_for_order'),
      ('cancel_order'),
      ('reopen_order'),
      ('create_order_with_items'),
      ('create_inventory_label'),
      ('fn_upsert_stock_balance'),
      ('register_loss'),
      ('gestify_legacy_tenant_null_counts'),
      ('gestify_backfill_legacy_tenant')
  )
  select coalesce(jsonb_agg(function_name order by function_name), '[]'::jsonb)
    into v_missing_functions
  from required_functions rf
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = rf.function_name
  );

  with required_statuses(status_name) as (
    values
      ('pedido_criado'),
      ('aceitou_pedido'),
      ('em_preparo'),
      ('em_separacao'),
      ('em_faturamento'),
      ('em_transporte'),
      ('entregue'),
      ('cancelado')
  )
  select coalesce(jsonb_agg(status_name order by status_name), '[]'::jsonb)
    into v_missing_order_statuses
  from required_statuses rs
  where not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_status'
      and e.enumlabel = rs.status_name
  );

  with legacy_tables(table_name) as (
    select unnest(private.gestify_legacy_table_names())
  )
  select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
    into v_missing_legacy_tables
  from legacy_tables
  where to_regclass(format('public.%I', table_name)) is null;

  with legacy_tables(table_name) as (
    select unnest(private.gestify_legacy_table_names())
  )
  select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
    into v_missing_legacy_columns
  from legacy_tables lt
  where to_regclass(format('public.%I', lt.table_name)) is not null
    and not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = lt.table_name
        and c.column_name = 'establishment_id'
    );

  with legacy_tables(table_name) as (
    select unnest(private.gestify_legacy_table_names())
  )
  select coalesce(jsonb_agg(lt.table_name order by lt.table_name), '[]'::jsonb)
    into v_legacy_rls_disabled
  from legacy_tables lt
  join pg_class c on c.oid = to_regclass(format('public.%I', lt.table_name))
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity = false;

  with legacy_tables(table_name) as (
    select unnest(private.gestify_legacy_table_names())
  ),
  required_policies(policy_name) as (
    values
      ('gestify_legacy_tenant_select'),
      ('gestify_legacy_tenant_insert'),
      ('gestify_legacy_tenant_update'),
      ('gestify_legacy_tenant_delete')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('table', lt.table_name, 'policy', rp.policy_name)
      order by lt.table_name, rp.policy_name
    ),
    '[]'::jsonb
  )
    into v_missing_legacy_policies
  from legacy_tables lt
  cross join required_policies rp
  where to_regclass(format('public.%I', lt.table_name)) is not null
    and not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = lt.table_name
        and p.policyname = rp.policy_name
    );

  return jsonb_build_object(
    'ok',
    jsonb_array_length(v_missing_tables) = 0
      and jsonb_array_length(v_missing_columns) = 0
      and jsonb_array_length(v_missing_functions) = 0
      and jsonb_array_length(v_missing_order_statuses) = 0
      and jsonb_array_length(v_missing_legacy_tables) = 0
      and jsonb_array_length(v_missing_legacy_columns) = 0
      and jsonb_array_length(v_legacy_rls_disabled) = 0
      and jsonb_array_length(v_missing_legacy_policies) = 0,
    'missing_tables',
    v_missing_tables,
    'missing_columns',
    v_missing_columns,
    'missing_functions',
    v_missing_functions,
    'missing_order_statuses',
    v_missing_order_statuses,
    'missing_legacy_tables',
    v_missing_legacy_tables,
    'missing_legacy_establishment_id_columns',
    v_missing_legacy_columns,
    'legacy_rls_disabled',
    v_legacy_rls_disabled,
    'missing_legacy_policies',
    v_missing_legacy_policies
  );
end;
$$;

revoke all on function public.gestify_contract_check() from public, anon, authenticated;
grant execute on function public.gestify_contract_check() to service_role;

commit;
