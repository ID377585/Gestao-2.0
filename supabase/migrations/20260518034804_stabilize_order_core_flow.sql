begin;

create or replace function public.create_order_with_items(
  p_establishment_id uuid,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns table (
  id uuid,
  order_number bigint,
  status public.order_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product_name text;
  v_unit_label text;
  v_quantity numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_establishment_id is null then
    raise exception 'Establishment is required';
  end if;

  if not private.gestify_is_establishment_member(p_establishment_id) then
    raise exception 'Order not found or outside establishment';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Items must be a JSON array';
  end if;

  insert into public.orders (
    establishment_id,
    created_by,
    customer_user_id,
    status,
    notes
  )
  values (
    p_establishment_id,
    v_user_id,
    v_user_id,
    'pedido_criado',
    coalesce(nullif(btrim(p_notes), ''), 'Pedido criado via sistema')
  )
  returning * into v_order;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_product_name := btrim(coalesce(v_item ->> 'product_name', ''));
    v_unit_label := upper(btrim(coalesce(v_item ->> 'unit_label', '')));
    v_quantity := nullif(v_item ->> 'quantity', '')::numeric;

    if v_product_name = '' then
      raise exception 'Item product_name is required';
    end if;

    if v_unit_label = '' then
      raise exception 'Item unit_label is required';
    end if;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Item quantity must be greater than zero';
    end if;

    insert into public.order_line_items (
      order_id,
      establishment_id,
      product_name,
      quantity,
      unit_label
    )
    values (
      v_order.id,
      p_establishment_id,
      v_product_name,
      v_quantity,
      v_unit_label
    );
  end loop;

  return query
  select
    v_order.id,
    v_order.order_number::bigint,
    v_order.status,
    v_order.created_at;
end;
$$;

revoke all on function public.create_order_with_items(uuid, text, jsonb) from public, anon;
grant execute on function public.create_order_with_items(uuid, text, jsonb) to authenticated;

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
      ('register_loss')
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

  return jsonb_build_object(
    'ok',
    jsonb_array_length(v_missing_tables) = 0
      and jsonb_array_length(v_missing_columns) = 0
      and jsonb_array_length(v_missing_functions) = 0
      and jsonb_array_length(v_missing_order_statuses) = 0,
    'missing_tables',
    v_missing_tables,
    'missing_columns',
    v_missing_columns,
    'missing_functions',
    v_missing_functions,
    'missing_order_statuses',
    v_missing_order_statuses
  );
end;
$$;

revoke all on function public.gestify_contract_check() from public, anon, authenticated;
grant execute on function public.gestify_contract_check() to service_role;

commit;
