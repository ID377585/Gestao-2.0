begin;

-- Keep the public RPC contract used by the application, but move the
-- privileged implementation out of PostgREST's exposed public schema.
grant usage on schema private to authenticated, service_role;

create or replace function private.accept_order_impl(_order_id uuid)
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

revoke all on function private.accept_order_impl(uuid) from public, anon;
grant execute on function private.accept_order_impl(uuid) to authenticated, service_role;

create or replace function public.accept_order(_order_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, private, auth, pg_temp
as $$
begin
  perform private.accept_order_impl(_order_id);
end;
$$;

revoke execute on function public.accept_order(uuid) from public, anon;
grant execute on function public.accept_order(uuid) to authenticated, service_role;

create or replace function private.separate_label_for_order_impl(
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

  if not (select private.gestify_has_establishment_role(
    v_order.establishment_id,
    array['admin','operacao','estoque','producao']::text[]
  )) then
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

revoke all on function private.separate_label_for_order_impl(text, uuid, uuid)
  from public, anon;
grant execute on function private.separate_label_for_order_impl(text, uuid, uuid)
  to authenticated, service_role;

create or replace function public.separate_label_for_order(
  p_label_code text,
  p_order_id uuid,
  p_user_id uuid
)
returns setof public.inventory_labels
language sql
security invoker
set search_path = public, private, auth, pg_temp
as $$
  select *
  from private.separate_label_for_order_impl(
    p_label_code,
    p_order_id,
    p_user_id
  );
$$;

revoke execute on function public.separate_label_for_order(text, uuid, uuid)
  from public, anon;
grant execute on function public.separate_label_for_order(text, uuid, uuid)
  to authenticated, service_role;

-- The legacy invoice tables are currently empty, but keep them safely usable.
-- Access is derived through the related order and its establishment.
revoke all privileges on table public.order_invoices from anon;
revoke all privileges on table public.order_invoice_items from anon;
revoke all privileges on table public.pre_invoices from anon;
revoke all privileges on table public.pre_invoice_items from anon;

revoke truncate, references, trigger on table public.order_invoices from authenticated;
revoke truncate, references, trigger on table public.order_invoice_items from authenticated;
revoke truncate, references, trigger on table public.pre_invoices from authenticated;
revoke truncate, references, trigger on table public.pre_invoice_items from authenticated;

grant select, insert, update, delete on table public.order_invoices to authenticated;
grant select, insert, update, delete on table public.order_invoice_items to authenticated;
grant select, insert, update, delete on table public.pre_invoices to authenticated;
grant select, insert, update, delete on table public.pre_invoice_items to authenticated;

drop policy if exists "invoice_access" on public.order_invoices;
drop policy if exists "invoice_items_access" on public.order_invoice_items;
drop policy if exists "pre_invoices_insert" on public.pre_invoices;
drop policy if exists "pre_invoices_select" on public.pre_invoices;
drop policy if exists "pre_invoices_update" on public.pre_invoices;
drop policy if exists "pre_invoice_items_select" on public.pre_invoice_items;
drop policy if exists "pre_invoice_items_write" on public.pre_invoice_items;

create policy "order_invoices_select_scoped"
on public.order_invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_invoices.order_id
      and (
        (select private.gestify_has_establishment_role(
          o.establishment_id,
          array['admin','operacao','estoque','fiscal']::text[]
        ))
        or o.created_by = (select auth.uid())
        or o.customer_user_id = (select auth.uid())
      )
  )
);

create policy "order_invoices_insert_scoped"
on public.order_invoices
for insert
to authenticated
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_invoices.order_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
);

create policy "order_invoices_update_scoped"
on public.order_invoices
for update
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_invoices.order_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_invoices.order_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
);

create policy "order_invoices_delete_scoped"
on public.order_invoices
for delete
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_invoices.order_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','fiscal']::text[]
      ))
  )
);

create policy "order_invoice_items_select_scoped"
on public.order_invoice_items
for select
to authenticated
using (
  exists (
    select 1
    from public.order_invoices oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_invoice_items.invoice_id
      and (
        (select private.gestify_has_establishment_role(
          o.establishment_id,
          array['admin','operacao','estoque','fiscal']::text[]
        ))
        or o.created_by = (select auth.uid())
        or o.customer_user_id = (select auth.uid())
      )
  )
);

create policy "order_invoice_items_insert_scoped"
on public.order_invoice_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.order_invoices oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_invoice_items.invoice_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
);

create policy "order_invoice_items_update_scoped"
on public.order_invoice_items
for update
to authenticated
using (
  exists (
    select 1
    from public.order_invoices oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_invoice_items.invoice_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
)
with check (
  exists (
    select 1
    from public.order_invoices oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_invoice_items.invoice_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
);

create policy "order_invoice_items_delete_scoped"
on public.order_invoice_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.order_invoices oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_invoice_items.invoice_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','fiscal']::text[]
      ))
  )
);

create policy "pre_invoices_select_scoped"
on public.pre_invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = pre_invoices.order_id
      and (
        (select private.gestify_has_establishment_role(
          o.establishment_id,
          array['admin','operacao','estoque','fiscal']::text[]
        ))
        or o.created_by = (select auth.uid())
        or o.customer_user_id = (select auth.uid())
      )
  )
);

create policy "pre_invoices_insert_scoped"
on public.pre_invoices
for insert
to authenticated
with check (
  exists (
    select 1
    from public.orders o
    where o.id = pre_invoices.order_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
);

create policy "pre_invoices_update_scoped"
on public.pre_invoices
for update
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = pre_invoices.order_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = pre_invoices.order_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
);

create policy "pre_invoices_delete_scoped"
on public.pre_invoices
for delete
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = pre_invoices.order_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','fiscal']::text[]
      ))
  )
);

create policy "pre_invoice_items_select_scoped"
on public.pre_invoice_items
for select
to authenticated
using (
  exists (
    select 1
    from public.pre_invoices pi
    join public.orders o on o.id = pi.order_id
    where pi.id = pre_invoice_items.pre_invoice_id
      and (
        (select private.gestify_has_establishment_role(
          o.establishment_id,
          array['admin','operacao','estoque','fiscal']::text[]
        ))
        or o.created_by = (select auth.uid())
        or o.customer_user_id = (select auth.uid())
      )
  )
);

create policy "pre_invoice_items_insert_scoped"
on public.pre_invoice_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.pre_invoices pi
    join public.orders o on o.id = pi.order_id
    where pi.id = pre_invoice_items.pre_invoice_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
);

create policy "pre_invoice_items_update_scoped"
on public.pre_invoice_items
for update
to authenticated
using (
  exists (
    select 1
    from public.pre_invoices pi
    join public.orders o on o.id = pi.order_id
    where pi.id = pre_invoice_items.pre_invoice_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
)
with check (
  exists (
    select 1
    from public.pre_invoices pi
    join public.orders o on o.id = pi.order_id
    where pi.id = pre_invoice_items.pre_invoice_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque','fiscal']::text[]
      ))
  )
);

create policy "pre_invoice_items_delete_scoped"
on public.pre_invoice_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.pre_invoices pi
    join public.orders o on o.id = pi.order_id
    where pi.id = pre_invoice_items.pre_invoice_id
      and (select private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','fiscal']::text[]
      ))
  )
);

revoke execute on function public.can_faturar() from public, anon, authenticated;
grant execute on function public.can_faturar() to service_role;

notify pgrst, 'reload schema';

commit;
