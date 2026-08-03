begin;

create or replace function public.advance_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_uid uuid;
  v_establishment_id uuid;
  v_role text;
  v_from_status public.order_status;
begin
  v_uid := (select auth.uid());

  if v_uid is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  select am.establishment_id, am.role
    into v_establishment_id, v_role
  from public.active_membership() am;

  if v_establishment_id is null then
    raise exception 'No active membership'
      using errcode = '42501';
  end if;

  if coalesce(v_role, '') not in (
    'admin',
    'operacao',
    'producao',
    'estoque',
    'fiscal',
    'entrega'
  ) then
    raise exception 'Role cannot advance order'
      using errcode = '42501';
  end if;

  select o.status
    into v_from_status
  from public.orders o
  where o.id = p_order_id
    and o.establishment_id = v_establishment_id
  for update;

  if v_from_status is null then
    raise exception 'Order not found or outside establishment'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.order_status_transitions t
    where t.from_status = v_from_status
      and t.to_status = p_to_status
      and t.enabled = true
  ) then
    raise exception 'Transition not allowed'
      using errcode = '42501';
  end if;

  update public.orders
  set status = p_to_status
  where id = p_order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events(
    order_id,
    establishment_id,
    from_status,
    to_status,
    action,
    note,
    created_by
  ) values (
    p_order_id,
    v_establishment_id,
    v_from_status,
    p_to_status,
    'advance',
    p_note,
    v_uid
  );
end;
$function$;

create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_uid uuid;
  v_establishment_id uuid;
  v_role text;
  v_from_status public.order_status;
begin
  v_uid := (select auth.uid());

  if v_uid is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  select am.establishment_id, am.role
    into v_establishment_id, v_role
  from public.active_membership() am;

  if v_establishment_id is null then
    raise exception 'No active membership'
      using errcode = '42501';
  end if;

  if v_role not in ('admin','operacao') then
    raise exception 'Only admin/operacao can cancel'
      using errcode = '42501';
  end if;

  select o.status
    into v_from_status
  from public.orders o
  where o.id = p_order_id
    and o.establishment_id = v_establishment_id
  for update;

  if v_from_status is null then
    raise exception 'Order not found or outside establishment'
      using errcode = '42501';
  end if;

  if v_from_status in (
    'entregue'::public.order_status,
    'cancelado'::public.order_status
  ) then
    raise exception 'Cannot cancel in status %', v_from_status::text
      using errcode = '42501';
  end if;

  update public.orders
  set status = 'cancelado'::public.order_status
  where id = p_order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events(
    order_id,
    establishment_id,
    from_status,
    to_status,
    action,
    note,
    created_by
  ) values (
    p_order_id,
    v_establishment_id,
    v_from_status,
    'cancelado'::public.order_status,
    'cancel',
    p_reason,
    v_uid
  );
end;
$function$;

create or replace function public.reopen_order(
  p_order_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_uid uuid;
  v_establishment_id uuid;
  v_role text;
  v_from_status public.order_status;
  v_to_status public.order_status := 'aceitou_pedido'::public.order_status;
begin
  v_uid := (select auth.uid());

  if v_uid is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  select am.establishment_id, am.role
    into v_establishment_id, v_role
  from public.active_membership() am;

  if v_establishment_id is null then
    raise exception 'No active membership'
      using errcode = '42501';
  end if;

  if v_role <> 'admin' then
    raise exception 'Only admin can reopen'
      using errcode = '42501';
  end if;

  select o.status
    into v_from_status
  from public.orders o
  where o.id = p_order_id
    and o.establishment_id = v_establishment_id
  for update;

  if v_from_status is null then
    raise exception 'Order not found or outside establishment'
      using errcode = '42501';
  end if;

  if v_from_status <> 'cancelado'::public.order_status then
    raise exception 'Only canceled orders can be reopened'
      using errcode = '42501';
  end if;

  update public.orders
  set status = v_to_status
  where id = p_order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events(
    order_id,
    establishment_id,
    from_status,
    to_status,
    action,
    note,
    created_by
  ) values (
    p_order_id,
    v_establishment_id,
    v_from_status,
    v_to_status,
    'reopen',
    p_note,
    v_uid
  );
end;
$function$;

create or replace function public.gestify_ensure_stock_balance_for_product(
  p_establishment_id uuid,
  p_product_id uuid,
  p_unit_label text default 'UN'::text,
  p_default_location text default 'Estoque Principal'::text
)
returns public.stock_balances
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_balance public.stock_balances%rowtype;
  v_product_unit text;
  v_request_role text;
  v_unit_label text;
  v_location text;
  v_has_stock_access boolean;
begin
  if p_establishment_id is null or p_product_id is null then
    raise exception 'establishment_id e product_id são obrigatórios'
      using errcode = '22023';
  end if;

  v_request_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (select auth.role()),
    current_role
  );

  if v_request_role <> 'service_role' then
    select exists (
      select 1
      from public.memberships m
      where m.establishment_id = p_establishment_id
        and m.user_id = (select auth.uid())
        and coalesce(m.is_active, true) = true
        and coalesce(m.role::text, '') <> 'cliente'
    )
    or exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = p_establishment_id
        and em.user_id = (select auth.uid())
        and coalesce(em.is_active, true) = true
        and coalesce(em.role::text, '') <> 'cliente'
    )
    into v_has_stock_access;

    if not coalesce(v_has_stock_access, false) then
      raise exception 'sem permissão para este estabelecimento'
        using errcode = '42501';
    end if;
  end if;

  select upper(nullif(trim(p.default_unit_label), ''))
    into v_product_unit
  from public.products p
  where p.id = p_product_id
    and p.establishment_id = p_establishment_id;

  if not found then
    raise exception 'produto inválido para o estabelecimento ativo'
      using errcode = '42501';
  end if;

  v_unit_label := upper(coalesce(nullif(trim(p_unit_label), ''), v_product_unit, 'UN'));
  if v_unit_label not in ('UN', 'KG', 'G', 'L', 'ML') then
    v_unit_label := coalesce(v_product_unit, 'UN');
  end if;

  v_location := coalesce(nullif(trim(p_default_location), ''), 'Estoque Principal');

  perform pg_advisory_xact_lock(
    hashtextextended(p_establishment_id::text || ':' || p_product_id::text, 0)
  );

  select sb.*
    into v_balance
  from public.stock_balances sb
  where sb.establishment_id = p_establishment_id
    and sb.product_id = p_product_id
  order by sb.created_at asc, sb.id asc
  limit 1;

  if found then
    return v_balance;
  end if;

  insert into public.stock_balances (
    establishment_id,
    product_id,
    quantity,
    unit_label,
    min_qty,
    med_qty,
    max_qty,
    location
  )
  values (
    p_establishment_id,
    p_product_id,
    0,
    v_unit_label,
    0,
    0,
    0,
    v_location
  )
  on conflict (establishment_id, product_id, unit_label) do nothing
  returning *
  into v_balance;

  if v_balance.id is not null then
    return v_balance;
  end if;

  select sb.*
    into v_balance
  from public.stock_balances sb
  where sb.establishment_id = p_establishment_id
    and sb.product_id = p_product_id
  order by sb.created_at asc, sb.id asc
  limit 1;

  if v_balance.id is null then
    raise exception 'não foi possível garantir saldo de estoque'
      using errcode = 'P0001';
  end if;

  return v_balance;
end;
$function$;

revoke all on function public.advance_order_status(uuid, public.order_status, text)
  from public, anon;
revoke all on function public.cancel_order(uuid, text)
  from public, anon;
revoke all on function public.reopen_order(uuid, text)
  from public, anon;
revoke all on function public.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text)
  from public, anon;

grant execute on function public.advance_order_status(uuid, public.order_status, text)
  to authenticated, service_role;
grant execute on function public.cancel_order(uuid, text)
  to authenticated, service_role;
grant execute on function public.reopen_order(uuid, text)
  to authenticated, service_role;
grant execute on function public.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
