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

commit;
