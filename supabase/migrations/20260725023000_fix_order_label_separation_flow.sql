begin;

create or replace function public.separate_label_for_order(
  p_label_code text,
  p_order_id uuid,
  p_user_id uuid
)
returns setof public.inventory_labels
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_user_id uuid := coalesce(auth.uid(), p_user_id);
  v_order public.orders%rowtype;
  v_label public.inventory_labels%rowtype;
  v_product public.products%rowtype;
  v_order_item public.order_line_items%rowtype;
  v_already_collected numeric := 0;
  v_remaining numeric := 0;
  v_qty_to_use numeric := 0;
  v_movement_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_auth_user_id is not null
    and p_user_id is not null
    and p_user_id <> v_auth_user_id then
    raise exception 'Usuário da separação não confere com a sessão autenticada.';
  end if;

  select *
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_order.status <> 'em_separacao' then
    raise exception 'Só é possível separar etiquetas quando o pedido está em separação.';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.establishment_id = v_order.establishment_id
      and m.user_id = v_user_id
      and coalesce(m.is_active, true) = true
      and m.role in ('admin', 'operacao', 'estoque', 'producao')
  ) and not exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = v_order.establishment_id
      and em.user_id = v_user_id
      and em.is_active = true
      and em.role in (
        'admin'::public.app_role,
        'operacao'::public.app_role,
        'estoque'::public.app_role,
        'producao'::public.app_role
      )
  ) then
    raise exception 'Sem permissão para separar etiquetas neste pedido.';
  end if;

  select *
    into v_label
  from public.inventory_labels
  where label_code = btrim(coalesce(p_label_code, ''))
    and establishment_id = v_order.establishment_id
  for update;

  if v_label.id is null then
    raise exception 'Etiqueta não encontrada (QR inválido)';
  end if;

  if v_label.status <> 'available' then
    raise exception 'Etiqueta já foi utilizada / separada';
  end if;

  if v_label.product_id is null then
    raise exception 'Etiqueta sem produto vinculado.';
  end if;

  v_qty_to_use := coalesce(v_label.qty_balance, v_label.qty, 0);

  if v_qty_to_use <= 0 then
    raise exception 'Etiqueta sem saldo disponível.';
  end if;

  select *
    into v_product
  from public.products
  where id = v_label.product_id
    and establishment_id = v_order.establishment_id;

  if v_product.id is null then
    raise exception 'Produto da etiqueta não encontrado neste estabelecimento.';
  end if;

  select *
    into v_order_item
  from public.order_line_items oli
  where oli.order_id = v_order.id
    and oli.establishment_id = v_order.establishment_id
    and lower(btrim(oli.product_name)) = lower(btrim(v_product.name))
    and upper(btrim(oli.unit_label)) = upper(btrim(v_label.unit_label))
  order by oli.created_at asc
  limit 1;

  if v_order_item.id is null then
    raise exception 'Esta etiqueta não corresponde a nenhum item do pedido.';
  end if;

  select coalesce(sum(oil.qty_used), 0)
    into v_already_collected
  from public.order_items_labels oil
  join public.inventory_labels il on il.id = oil.label_id
  where oil.order_id = v_order.id
    and il.product_id = v_label.product_id
    and upper(btrim(oil.unit_label)) = upper(btrim(v_label.unit_label));

  v_remaining := coalesce(v_order_item.quantity, 0) - coalesce(v_already_collected, 0);

  if v_remaining <= 0 then
    raise exception 'Item do pedido já foi separado completamente.';
  end if;

  if v_qty_to_use > v_remaining then
    raise exception 'Saldo da etiqueta maior que a quantidade restante do item.';
  end if;

  insert into public.inventory_movements (
    establishment_id,
    product_id,
    label_id,
    order_id,
    movement_type,
    direction,
    qty,
    qty_delta,
    unit_label,
    reason,
    created_by,
    details
  )
  values (
    v_order.establishment_id,
    v_label.product_id,
    v_label.id,
    v_order.id,
    'ORDER_SEPARATION',
    'OUT',
    v_qty_to_use,
    -v_qty_to_use,
    upper(btrim(v_label.unit_label)),
    'ORDER_SEPARATION',
    v_user_id,
    jsonb_build_object(
      'source', 'separate_label_for_order',
      'label_code', v_label.label_code,
      'order_id', v_order.id,
      'order_item_id', v_order_item.id
    )
  )
  returning id into v_movement_id;

  insert into public.order_items_labels (
    order_id,
    order_item_id,
    label_id,
    qty_used,
    unit_label
  )
  values (
    v_order.id,
    null,
    v_label.id,
    v_qty_to_use,
    upper(btrim(v_label.unit_label))
  );

  update public.inventory_labels
  set
    status = 'separated',
    order_id = v_order.id,
    separated_at = now(),
    separated_by = v_user_id,
    used_qty = coalesce(used_qty, 0) + v_qty_to_use,
    qty_balance = greatest(coalesce(qty_balance, 0) - v_qty_to_use, 0),
    last_action = 'ORDER_SEPARATION',
    movement_id = v_movement_id
  where id = v_label.id
  returning * into v_label;

  return next v_label;
end;
$$;

revoke all on function public.separate_label_for_order(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.separate_label_for_order(text, uuid, uuid)
  to authenticated, service_role;

commit;
