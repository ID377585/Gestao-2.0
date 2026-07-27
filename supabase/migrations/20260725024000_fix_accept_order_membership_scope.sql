begin;

create or replace function public.accept_order(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_establishment_id uuid;
  v_role text;
  v_status public.order_status;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select am.establishment_id, am.role
    into v_establishment_id, v_role
  from public.active_membership() am;

  if v_establishment_id is null then
    raise exception 'No active membership';
  end if;

  if v_role not in ('admin', 'operacao', 'producao') then
    raise exception 'Not allowed';
  end if;

  select o.status
    into v_status
  from public.orders o
  where o.id = _order_id
    and o.establishment_id = v_establishment_id
  for update;

  if v_status is null then
    raise exception 'Order not found or outside establishment';
  end if;

  if v_status <> 'pedido_criado' then
    raise exception 'Only orders in pedido_criado can be accepted. Current: %', v_status;
  end if;

  update public.orders
  set
    status = 'aceitou_pedido',
    accepted_at = now(),
    accepted_by = v_user_id,
    updated_at = now()
  where id = _order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events (
    order_id,
    establishment_id,
    from_status,
    to_status,
    action,
    message,
    client_label,
    note,
    created_by
  )
  values (
    _order_id,
    v_establishment_id,
    'pedido_criado',
    'aceitou_pedido',
    'accept',
    'Pedido aceito pela operação.',
    'Pedido aceito',
    'Pedido aceito pela operação.',
    v_user_id
  );
end;
$$;

revoke all on function public.accept_order(uuid)
  from public, anon, authenticated;
grant execute on function public.accept_order(uuid)
  to authenticated, service_role;

commit;
