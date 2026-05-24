begin;

-- P0 hardening: keep sensitive write RPCs available only from trusted server code.
-- The application must call these RPCs with the service-role client and pass p_user_id
-- after validating the authenticated session and active tenant in server-side code.

create or replace function public.create_order_with_items(
  p_establishment_id uuid,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_user_id uuid default null
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
  v_user_id uuid := coalesce(p_user_id, auth.uid());
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

  if not exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = v_user_id
      and coalesce(m.is_active, true) = true
  ) and not exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = v_user_id
      and em.is_active = true
  ) then
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

create or replace function public.create_inventory_label(
  p_establishment_id uuid,
  p_product_id uuid,
  p_label_code text,
  p_qty numeric,
  p_unit_label text,
  p_notes text default null,
  p_label_type text default null,
  p_user_id uuid default null
)
returns table (
  id uuid,
  label_code text,
  qty numeric,
  qty_balance numeric,
  unit_label text,
  notes text,
  created_at timestamptz,
  status text,
  product_id uuid
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_label public.inventory_labels%rowtype;
  v_unit_label text := upper(trim(coalesce(p_unit_label, '')));
  v_label_code text := trim(coalesce(p_label_code, ''));
  v_before_qty numeric := 0;
  v_after_qty numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if p_establishment_id is null then
    raise exception 'Estabelecimento nao informado.';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = v_user_id
      and coalesce(m.is_active, true) = true
      and m.role in ('admin', 'operacao', 'estoque')
  ) and not exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = v_user_id
      and em.is_active = true
      and em.role in ('admin'::public.app_role, 'operacao'::public.app_role, 'estoque'::public.app_role)
  ) then
    raise exception 'Sem permissao para criar etiquetas neste estabelecimento.';
  end if;

  if p_product_id is null then
    raise exception 'Produto nao informado.';
  end if;

  if v_label_code = '' then
    raise exception 'Codigo/Lote da etiqueta vazio.';
  end if;

  if v_unit_label = '' then
    raise exception 'Unidade nao informada.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantidade invalida.';
  end if;

  perform 1
  from public.products p
  where p.id = p_product_id
    and p.establishment_id = p_establishment_id;

  if not found then
    raise exception 'Produto nao encontrado neste estabelecimento.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(
      p_establishment_id::text || ':' || p_product_id::text || ':' || v_unit_label
    )
  );

  select coalesce(sb.quantity, 0)
    into v_before_qty
  from public.stock_balances sb
  where sb.establishment_id = p_establishment_id
    and sb.product_id = p_product_id
    and sb.unit_label = v_unit_label
  limit 1;

  v_before_qty := coalesce(v_before_qty, 0);

  insert into public.inventory_labels (
    establishment_id,
    product_id,
    label_code,
    qty,
    qty_balance,
    used_qty,
    unit_label,
    status,
    order_id,
    separated_at,
    separated_by,
    created_by,
    notes,
    last_action
  )
  values (
    p_establishment_id,
    p_product_id,
    v_label_code,
    p_qty,
    p_qty,
    0,
    v_unit_label,
    'available',
    null,
    null,
    null,
    v_user_id,
    p_notes,
    'LABEL_CREATED'
  )
  returning * into v_label;

  insert into public.inventory_movements (
    establishment_id,
    product_id,
    label_id,
    qty,
    qty_delta,
    unit_label,
    direction,
    movement_type,
    reason,
    created_by,
    details
  )
  values (
    p_establishment_id,
    p_product_id,
    v_label.id,
    p_qty,
    p_qty,
    v_unit_label,
    'IN',
    'LABEL_IN',
    'LABEL_CREATED',
    v_user_id,
    jsonb_build_object(
      'label_code', v_label_code,
      'label_type', nullif(trim(coalesce(p_label_type, '')), ''),
      'source', 'create_inventory_label'
    )
  );

  select coalesce(sb.quantity, 0)
    into v_after_qty
  from public.stock_balances sb
  where sb.establishment_id = p_establishment_id
    and sb.product_id = p_product_id
    and sb.unit_label = v_unit_label
  limit 1;

  v_after_qty := coalesce(v_after_qty, 0);

  if v_after_qty is distinct from (v_before_qty + p_qty) then
    perform 1
    from public.fn_upsert_stock_balance(
      p_establishment_id,
      p_product_id,
      p_qty,
      v_unit_label
    );
  end if;

  return query
  select
    v_label.id,
    v_label.label_code,
    v_label.qty,
    v_label.qty_balance,
    v_label.unit_label,
    v_label.notes,
    v_label.created_at,
    v_label.status,
    v_label.product_id;
end;
$$;

revoke all on function public.create_order_with_items(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_order_with_items(uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_order_with_items(uuid, text, jsonb, uuid) to service_role;

revoke all on function public.create_inventory_label(uuid, uuid, text, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.create_inventory_label(uuid, uuid, text, numeric, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_inventory_label(uuid, uuid, text, numeric, text, text, text, uuid) to service_role;

commit;
