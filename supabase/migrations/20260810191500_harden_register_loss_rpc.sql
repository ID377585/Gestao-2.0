begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.register_loss(
  p_establishment_id uuid,
  p_product_id uuid,
  p_qty numeric,
  p_unit_label text,
  p_reason text default null,
  p_reason_detail text default null,
  p_lot text default null,
  p_label_code text default null,
  p_user_id uuid default null,
  p_allow_negative boolean default false
)
returns table (
  loss_id uuid,
  establishment_id uuid,
  user_id uuid,
  stock_before numeric,
  stock_after numeric,
  label_id uuid,
  label_before numeric,
  label_after numeric
)
language plpgsql
security invoker
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_user_id uuid;
  v_loss_id uuid;
  v_stock_balance_id uuid;
  v_inventory_movement_id uuid;
  v_stock_before numeric;
  v_stock_after numeric;
  v_expected_stock_after numeric;
  v_stock_unit text;
  v_product_name text;
  v_product_sku text;
  v_product_unit text;
  v_unit_label text;
  v_label_code text;
  v_label_id uuid;
  v_label_before numeric;
  v_label_after numeric;
  v_label_unit text;
  v_reason text;
  v_reason_detail text;
  v_lot text;
  v_allow_negative boolean := coalesce(p_allow_negative, false);
begin
  v_user_id := coalesce(p_user_id, (select auth.uid()));
  v_label_code := nullif(btrim(coalesce(p_label_code, '')), '');
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  v_reason_detail := nullif(btrim(coalesce(p_reason_detail, '')), '');
  v_lot := nullif(btrim(coalesce(p_lot, '')), '');

  if p_establishment_id is null then
    raise exception 'Estabelecimento não informado.'
      using errcode = '22023';
  end if;

  if p_product_id is null then
    raise exception 'Produto não informado.'
      using errcode = '22023';
  end if;

  if v_user_id is null then
    raise exception 'Usuário não informado.'
      using errcode = '42501';
  end if;

  if coalesce(p_qty, 0) <= 0 then
    raise exception 'Quantidade da perda precisa ser maior que zero.'
      using errcode = '22023';
  end if;

  if v_reason is null then
    raise exception 'Motivo da perda não informado.'
      using errcode = '22023';
  end if;

  if char_length(v_reason) > 120
    or char_length(coalesce(v_reason_detail, '')) > 1000
    or char_length(coalesce(v_lot, '')) > 120
    or char_length(coalesce(v_label_code, '')) > 200
  then
    raise exception 'Dados da perda excedem os limites permitidos.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.establishments e
    where e.id = p_establishment_id
      and coalesce(e.is_active, true) = true
  ) then
    raise exception 'Estabelecimento inválido ou inativo.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = v_user_id
      and coalesce(m.is_active, true) = true
  )
  and not exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = v_user_id
      and em.is_active = true
  ) then
    raise exception 'Usuário não pertence ao estabelecimento informado.'
      using errcode = '42501';
  end if;

  select
    p.name,
    coalesce(p.sku, ''),
    p.default_unit_label
  into
    v_product_name,
    v_product_sku,
    v_product_unit
  from public.products p
  where p.id = p_product_id
    and p.establishment_id = p_establishment_id
    and coalesce(p.is_active, true) = true;

  if not found then
    raise exception 'Produto inválido para o estabelecimento ativo.'
      using errcode = '42501';
  end if;

  v_unit_label := upper(
    coalesce(
      nullif(btrim(coalesce(p_unit_label, '')), ''),
      nullif(btrim(coalesce(v_product_unit, '')), ''),
      'UN'
    )
  );

  if char_length(v_unit_label) > 30 then
    raise exception 'Unidade da perda excede o limite permitido.'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_establishment_id::text || ':' || p_product_id::text || ':' || v_unit_label,
      0
    )
  );

  select
    sb.id,
    sb.quantity,
    upper(coalesce(nullif(btrim(sb.unit_label), ''), 'UN'))
  into
    v_stock_balance_id,
    v_stock_before,
    v_stock_unit
  from public.stock_balances sb
  where sb.establishment_id = p_establishment_id
    and sb.product_id = p_product_id
  order by sb.created_at asc, sb.id asc
  limit 1
  for update;

  if not found then
    if not v_allow_negative then
      raise exception 'Saldo insuficiente para registrar perda: saldo = 0, tentativa de perda = %', p_qty
        using errcode = '22023';
    end if;

    insert into public.stock_balances (
      establishment_id,
      product_id,
      quantity,
      unit_label
    ) values (
      p_establishment_id,
      p_product_id,
      0,
      v_unit_label
    )
    returning
      id,
      quantity,
      upper(coalesce(nullif(btrim(unit_label), ''), 'UN'))
    into
      v_stock_balance_id,
      v_stock_before,
      v_stock_unit;
  end if;

  v_stock_before := coalesce(v_stock_before, 0);

  if v_stock_unit <> v_unit_label then
    raise exception 'Unidade da perda (%) diverge da unidade do saldo (%).', v_unit_label, v_stock_unit
      using errcode = '22023';
  end if;

  v_expected_stock_after := v_stock_before - p_qty;

  if not v_allow_negative and v_expected_stock_after < 0 then
    raise exception 'Saldo insuficiente para registrar perda: saldo = %, tentativa de perda = %',
      v_stock_before,
      p_qty
      using errcode = '22023';
  end if;

  if v_label_code is not null then
    select
      il.id,
      il.qty_balance,
      upper(coalesce(nullif(btrim(il.unit_label), ''), 'UN'))
    into
      v_label_id,
      v_label_before,
      v_label_unit
    from public.inventory_labels il
    where il.establishment_id = p_establishment_id
      and il.product_id = p_product_id
      and (
        il.label_code = v_label_code
        or il.id::text = v_label_code
      )
    order by
      case when il.label_code = v_label_code then 0 else 1 end,
      il.created_at asc,
      il.id asc
    limit 1
    for update;

    if not found then
      raise exception 'QR Code/Etiqueta não encontrado para este produto e estabelecimento.'
        using errcode = '22023';
    end if;

    if v_label_unit <> v_unit_label then
      raise exception 'Unidade da etiqueta (%) diverge da unidade da perda (%).', v_label_unit, v_unit_label
        using errcode = '22023';
    end if;

    v_label_before := coalesce(v_label_before, 0);
    v_label_after := v_label_before - p_qty;

    if v_label_after < 0 then
      raise exception 'Saldo insuficiente na etiqueta: saldo da etiqueta = %, tentativa de perda = %',
        v_label_before,
        p_qty
        using errcode = '22023';
    end if;
  end if;

  insert into public.losses (
    establishment_id,
    user_id,
    product_id,
    product_name,
    sku,
    unit_label,
    qty,
    lot,
    reason,
    reason_detail,
    qrcode,
    label_code,
    stock_before,
    stock_after,
    label_id
  ) values (
    p_establishment_id,
    v_user_id,
    p_product_id,
    coalesce(v_product_name, ''),
    coalesce(v_product_sku, ''),
    v_unit_label,
    p_qty,
    v_lot,
    v_reason,
    v_reason_detail,
    v_label_code,
    v_label_code,
    v_stock_before,
    v_expected_stock_after,
    v_label_id
  )
  returning id into v_loss_id;

  if v_label_id is not null then
    -- The inventory movement trigger is the single stock mutation path when a
    -- label is present. Writing stock_movements as well would double-count the
    -- same loss in both stock_balances and the current_stock view.
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
      details,
      created_by
    ) values (
      p_establishment_id,
      p_product_id,
      v_label_id,
      p_qty,
      -p_qty,
      v_unit_label,
      'OUT',
      'OUT_LOSS',
      'perda',
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'loss_id', v_loss_id,
          'reason', v_reason,
          'reason_detail', v_reason_detail,
          'label_code', v_label_code,
          'source', 'register_loss'
        )
      ),
      v_user_id
    )
    returning id into v_inventory_movement_id;

    update public.inventory_labels
    set
      qty_balance = v_label_after,
      used_qty = coalesce(used_qty, 0) + p_qty,
      last_action = 'perda',
      movement_id = v_inventory_movement_id
    where id = v_label_id;
  else
    insert into public.stock_movements (
      establishment_id,
      product_id,
      unit_label,
      qty_delta,
      reason,
      source,
      created_by
    ) values (
      p_establishment_id,
      p_product_id,
      v_unit_label,
      -p_qty,
      'perda',
      'register_loss',
      v_user_id
    );

    update public.stock_balances
    set
      quantity = quantity - p_qty,
      updated_at = pg_catalog.now()
    where id = v_stock_balance_id;
  end if;

  select sb.quantity
  into v_stock_after
  from public.stock_balances sb
  where sb.id = v_stock_balance_id;

  if v_stock_after is distinct from v_expected_stock_after then
    raise exception 'Invariante de estoque violada ao registrar perda.'
      using errcode = 'P0001';
  end if;

  insert into public.stock_balance_audit (
    stock_balance_id,
    establishment_id,
    product_id,
    user_id,
    qty_delta,
    qty_before,
    qty_after,
    reason,
    created_at
  ) values (
    v_stock_balance_id,
    p_establishment_id,
    p_product_id,
    v_user_id,
    -p_qty,
    v_stock_before,
    v_stock_after,
    'register_loss',
    pg_catalog.now()
  );

  return query
  select
    v_loss_id,
    p_establishment_id,
    v_user_id,
    v_stock_before,
    v_stock_after,
    v_label_id,
    v_label_before,
    v_label_after;
end;
$function$;

create or replace function public.register_loss(
  p_establishment_id uuid,
  p_product_id uuid,
  p_qty numeric,
  p_unit_label text,
  p_reason text default null,
  p_reason_detail text default null,
  p_lot text default null,
  p_label_code text default null,
  p_user_id uuid default null
)
returns table (
  loss_id uuid,
  establishment_id uuid,
  user_id uuid,
  stock_before numeric,
  stock_after numeric,
  label_id uuid,
  label_before numeric,
  label_after numeric
)
language sql
security invoker
set search_path = pg_catalog, public, auth, pg_temp
as $function$
  select *
  from public.register_loss(
    p_establishment_id,
    p_product_id,
    p_qty,
    p_unit_label,
    p_reason,
    p_reason_detail,
    p_lot,
    p_label_code,
    p_user_id,
    false
  );
$function$;

revoke all on function public.register_loss(
  uuid, uuid, numeric, text, text, text, text, text, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.register_loss(
  uuid, uuid, numeric, text, text, text, text, text, uuid, boolean
) to service_role;

revoke all on function public.register_loss(
  uuid, uuid, numeric, text, text, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.register_loss(
  uuid, uuid, numeric, text, text, text, text, text, uuid
) to service_role;

-- Loss writes are transactional and must only happen through the server-side
-- RPC. Authenticated sessions retain tenant-scoped read access.
drop policy if exists losses_member_insert on public.losses;
revoke insert, update, delete, truncate, references, trigger
  on table public.losses from authenticated;
revoke all on table public.losses from public, anon;
grant select on table public.losses to authenticated;

comment on function public.register_loss(
  uuid, uuid, numeric, text, text, text, text, text, uuid, boolean
) is
  'Service-role-only atomic loss registration with tenant membership validation, stock invariants, label-safe movement accounting and append-only audit.';

notify pgrst, 'reload schema';

commit;
