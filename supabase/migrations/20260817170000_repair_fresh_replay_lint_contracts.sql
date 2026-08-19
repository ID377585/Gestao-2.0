begin;

-- Reconstruct the order transition contract that exists in Production but was
-- historically created outside the migration chain. Fresh environments such
-- as staging must be reproducible from versioned migrations only.
create table if not exists public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  enabled boolean not null default true,
  primary key (from_status, to_status)
);

alter table public.order_status_transitions enable row level security;
alter table public.order_status_transitions force row level security;

revoke all on table public.order_status_transitions from public, anon, authenticated;
grant select on table public.order_status_transitions to authenticated;
grant all on table public.order_status_transitions to service_role;

drop policy if exists gestify_order_status_transitions_read on public.order_status_transitions;
create policy gestify_order_status_transitions_read
on public.order_status_transitions
for select
to authenticated
using (true);

insert into public.order_status_transitions (from_status, to_status, enabled)
values
  ('pedido_criado'::public.order_status, 'aceitou_pedido'::public.order_status, true),
  ('aceitou_pedido'::public.order_status, 'em_preparo'::public.order_status, true),
  ('em_preparo'::public.order_status, 'em_separacao'::public.order_status, true),
  ('em_separacao'::public.order_status, 'em_faturamento'::public.order_status, true),
  ('em_faturamento'::public.order_status, 'em_transporte'::public.order_status, true),
  ('em_transporte'::public.order_status, 'entregue'::public.order_status, true)
on conflict (from_status, to_status)
do update set enabled = excluded.enabled;

-- Repair functions that remain valid at runtime in the evolved Production schema
-- but fail static validation after a clean replay because legacy public helpers
-- were intentionally removed. Keep authorization scoped to the order tenant.

create or replace function private.accept_order_impl(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_establishment_id uuid;
  v_role text;
  v_status public.order_status;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select o.establishment_id, o.status
    into v_establishment_id, v_status
  from public.orders o
  where o.id = _order_id
  for update;

  if v_establishment_id is null then
    raise exception 'Order not found' using errcode = '42501';
  end if;

  select candidate.role
    into v_role
  from (
    select em.role::text as role, 1 as priority
    from public.establishment_memberships em
    where em.establishment_id = v_establishment_id
      and em.user_id = v_user_id
      and em.is_active = true
    union all
    select m.role::text as role, 2 as priority
    from public.memberships m
    where m.establishment_id = v_establishment_id
      and m.user_id = v_user_id
      and coalesce(m.is_active, true) = true
  ) candidate
  order by candidate.priority
  limit 1;

  if coalesce(v_role, '') not in ('admin', 'operacao', 'producao') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_status <> 'pedido_criado'::public.order_status then
    raise exception 'Only orders in pedido_criado can be accepted. Current: %', v_status;
  end if;

  update public.orders
  set status = 'aceitou_pedido'::public.order_status,
      accepted_at = now(),
      accepted_by = v_user_id,
      updated_at = now()
  where id = _order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events (
    order_id, establishment_id, from_status, to_status, action,
    message, client_label, note, created_by
  ) values (
    _order_id, v_establishment_id,
    'pedido_criado'::public.order_status,
    'aceitou_pedido'::public.order_status,
    'accept', 'Pedido aceito pela operação.', 'Pedido aceito',
    'Pedido aceito pela operação.', v_user_id
  );
end;
$$;

revoke all on function private.accept_order_impl(uuid) from public, anon;
grant execute on function private.accept_order_impl(uuid) to authenticated, service_role;

create or replace function public.advance_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_establishment_id uuid;
  v_role text;
  v_from_status public.order_status;
begin
  if v_uid is null then
    raise exception 'Authenticated user required' using errcode = '42501';
  end if;

  select o.establishment_id, o.status
    into v_establishment_id, v_from_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if v_establishment_id is null then
    raise exception 'Order not found' using errcode = '42501';
  end if;

  select candidate.role
    into v_role
  from (
    select em.role::text as role, 1 as priority
    from public.establishment_memberships em
    where em.establishment_id = v_establishment_id
      and em.user_id = v_uid
      and em.is_active = true
    union all
    select m.role::text as role, 2 as priority
    from public.memberships m
    where m.establishment_id = v_establishment_id
      and m.user_id = v_uid
      and coalesce(m.is_active, true) = true
  ) candidate
  order by candidate.priority
  limit 1;

  if coalesce(v_role, '') not in ('admin','operacao','producao','estoque','fiscal','entrega') then
    raise exception 'Role cannot advance order' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.order_status_transitions t
    where t.from_status = v_from_status
      and t.to_status = p_to_status
      and t.enabled = true
  ) then
    raise exception 'Transition not allowed' using errcode = '42501';
  end if;

  update public.orders
  set status = p_to_status
  where id = p_order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events (
    order_id, establishment_id, from_status, to_status, action, note, created_by
  ) values (
    p_order_id, v_establishment_id, v_from_status, p_to_status,
    'advance', p_note, v_uid
  );
end;
$$;

create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_establishment_id uuid;
  v_role text;
  v_from_status public.order_status;
begin
  if v_uid is null then
    raise exception 'Authenticated user required' using errcode = '42501';
  end if;

  select o.establishment_id, o.status
    into v_establishment_id, v_from_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if v_establishment_id is null then
    raise exception 'Order not found' using errcode = '42501';
  end if;

  select candidate.role
    into v_role
  from (
    select em.role::text as role, 1 as priority
    from public.establishment_memberships em
    where em.establishment_id = v_establishment_id
      and em.user_id = v_uid
      and em.is_active = true
    union all
    select m.role::text as role, 2 as priority
    from public.memberships m
    where m.establishment_id = v_establishment_id
      and m.user_id = v_uid
      and coalesce(m.is_active, true) = true
  ) candidate
  order by candidate.priority
  limit 1;

  if coalesce(v_role, '') not in ('admin','operacao') then
    raise exception 'Only admin/operacao can cancel' using errcode = '42501';
  end if;

  if v_from_status in ('entregue'::public.order_status, 'cancelado'::public.order_status) then
    raise exception 'Cannot cancel in status %', v_from_status::text using errcode = '42501';
  end if;

  update public.orders
  set status = 'cancelado'::public.order_status
  where id = p_order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events (
    order_id, establishment_id, from_status, to_status, action, note, created_by
  ) values (
    p_order_id, v_establishment_id, v_from_status,
    'cancelado'::public.order_status, 'cancel', p_reason, v_uid
  );
end;
$$;

create or replace function public.reopen_order(
  p_order_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_establishment_id uuid;
  v_role text;
  v_from_status public.order_status;
  v_to_status public.order_status := 'aceitou_pedido'::public.order_status;
begin
  if v_uid is null then
    raise exception 'Authenticated user required' using errcode = '42501';
  end if;

  select o.establishment_id, o.status
    into v_establishment_id, v_from_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if v_establishment_id is null then
    raise exception 'Order not found' using errcode = '42501';
  end if;

  select candidate.role
    into v_role
  from (
    select em.role::text as role, 1 as priority
    from public.establishment_memberships em
    where em.establishment_id = v_establishment_id
      and em.user_id = v_uid
      and em.is_active = true
    union all
    select m.role::text as role, 2 as priority
    from public.memberships m
    where m.establishment_id = v_establishment_id
      and m.user_id = v_uid
      and coalesce(m.is_active, true) = true
  ) candidate
  order by candidate.priority
  limit 1;

  if coalesce(v_role, '') <> 'admin' then
    raise exception 'Only admin can reopen' using errcode = '42501';
  end if;

  if v_from_status <> 'cancelado'::public.order_status then
    raise exception 'Only canceled orders can be reopened' using errcode = '42501';
  end if;

  update public.orders
  set status = v_to_status
  where id = p_order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events (
    order_id, establishment_id, from_status, to_status, action, note, created_by
  ) values (
    p_order_id, v_establishment_id, v_from_status, v_to_status,
    'reopen', p_note, v_uid
  );
end;
$$;

-- The orders contract now has explicit creator/customer columns, so the legacy
-- dynamic owner-column helper is no longer needed.
create or replace function public.order_belongs_to_user(_order_id uuid, _uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select case
    when _order_id is null or _uid is null then false
    when coalesce((select auth.role()), '') <> 'service_role'
      and ((select auth.uid()) is null or _uid <> (select auth.uid())) then false
    else exists (
      select 1
      from public.orders o
      where o.id = _order_id
        and (o.created_by = _uid or o.customer_user_id = _uid)
    )
  end;
$$;

-- Use a query-driven loop instead of FOREACH over a function-returned array.
-- This remains equivalent at runtime and is statically analyzable by db lint.
create or replace function public.gestify_legacy_tenant_null_counts()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  table_name text;
  v_count bigint;
  v_counts jsonb := '[]'::jsonb;
begin
  for table_name in
    select unnest(private.gestify_legacy_table_names())
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('select count(*) from public.%I where establishment_id is null', table_name)
        into v_count;
      v_counts := v_counts || jsonb_build_array(
        jsonb_build_object('table', table_name, 'null_establishment_rows', v_count)
      );
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'tables', v_counts);
end;
$$;

create or replace function public.gestify_backfill_legacy_tenant(
  p_establishment_id uuid,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  table_name text;
  v_missing_rows bigint;
  v_updated_rows bigint;
  v_results jsonb := '[]'::jsonb;
begin
  if p_establishment_id is null then
    raise exception 'p_establishment_id is required';
  end if;

  if not exists (select 1 from public.establishments e where e.id = p_establishment_id) then
    raise exception 'establishment % not found', p_establishment_id;
  end if;

  for table_name in
    select unnest(private.gestify_legacy_table_names())
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('select count(*) from public.%I where establishment_id is null', table_name)
        into v_missing_rows;

      if p_dry_run then
        v_updated_rows := 0;
      else
        execute format('update public.%I set establishment_id = $1 where establishment_id is null', table_name)
          using p_establishment_id;
        get diagnostics v_updated_rows = row_count;
      end if;

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'table', table_name,
          'missing_before', v_missing_rows,
          'updated', v_updated_rows
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'dry_run', p_dry_run,
    'establishment_id', p_establishment_id,
    'tables', v_results
  );
end;
$$;

revoke all on function public.advance_order_status(uuid, public.order_status, text) from public, anon;
revoke all on function public.cancel_order(uuid, text) from public, anon;
revoke all on function public.reopen_order(uuid, text) from public, anon;
revoke all on function public.order_belongs_to_user(uuid, uuid) from public, anon;
revoke all on function public.gestify_legacy_tenant_null_counts() from public, anon, authenticated;
revoke all on function public.gestify_backfill_legacy_tenant(uuid, boolean) from public, anon, authenticated;

grant execute on function public.advance_order_status(uuid, public.order_status, text) to authenticated, service_role;
grant execute on function public.cancel_order(uuid, text) to authenticated, service_role;
grant execute on function public.reopen_order(uuid, text) to authenticated, service_role;
grant execute on function public.order_belongs_to_user(uuid, uuid) to authenticated, service_role;
grant execute on function public.gestify_legacy_tenant_null_counts() to service_role;
grant execute on function public.gestify_backfill_legacy_tenant(uuid, boolean) to service_role;

notify pgrst, 'reload schema';

commit;
