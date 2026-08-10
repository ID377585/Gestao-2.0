-- P0: consolidate order RLS, reduce table privileges and enforce lifecycle
-- mutations through server-side/RPC flows.
--
-- DATA SAFETY: this migration does not update or delete order rows. Apply it
-- only in isolated staging after the automated two-tenant cutover drill passes.

begin;

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Canonical tenant and role helpers
-- ---------------------------------------------------------------------------

create or replace function private.gestify_order_role_for_scope(
  p_establishment_id uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  with candidates as (
    select
      m.role::text as role,
      1 as source_priority,
      m.created_at
    from public.memberships m
    where m.user_id = (select auth.uid())
      and coalesce(m.is_active, true) = true
      and coalesce(m.unit_id, m.establishment_id) = p_establishment_id

    union all

    select
      em.role::text as role,
      2 as source_priority,
      em.created_at
    from public.establishment_memberships em
    where em.user_id = (select auth.uid())
      and coalesce(em.is_active, true) = true
      and em.establishment_id = p_establishment_id
  )
  select candidate.role
  from candidates candidate
  order by
    case candidate.role
      when 'admin' then 1
      when 'operacao' then 2
      when 'producao' then 3
      when 'estoque' then 4
      when 'fiscal' then 5
      when 'entrega' then 6
      when 'cliente' then 7
      else 99
    end,
    candidate.source_priority,
    candidate.created_at desc
  limit 1
$$;

create or replace function private.gestify_order_is_staff(
  p_establishment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select coalesce(
    private.gestify_order_role_for_scope(p_establishment_id) in (
      'admin',
      'operacao',
      'producao',
      'estoque',
      'fiscal',
      'entrega'
    ),
    false
  )
$$;

create or replace function private.gestify_order_can_read(
  p_establishment_id uuid,
  p_created_by uuid,
  p_customer_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select coalesce(
    private.gestify_order_is_staff(p_establishment_id)
    or (
      private.gestify_order_role_for_scope(p_establishment_id) = 'cliente'
      and (
        p_created_by = (select auth.uid())
        or p_customer_user_id = (select auth.uid())
      )
    ),
    false
  )
$$;

create or replace function private.gestify_order_can_read_event(
  p_establishment_id uuid,
  p_created_by uuid,
  p_customer_user_id uuid,
  p_visible_to_client boolean
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select coalesce(
    private.gestify_order_is_staff(p_establishment_id)
    or (
      coalesce(p_visible_to_client, false) = true
      and private.gestify_order_role_for_scope(p_establishment_id) = 'cliente'
      and (
        p_created_by = (select auth.uid())
        or p_customer_user_id = (select auth.uid())
      )
    ),
    false
  )
$$;

create or replace function private.gestify_order_can_update_metadata(
  p_establishment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select coalesce(
    private.gestify_order_role_for_scope(p_establishment_id) in (
      'admin',
      'operacao'
    ),
    false
  )
$$;

create or replace function private.gestify_order_role_can_transition(
  p_role text,
  p_from public.order_status,
  p_to public.order_status
)
returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select case
    when p_from = 'pedido_criado'::public.order_status
      and p_to = 'aceitou_pedido'::public.order_status
      then p_role in ('admin', 'operacao', 'producao')
    when p_from = 'aceitou_pedido'::public.order_status
      and p_to = 'em_preparo'::public.order_status
      then p_role in ('admin', 'operacao', 'producao')
    when p_from = 'em_preparo'::public.order_status
      and p_to = 'em_separacao'::public.order_status
      then p_role in ('admin', 'operacao', 'producao')
    when p_from = 'em_separacao'::public.order_status
      and p_to = 'em_faturamento'::public.order_status
      then p_role in ('admin', 'operacao', 'producao', 'estoque')
    when p_from = 'em_faturamento'::public.order_status
      and p_to = 'em_transporte'::public.order_status
      then p_role in ('admin', 'estoque', 'fiscal')
    when p_from = 'em_transporte'::public.order_status
      and p_to = 'entregue'::public.order_status
      then p_role in ('admin', 'entrega', 'fiscal')
    else false
  end
$$;

revoke all on function private.gestify_order_role_for_scope(uuid)
  from public, anon, authenticated;
revoke all on function private.gestify_order_is_staff(uuid)
  from public, anon, authenticated;
revoke all on function private.gestify_order_can_read(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.gestify_order_can_read_event(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function private.gestify_order_can_update_metadata(uuid)
  from public, anon, authenticated;
revoke all on function private.gestify_order_role_can_transition(
  text,
  public.order_status,
  public.order_status
) from public, anon, authenticated;

grant execute on function private.gestify_order_role_for_scope(uuid)
  to authenticated, service_role;
grant execute on function private.gestify_order_is_staff(uuid)
  to authenticated, service_role;
grant execute on function private.gestify_order_can_read(uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function private.gestify_order_can_read_event(uuid, uuid, uuid, boolean)
  to authenticated, service_role;
grant execute on function private.gestify_order_can_update_metadata(uuid)
  to authenticated, service_role;
grant execute on function private.gestify_order_role_can_transition(
  text,
  public.order_status,
  public.order_status
) to authenticated, service_role;

-- Covers the exact active-membership lookup used by the canonical helper.
-- This is additive; no historical index is removed by this migration.
create index if not exists memberships_user_active_scope_role_idx
  on public.memberships (
    user_id,
    (coalesce(unit_id, establishment_id)),
    role,
    created_at desc
  )
  where is_active = true;

-- ---------------------------------------------------------------------------
-- Canonical lifecycle RPCs
-- ---------------------------------------------------------------------------

create or replace function private.accept_order_impl(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_establishment_id uuid;
  v_role text;
  v_status public.order_status;
begin
  if v_uid is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  select order_row.establishment_id, order_row.status
    into v_establishment_id, v_status
  from public.orders order_row
  where order_row.id = _order_id
  for update;

  if v_establishment_id is null then
    raise exception 'Order not found or outside establishment'
      using errcode = '42501';
  end if;

  v_role := private.gestify_order_role_for_scope(v_establishment_id);

  if coalesce(v_role, '') not in ('admin', 'operacao', 'producao') then
    raise exception 'Not allowed'
      using errcode = '42501';
  end if;

  if v_status <> 'pedido_criado'::public.order_status then
    raise exception 'Only orders in pedido_criado can be accepted. Current: %',
      v_status::text
      using errcode = '42501';
  end if;

  update public.orders
  set
    status = 'aceitou_pedido'::public.order_status,
    accepted_at = now(),
    accepted_by = v_uid,
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
    created_by,
    visible_to_client
  ) values (
    _order_id,
    v_establishment_id,
    'pedido_criado'::public.order_status,
    'aceitou_pedido'::public.order_status,
    'accept',
    'Pedido aceito pela operação.',
    'Pedido aceito',
    'Pedido aceito pela operação.',
    v_uid,
    true
  );
end;
$$;

create or replace function public.accept_order(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
begin
  perform private.accept_order_impl(_order_id);
end;
$$;

create or replace function public.advance_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_establishment_id uuid;
  v_role text;
  v_from_status public.order_status;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  if v_note is not null and length(v_note) > 1000 then
    raise exception 'Order status note is too long'
      using errcode = '22023';
  end if;

  select order_row.establishment_id, order_row.status
    into v_establishment_id, v_from_status
  from public.orders order_row
  where order_row.id = p_order_id
  for update;

  if v_establishment_id is null then
    raise exception 'Order not found or outside establishment'
      using errcode = '42501';
  end if;

  v_role := private.gestify_order_role_for_scope(v_establishment_id);

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

  if not exists (
    select 1
    from public.order_status_transitions transition
    where transition.from_status = v_from_status
      and transition.to_status = p_to_status
      and transition.enabled = true
  ) then
    raise exception 'Transition not allowed'
      using errcode = '42501';
  end if;

  if not private.gestify_order_role_can_transition(
    v_role,
    v_from_status,
    p_to_status
  ) then
    raise exception 'Role cannot advance order'
      using errcode = '42501';
  end if;

  update public.orders
  set
    status = p_to_status,
    shipped_at = case
      when p_to_status = 'em_transporte'::public.order_status
        then coalesce(shipped_at, now())
      else shipped_at
    end,
    shipped_by = case
      when p_to_status = 'em_transporte'::public.order_status
        then coalesce(shipped_by, v_uid)
      else shipped_by
    end,
    delivered_at = case
      when p_to_status = 'entregue'::public.order_status
        then coalesce(delivered_at, now())
      else delivered_at
    end,
    delivered_by = case
      when p_to_status = 'entregue'::public.order_status
        then coalesce(delivered_by, v_uid)
      else delivered_by
    end,
    updated_at = now()
  where id = p_order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events (
    order_id,
    establishment_id,
    from_status,
    to_status,
    action,
    note,
    created_by,
    visible_to_client
  ) values (
    p_order_id,
    v_establishment_id,
    v_from_status,
    p_to_status,
    'advance',
    v_note,
    v_uid,
    true
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
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_establishment_id uuid;
  v_role text;
  v_from_status public.order_status;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'Cancellation reason is required'
      using errcode = '22023';
  end if;

  if length(v_reason) > 1000 then
    raise exception 'Cancellation reason is too long'
      using errcode = '22023';
  end if;

  select order_row.establishment_id, order_row.status
    into v_establishment_id, v_from_status
  from public.orders order_row
  where order_row.id = p_order_id
  for update;

  if v_establishment_id is null then
    raise exception 'Order not found or outside establishment'
      using errcode = '42501';
  end if;

  v_role := private.gestify_order_role_for_scope(v_establishment_id);

  if coalesce(v_role, '') not in ('admin', 'operacao') then
    raise exception 'Only admin/operacao can cancel'
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
  set
    status = 'cancelado'::public.order_status,
    canceled_at = now(),
    canceled_by = v_uid,
    cancel_reason = v_reason,
    updated_at = now()
  where id = p_order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events (
    order_id,
    establishment_id,
    from_status,
    to_status,
    action,
    note,
    created_by,
    visible_to_client
  ) values (
    p_order_id,
    v_establishment_id,
    v_from_status,
    'cancelado'::public.order_status,
    'cancel',
    v_reason,
    v_uid,
    true
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
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_establishment_id uuid;
  v_role text;
  v_from_status public.order_status;
  v_to_status public.order_status := 'aceitou_pedido'::public.order_status;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  if v_note is not null and length(v_note) > 1000 then
    raise exception 'Reopen note is too long'
      using errcode = '22023';
  end if;

  select order_row.establishment_id, order_row.status
    into v_establishment_id, v_from_status
  from public.orders order_row
  where order_row.id = p_order_id
  for update;

  if v_establishment_id is null then
    raise exception 'Order not found or outside establishment'
      using errcode = '42501';
  end if;

  v_role := private.gestify_order_role_for_scope(v_establishment_id);

  if v_role <> 'admin' then
    raise exception 'Only admin can reopen'
      using errcode = '42501';
  end if;

  if v_from_status <> 'cancelado'::public.order_status then
    raise exception 'Only canceled orders can be reopened'
      using errcode = '42501';
  end if;

  update public.orders
  set
    status = v_to_status,
    reopened_at = now(),
    reopened_by = v_uid,
    updated_at = now()
  where id = p_order_id
    and establishment_id = v_establishment_id;

  insert into public.order_status_events (
    order_id,
    establishment_id,
    from_status,
    to_status,
    action,
    note,
    created_by,
    visible_to_client
  ) values (
    p_order_id,
    v_establishment_id,
    v_from_status,
    v_to_status,
    'reopen',
    v_note,
    v_uid,
    true
  );
end;
$$;

revoke all on function private.accept_order_impl(uuid)
  from public, anon, authenticated;
revoke all on function public.accept_order(uuid)
  from public, anon, authenticated;
revoke all on function public.advance_order_status(
  uuid,
  public.order_status,
  text
) from public, anon, authenticated;
revoke all on function public.cancel_order(uuid, text)
  from public, anon, authenticated;
revoke all on function public.reopen_order(uuid, text)
  from public, anon, authenticated;

grant execute on function private.accept_order_impl(uuid)
  to service_role;
grant execute on function public.accept_order(uuid)
  to authenticated, service_role;
grant execute on function public.advance_order_status(
  uuid,
  public.order_status,
  text
) to authenticated, service_role;
grant execute on function public.cancel_order(uuid, text)
  to authenticated, service_role;
grant execute on function public.reopen_order(uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Database guards and a single canonical initial timeline trigger
-- ---------------------------------------------------------------------------

create or replace function public.gestify_require_order_status_flow()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  -- All approved lifecycle RPCs and legacy operational RPCs are SECURITY
  -- DEFINER functions owned by postgres. Direct authenticated table updates
  -- therefore fail closed, while trusted RPCs and service maintenance pass.
  if new.status is distinct from old.status
    and current_user not in ('postgres', 'supabase_admin', 'service_role')
  then
    raise exception 'Status de pedido deve ser alterado pela RPC oficial'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.gestify_require_order_event_flow()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Timeline de pedido deve ser registrada pela RPC oficial'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.gestify_validate_order_metadata_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  v_role := private.gestify_order_role_for_scope(old.establishment_id);

  if new.canceled_by is distinct from old.canceled_by
    or new.canceled_at is distinct from old.canceled_at
    or new.cancel_reason is distinct from old.cancel_reason
  then
    if coalesce(v_role, '') not in ('admin', 'operacao')
      or new.status <> 'cancelado'::public.order_status
      or new.canceled_by is distinct from v_uid
      or new.canceled_at is null
      or nullif(btrim(coalesce(new.cancel_reason, '')), '') is null
    then
      raise exception 'Metadados de cancelamento inválidos'
        using errcode = '42501';
    end if;
  end if;

  if new.reopened_by is distinct from old.reopened_by
    or new.reopened_at is distinct from old.reopened_at
  then
    if v_role <> 'admin'
      or new.status <> 'aceitou_pedido'::public.order_status
      or new.reopened_by is distinct from v_uid
      or new.reopened_at is null
    then
      raise exception 'Metadados de reabertura inválidos'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.on_order_created_add_status_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  insert into public.order_status_events (
    order_id,
    establishment_id,
    from_status,
    to_status,
    action,
    message,
    client_label,
    note,
    visible_to_client,
    created_by
  ) values (
    new.id,
    new.establishment_id,
    null,
    new.status,
    'create',
    'Pedido criado.',
    'Pedido criado',
    null,
    true,
    new.created_by
  );

  return new;
end;
$$;

revoke all on function public.gestify_require_order_status_flow()
  from public, anon, authenticated;
revoke all on function public.gestify_require_order_event_flow()
  from public, anon, authenticated;
revoke all on function public.gestify_validate_order_metadata_update()
  from public, anon, authenticated;
revoke all on function public.on_order_created_add_status_event()
  from public, anon, authenticated;

drop trigger if exists gestify_require_order_status_flow on public.orders;
create trigger gestify_require_order_status_flow
  before update of status on public.orders
  for each row
  execute function public.gestify_require_order_status_flow();

drop trigger if exists gestify_validate_order_metadata_update on public.orders;
create trigger gestify_validate_order_metadata_update
  before update of canceled_by, canceled_at, cancel_reason, reopened_by, reopened_at
  on public.orders
  for each row
  execute function public.gestify_validate_order_metadata_update();

drop trigger if exists gestify_require_order_event_flow
  on public.order_status_events;
create trigger gestify_require_order_event_flow
  before insert on public.order_status_events
  for each row
  execute function public.gestify_require_order_event_flow();

-- Historical schema layers created duplicate initial events and duplicated
-- status events already written by lifecycle RPCs. Keep one initial trigger;
-- every status RPC writes its own explicit event.
drop trigger if exists trg_orders_insert_event on public.orders;
drop trigger if exists trg_orders_status_change_event on public.orders;
drop trigger if exists trg_order_created_event on public.orders;
create trigger trg_order_created_event
  after insert on public.orders
  for each row
  execute function public.on_order_created_add_status_event();

-- ---------------------------------------------------------------------------
-- Canonical RLS policies
-- ---------------------------------------------------------------------------

alter table public.orders enable row level security;
alter table public.order_status_events enable row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
  loop
    execute format('drop policy if exists %I on public.orders', v_policy.policyname);
  end loop;

  for v_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'order_status_events'
  loop
    execute format(
      'drop policy if exists %I on public.order_status_events',
      v_policy.policyname
    );
  end loop;
end $$;

create policy orders_select_canonical
  on public.orders
  for select
  to authenticated
  using (
    private.gestify_order_can_read(
      establishment_id,
      created_by,
      customer_user_id
    )
  );

-- Temporary bridge for the existing server actions after the cancellation and
-- reopen RPC already committed their metadata. Identity and lifecycle status
-- columns are not directly updatable by authenticated users.
create policy orders_update_metadata_canonical
  on public.orders
  for update
  to authenticated
  using (
    private.gestify_order_can_update_metadata(establishment_id)
  )
  with check (
    private.gestify_order_can_update_metadata(establishment_id)
  );

create policy order_status_events_select_canonical
  on public.order_status_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders order_row
      where order_row.id = order_status_events.order_id
        and order_row.establishment_id = coalesce(
          order_status_events.establishment_id,
          order_row.establishment_id
        )
        and private.gestify_order_can_read_event(
          order_row.establishment_id,
          order_row.created_by,
          order_row.customer_user_id,
          order_status_events.visible_to_client
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Least-privilege Data API grants
-- ---------------------------------------------------------------------------

revoke all privileges on table public.orders from anon, public;
revoke all privileges on table public.order_status_events from anon, public;
revoke all privileges on table public.orders from authenticated;
revoke all privileges on table public.order_status_events from authenticated;

grant select on table public.orders to authenticated;
grant select on table public.order_status_events to authenticated;

grant update (
  canceled_by,
  canceled_at,
  cancel_reason,
  reopened_by,
  reopened_at
) on public.orders to authenticated;

grant all privileges on table public.orders to service_role;
grant all privileges on table public.order_status_events to service_role;

-- ---------------------------------------------------------------------------
-- Service-role-only audit contract
-- ---------------------------------------------------------------------------

create or replace function public.gestify_order_rls_audit()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with policy_rows as (
    select
      policy.schemaname,
      policy.tablename,
      policy.policyname,
      policy.permissive,
      policy.roles,
      policy.cmd,
      policy.qual,
      policy.with_check
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename in ('orders', 'order_status_events')
  ),
  function_rows as (
    select
      namespace.nspname as schema,
      procedure.proname as function_name,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) as args,
      procedure.prosecdef as security_definer,
      pg_catalog.pg_get_functiondef(procedure.oid) as definition,
      coalesce(
        array_agg(
          distinct case
            when privilege.grantee = 0 then 'PUBLIC'
            else role.rolname
          end
          order by case
            when privilege.grantee = 0 then 'PUBLIC'
            else role.rolname
          end
        ) filter (
          where privilege.privilege_type = 'EXECUTE'
        ),
        array[]::text[]
      ) as executable_by
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    left join lateral pg_catalog.aclexplode(
      coalesce(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) privilege on true
    left join pg_catalog.pg_roles role
      on role.oid = privilege.grantee
    where namespace.nspname in ('public', 'private')
      and procedure.proname in (
        'accept_order',
        'accept_order_impl',
        'advance_order_status',
        'cancel_order',
        'reopen_order',
        'gestify_order_role_for_scope',
        'gestify_order_can_read',
        'gestify_order_can_read_event',
        'gestify_order_can_update_metadata',
        'gestify_ensure_stock_balance_for_product',
        'claim_app_jobs'
      )
    group by
      namespace.nspname,
      procedure.proname,
      procedure.oid,
      procedure.prosecdef
  ),
  trigger_rows as (
    select
      relation.relname as table_name,
      trigger.tgname as trigger_name,
      pg_catalog.pg_get_triggerdef(trigger.oid, true) as definition
    from pg_catalog.pg_trigger trigger
    join pg_catalog.pg_class relation
      on relation.oid = trigger.tgrelid
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where trigger.tgisinternal = false
      and namespace.nspname = 'public'
      and relation.relname in ('orders', 'order_status_events')
  ),
  table_privilege_rows as (
    select
      privilege.table_name,
      privilege.grantee,
      privilege.privilege_type
    from information_schema.table_privileges privilege
    where privilege.table_schema = 'public'
      and privilege.table_name in ('orders', 'order_status_events')
      and privilege.grantee in ('anon', 'PUBLIC', 'authenticated', 'service_role')
  ),
  column_privilege_rows as (
    select
      privilege.table_name,
      privilege.column_name,
      privilege.grantee,
      privilege.privilege_type
    from information_schema.column_privileges privilege
    where privilege.table_schema = 'public'
      and privilege.table_name in ('orders', 'order_status_events')
      and privilege.grantee in ('anon', 'PUBLIC', 'authenticated', 'service_role')
  )
  select jsonb_build_object(
    'version', 'gestify-order-rls-v2',
    'policies', coalesce(
      (
        select jsonb_agg(
          to_jsonb(policy_rows)
          order by tablename, cmd, policyname
        )
        from policy_rows
      ),
      '[]'::jsonb
    ),
    'functions', coalesce(
      (
        select jsonb_agg(
          to_jsonb(function_rows)
          order by schema, function_name, args
        )
        from function_rows
      ),
      '[]'::jsonb
    ),
    'triggers', coalesce(
      (
        select jsonb_agg(
          to_jsonb(trigger_rows)
          order by table_name, trigger_name
        )
        from trigger_rows
      ),
      '[]'::jsonb
    ),
    'tablePrivileges', coalesce(
      (
        select jsonb_agg(
          to_jsonb(table_privilege_rows)
          order by table_name, grantee, privilege_type
        )
        from table_privilege_rows
      ),
      '[]'::jsonb
    ),
    'columnPrivileges', coalesce(
      (
        select jsonb_agg(
          to_jsonb(column_privilege_rows)
          order by table_name, column_name, grantee, privilege_type
        )
        from column_privilege_rows
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.gestify_order_rls_audit()
  from public, anon, authenticated;
grant execute on function public.gestify_order_rls_audit()
  to service_role;

comment on function public.gestify_order_rls_audit() is
  'Service-role-only audit of canonical order RLS, lifecycle RPCs, triggers and grants.';

notify pgrst, 'reload schema';

commit;
