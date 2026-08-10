\set ON_ERROR_STOP on

set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Test-only assertions. These functions are SECURITY INVOKER so RLS and grants
-- are evaluated as the authenticated role that calls them.
-- ---------------------------------------------------------------------------

create or replace function private.test_assert(
  p_condition boolean,
  p_message text
)
returns void
language plpgsql
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ORDER_RLS_DRILL_FAILED: %', p_message;
  end if;
end;
$$;

create or replace function private.test_direct_status_denied(p_order_id uuid)
returns boolean
language plpgsql
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  update public.orders
  set status = 'em_preparo'::public.order_status
  where id = p_order_id;
  return false;
exception
  when insufficient_privilege then return true;
  when others then
    if sqlstate = '42501' then return true; end if;
    raise;
end;
$$;

create or replace function private.test_direct_event_insert_denied(p_order_id uuid)
returns boolean
language plpgsql
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  insert into public.order_status_events (
    order_id,
    from_status,
    to_status,
    action,
    created_by
  ) values (
    p_order_id,
    null,
    'pedido_criado'::public.order_status,
    'forged',
    (select auth.uid())
  );
  return false;
exception
  when insufficient_privilege then return true;
  when others then
    if sqlstate = '42501' then return true; end if;
    raise;
end;
$$;

create or replace function private.test_direct_order_insert_denied(
  p_establishment_id uuid,
  p_customer_user_id uuid
)
returns boolean
language plpgsql
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  insert into public.orders (
    id,
    customer_user_id,
    order_number,
    status,
    created_by,
    establishment_id
  ) values (
    gen_random_uuid(),
    p_customer_user_id,
    999999,
    'pedido_criado'::public.order_status,
    (select auth.uid()),
    p_establishment_id
  );
  return false;
exception
  when insufficient_privilege then return true;
  when others then
    if sqlstate = '42501' then return true; end if;
    raise;
end;
$$;

create or replace function private.test_direct_order_delete_denied(p_order_id uuid)
returns boolean
language plpgsql
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  delete from public.orders where id = p_order_id;
  return false;
exception
  when insufficient_privilege then return true;
  when others then
    if sqlstate = '42501' then return true; end if;
    raise;
end;
$$;

create or replace function private.test_invalid_cancel_metadata_denied(p_order_id uuid)
returns boolean
language plpgsql
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
begin
  update public.orders
  set
    canceled_by = (select auth.uid()),
    canceled_at = now(),
    cancel_reason = 'forged cancellation metadata'
  where id = p_order_id;
  return false;
exception
  when insufficient_privilege then return true;
  when others then
    if sqlstate = '42501' then return true; end if;
    raise;
end;
$$;

create or replace function private.test_metadata_update_blocked(p_order_id uuid)
returns boolean
language plpgsql
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
declare
  v_rows integer;
begin
  update public.orders
  set
    canceled_by = (select auth.uid()),
    canceled_at = now(),
    cancel_reason = 'cross tenant or client write'
  where id = p_order_id;
  get diagnostics v_rows = row_count;
  return v_rows = 0;
exception
  when insufficient_privilege then return true;
  when others then
    if sqlstate = '42501' then return true; end if;
    raise;
end;
$$;

create or replace function private.test_advance_denied(
  p_order_id uuid,
  p_to_status public.order_status
)
returns boolean
language plpgsql
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
begin
  perform public.advance_order_status(
    p_order_id,
    p_to_status,
    'tentativa bloqueada pelo drill'
  );
  return false;
exception
  when insufficient_privilege then return true;
  when others then
    if sqlstate = '42501' then return true; end if;
    raise;
end;
$$;

grant execute on function private.test_assert(boolean, text) to authenticated;
grant execute on function private.test_direct_status_denied(uuid) to authenticated;
grant execute on function private.test_direct_event_insert_denied(uuid) to authenticated;
grant execute on function private.test_direct_order_insert_denied(uuid, uuid) to authenticated;
grant execute on function private.test_direct_order_delete_denied(uuid) to authenticated;
grant execute on function private.test_invalid_cancel_metadata_denied(uuid) to authenticated;
grant execute on function private.test_metadata_update_blocked(uuid) to authenticated;
grant execute on function private.test_advance_denied(uuid, public.order_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Structural assertions after the cutover migration
-- ---------------------------------------------------------------------------

select private.test_assert(
  (select count(*) = 1 from pg_catalog.pg_policies
   where schemaname = 'public' and tablename = 'orders'),
  'orders must have exactly one SELECT policy'
);

select private.test_assert(
  (select count(*) = 1 from pg_catalog.pg_policies
   where schemaname = 'public' and tablename = 'order_status_events'),
  'order_status_events must have exactly one SELECT policy'
);

select private.test_assert(
  not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and cmd <> 'SELECT'
  ),
  'orders exposes a direct write policy'
);

select private.test_assert(
  not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'order_status_events'
      and cmd <> 'SELECT'
  ),
  'order_status_events exposes a direct write policy'
);

select private.test_assert(
  not exists (
    select 1
    from information_schema.table_privileges privilege
    where privilege.table_schema = 'public'
      and privilege.table_name in ('orders', 'order_status_events')
      and privilege.grantee in ('anon', 'PUBLIC')
  ),
  'anon/PUBLIC table privileges remain on order tables'
);

select private.test_assert(
  not exists (
    select 1
    from information_schema.table_privileges privilege
    where privilege.table_schema = 'public'
      and privilege.table_name in ('orders', 'order_status_events')
      and privilege.grantee = 'authenticated'
      and privilege.privilege_type <> 'SELECT'
  ),
  'authenticated still has table-level order write privileges'
);

select private.test_assert(
  not exists (
    select 1
    from information_schema.column_privileges privilege
    where privilege.table_schema = 'public'
      and privilege.table_name = 'orders'
      and privilege.grantee = 'authenticated'
      and privilege.privilege_type = 'UPDATE'
  ),
  'authenticated still has order UPDATE column privileges'
);

select private.test_assert(
  not exists (
    select 1
    from information_schema.column_privileges privilege
    where privilege.table_schema = 'public'
      and privilege.table_name = 'order_status_events'
      and privilege.grantee = 'authenticated'
      and privilege.privilege_type in ('INSERT', 'UPDATE')
  ),
  'authenticated has event write column privileges'
);

select private.test_assert(
  not exists (
    select 1
    from pg_catalog.pg_trigger trigger
    join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where trigger.tgisinternal = false
      and namespace.nspname = 'public'
      and relation.relname = 'orders'
      and trigger.tgname in (
        'trg_orders_insert_event',
        'trg_orders_status_change_event'
      )
  ),
  'duplicate historical order event triggers remain installed'
);

select private.test_assert(
  (select count(*) = 1
   from pg_catalog.pg_trigger trigger
   join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
   join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
   where trigger.tgisinternal = false
     and namespace.nspname = 'public'
     and relation.relname = 'orders'
     and trigger.tgname = 'trg_order_created_event'),
  'canonical initial order event trigger is missing or duplicated'
);

select private.test_assert(
  (select count(*) = 1
   from pg_catalog.pg_trigger trigger
   join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
   join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
   where trigger.tgisinternal = false
     and namespace.nspname = 'public'
     and relation.relname = 'orders'
     and trigger.tgname = 'gestify_require_order_status_flow'),
  'direct status guard is missing'
);

select private.test_assert(
  not exists (
    select 1
    from pg_catalog.pg_trigger trigger
    join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where trigger.tgisinternal = false
      and namespace.nspname = 'public'
      and relation.relname = 'orders'
      and trigger.tgname = 'gestify_validate_order_metadata_update'
  ),
  'legacy metadata update trigger remains installed'
);

select private.test_assert(
  (select count(*) = 1
   from pg_catalog.pg_trigger trigger
   join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
   join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
   where trigger.tgisinternal = false
     and namespace.nspname = 'public'
     and relation.relname = 'order_status_events'
     and trigger.tgname = 'gestify_require_order_event_flow'),
  'direct event guard is missing'
);

-- ---------------------------------------------------------------------------
-- Two-tenant fixture
-- ---------------------------------------------------------------------------

insert into public.establishments (id, name)
values
  ('11111111-1111-4111-8111-111111111111', 'Tenant A'),
  ('22222222-2222-4222-8222-222222222222', 'Tenant B');

insert into public.memberships (
  user_id,
  establishment_id,
  role,
  is_active
) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'admin', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'cliente', true),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'cliente', true),
  ('bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'admin', true);

-- This user exists only in the newer membership table. The canonical helper
-- must still recognize it as operacao in Tenant A.
insert into public.establishment_memberships (
  establishment_id,
  user_id,
  role,
  is_active
) values (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-0000-4000-8000-000000000003',
  'operacao',
  true
);

insert into public.customers (user_id, establishment_id, full_name)
values
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Cliente A'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Cliente B');

insert into public.orders (
  id,
  customer_user_id,
  order_number,
  status,
  created_by,
  establishment_id,
  notes
) values
  (
    'a1111111-1111-4111-8111-111111111111',
    'aaaaaaaa-0000-4000-8000-000000000002',
    1001,
    'pedido_criado',
    'aaaaaaaa-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'Pedido A do cliente'
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    'aaaaaaaa-0000-4000-8000-000000000002',
    1002,
    'pedido_criado',
    'aaaaaaaa-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    'Pedido A criado pela operação'
  ),
  (
    'b1111111-1111-4111-8111-111111111111',
    'bbbbbbbb-0000-4000-8000-000000000001',
    2001,
    'pedido_criado',
    'bbbbbbbb-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'Pedido B do cliente'
  );

select private.test_assert(
  (select count(*) = 3 from public.order_status_events),
  'each inserted order must create exactly one initial timeline event'
);

select private.test_assert(
  not exists (
    select order_id
    from public.order_status_events
    group by order_id
    having count(*) <> 1
  ),
  'initial timeline event count is not exactly one per order'
);

-- Internal staff-only event used to validate visible_to_client enforcement.
begin;
select set_config('app.order_status_flow', 'on', true);
insert into public.order_status_events (
  order_id,
  establishment_id,
  from_status,
  to_status,
  action,
  note,
  visible_to_client,
  created_by
) values (
  'a1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'pedido_criado',
  'pedido_criado',
  'internal_check',
  'Evento interno invisível ao cliente',
  false,
  'aaaaaaaa-0000-4000-8000-000000000001'
);
commit;

-- ---------------------------------------------------------------------------
-- Tenant A admin
-- ---------------------------------------------------------------------------

begin;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select private.test_assert(
  (select count(*) = 2 from public.orders),
  'Tenant A admin can see another tenant or cannot see its own orders'
);

select private.test_assert(
  (select count(*) = 3 from public.order_status_events),
  'Tenant A admin event visibility is incorrect before lifecycle changes'
);

select private.test_assert(
  private.test_direct_order_insert_denied(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-0000-4000-8000-000000000002'
  ),
  'authenticated direct order INSERT was not denied'
);

select private.test_assert(
  private.test_direct_order_delete_denied('a2222222-2222-4222-8222-222222222222'),
  'authenticated direct order DELETE was not denied'
);

select private.test_assert(
  private.test_direct_status_denied('a1111111-1111-4111-8111-111111111111'),
  'authenticated direct order status update was not denied'
);

select private.test_assert(
  private.test_direct_event_insert_denied('a1111111-1111-4111-8111-111111111111'),
  'authenticated direct timeline INSERT was not denied'
);

select private.test_assert(
  private.test_invalid_cancel_metadata_denied('a1111111-1111-4111-8111-111111111111'),
  'cancellation metadata was accepted before the official cancellation flow'
);

select public.cancel_order(
  'a1111111-1111-4111-8111-111111111111',
  'Cancelado no drill'
);

select private.test_assert(
  exists (
    select 1
    from public.orders
    where id = 'a1111111-1111-4111-8111-111111111111'
      and status = 'cancelado'
      and canceled_by = 'aaaaaaaa-0000-4000-8000-000000000001'
      and canceled_at is not null
      and cancel_reason = 'Cancelado no drill'
  ),
  'cancel_order did not atomically persist status and cancellation metadata'
);

select private.test_assert(
  private.test_invalid_cancel_metadata_denied('a1111111-1111-4111-8111-111111111111'),
  'direct cancellation metadata update remained available after the RPC'
);

select public.reopen_order(
  'a1111111-1111-4111-8111-111111111111',
  'Reaberto no drill'
);

select private.test_assert(
  exists (
    select 1
    from public.orders
    where id = 'a1111111-1111-4111-8111-111111111111'
      and status = 'aceitou_pedido'
      and reopened_by = 'aaaaaaaa-0000-4000-8000-000000000001'
      and reopened_at is not null
  ),
  'reopen_order did not atomically persist status and reopen metadata'
);

select private.test_assert(
  private.test_metadata_update_blocked('b1111111-1111-4111-8111-111111111111'),
  'Tenant A admin modified Tenant B metadata'
);

select private.test_assert(
  private.test_advance_denied(
    'b1111111-1111-4111-8111-111111111111',
    'aceitou_pedido'
  ),
  'Tenant A admin advanced a Tenant B order'
);

commit;

-- ---------------------------------------------------------------------------
-- Tenant A operacao present only in establishment_memberships
-- ---------------------------------------------------------------------------

begin;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select private.test_assert(
  private.gestify_order_role_for_scope(
    '11111111-1111-4111-8111-111111111111'
  ) = 'operacao',
  'role helper ignored establishment_memberships'
);

select private.test_assert(
  (select count(*) = 2 from public.orders),
  'establishment_memberships-only staff cannot read Tenant A orders'
);

select public.accept_order('a2222222-2222-4222-8222-222222222222');

select private.test_assert(
  exists (
    select 1
    from public.orders
    where id = 'a2222222-2222-4222-8222-222222222222'
      and status = 'aceitou_pedido'
      and accepted_by = 'aaaaaaaa-0000-4000-8000-000000000003'
      and accepted_at is not null
  ),
  'accept_order failed for establishment_memberships-only operacao'
);

select public.advance_order_status(
  'a2222222-2222-4222-8222-222222222222',
  'em_preparo',
  'Aceite validado e produção iniciada'
);

select private.test_assert(
  exists (
    select 1
    from public.orders
    where id = 'a2222222-2222-4222-8222-222222222222'
      and status = 'em_preparo'
  ),
  'operacao could not perform the canonical accepted-to-preparation transition'
);

select private.test_assert(
  private.test_advance_denied(
    'b1111111-1111-4111-8111-111111111111',
    'aceitou_pedido'
  ),
  'establishment_memberships-only staff advanced another tenant order'
);

commit;

-- ---------------------------------------------------------------------------
-- Tenant A client
-- ---------------------------------------------------------------------------

begin;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select private.test_assert(
  (select count(*) = 2 from public.orders),
  'Tenant A client cannot see its orders or can see another tenant'
);

select private.test_assert(
  (select count(*) = 6 from public.order_status_events),
  'client event visibility leaked the internal event or hid a public event'
);

select private.test_assert(
  private.test_metadata_update_blocked('a2222222-2222-4222-8222-222222222222'),
  'client directly changed lifecycle metadata'
);

select private.test_assert(
  private.test_advance_denied(
    'a2222222-2222-4222-8222-222222222222',
    'em_separacao'
  ),
  'client advanced an operational order status'
);

select private.test_assert(
  private.test_direct_event_insert_denied('a2222222-2222-4222-8222-222222222222'),
  'client directly forged a timeline event'
);

commit;

-- ---------------------------------------------------------------------------
-- Tenant B client
-- ---------------------------------------------------------------------------

begin;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select private.test_assert(
  (select count(*) = 1 from public.orders),
  'Tenant B client order visibility is incorrect'
);

select private.test_assert(
  (select count(*) = 1 from public.order_status_events),
  'Tenant B client timeline visibility is incorrect'
);

select private.test_assert(
  not exists (
    select 1
    from public.orders
    where establishment_id = '11111111-1111-4111-8111-111111111111'
  ),
  'Tenant B client can read Tenant A orders'
);

commit;

-- ---------------------------------------------------------------------------
-- Final consistency checks
-- ---------------------------------------------------------------------------

select private.test_assert(
  (select count(*) = 3 from public.orders),
  'order count changed unexpectedly during the drill'
);

select private.test_assert(
  (select count(*) = 8 from public.order_status_events),
  'timeline count indicates missing or duplicate lifecycle events'
);

select private.test_assert(
  not exists (
    select event.id
    from public.order_status_events event
    join public.orders order_row on order_row.id = event.order_id
    where event.establishment_id is distinct from order_row.establishment_id
  ),
  'timeline contains a tenant mismatch'
);

select private.test_assert(
  (public.gestify_order_rls_audit() ->> 'version') = 'gestify-order-rls-v3',
  'extended order RLS audit contract is not installed'
);

select jsonb_build_object(
  'format', 'gestify-order-rls-cutover-report-v1',
  'ok', true,
  'orders', (select count(*) from public.orders),
  'events', (select count(*) from public.order_status_events),
  'ordersPolicies', (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'orders'
  ),
  'eventPolicies', (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'order_status_events'
  ),
  'authenticatedOrderUpdateColumns', (
    select coalesce(
      jsonb_agg(privilege.column_name order by privilege.column_name),
      '[]'::jsonb
    )
    from information_schema.column_privileges privilege
    where privilege.table_schema = 'public'
      and privilege.table_name = 'orders'
      and privilege.grantee = 'authenticated'
      and privilege.privilege_type = 'UPDATE'
  ),
  'duplicateEventTriggers', (
    select count(*)
    from pg_catalog.pg_trigger trigger
    join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where trigger.tgisinternal = false
      and namespace.nspname = 'public'
      and relation.relname = 'orders'
      and trigger.tgname in (
        'trg_orders_insert_event',
        'trg_orders_status_change_event'
      )
  ),
  'membershipSourcesValidated', jsonb_build_array(
    'memberships',
    'establishment_memberships'
  )
) as report;
