begin;

create or replace function public.create_inventory_label(
  p_establishment_id uuid,
  p_product_id uuid,
  p_label_code text,
  p_qty numeric,
  p_unit_label text,
  p_notes text default null,
  p_label_type text default null
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
  v_user_id uuid := auth.uid();
  v_label public.inventory_labels%rowtype;
  v_unit_label text := upper(trim(coalesce(p_unit_label, '')));
  v_label_code text := trim(coalesce(p_label_code, ''));
  v_before_qty numeric := 0;
  v_after_qty numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if p_establishment_id is null then
    raise exception 'Estabelecimento não informado.';
  end if;

  if not private.gestify_has_establishment_role(
    p_establishment_id,
    array['admin', 'operacao', 'estoque']
  ) then
    raise exception 'Sem permissão para criar etiquetas neste estabelecimento.';
  end if;

  if p_product_id is null then
    raise exception 'Produto não informado.';
  end if;

  if v_label_code = '' then
    raise exception 'Código/Lote da etiqueta vazio.';
  end if;

  if v_unit_label = '' then
    raise exception 'Unidade não informada.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantidade inválida.';
  end if;

  perform 1
  from public.products p
  where p.id = p_product_id
    and p.establishment_id = p_establishment_id;

  if not found then
    raise exception 'Produto não encontrado neste estabelecimento.';
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

revoke all on function public.create_inventory_label(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  text
) from public, anon;

grant execute on function public.create_inventory_label(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  text
) to authenticated;

commit;
