-- P0: consolidate order RLS and force status/timeline writes through RPC flows.
-- This migration does not update or delete tenant data.

create schema if not exists private;

grant usage on schema private to authenticated, service_role;

create or replace function private.gestify_order_role_for_scope(
  p_establishment_id uuid
)
returns text
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
  select m.role::text
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.is_active = true
    and coalesce(m.unit_id, m.establishment_id) = p_establishment_id
  order by
    case m.role::text
      when 'admin' then 1
      when 'operacao' then 2
      when 'producao' then 3
      when 'estoque' then 4
      when 'fiscal' then 5
      when 'entrega' then 6
      when 'cliente' then 7
      else 99
    end
  limit 1
$$;

create or replace function private.gestify_order_is_staff(
  p_establishment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
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
set search_path to 'public', 'auth', 'pg_temp'
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

create or replace function private.gestify_order_can_insert(
  p_establishment_id uuid,
  p_created_by uuid,
  p_customer_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
  select coalesce(
    p_created_by = (select auth.uid())
    and (
      private.gestify_order_is_staff(p_establishment_id)
      or (
        private.gestify_order_role_for_scope(p_establishment_id) = 'cliente'
        and p_customer_user_id = (select auth.uid())
      )
    ),
    false
  )
$$;

create or replace function private.gestify_order_can_update(
  p_establishment_id uuid,
  p_created_by uuid,
  p_customer_user_id uuid,
  p_status public.order_status
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
  select coalesce(
    private.gestify_order_is_staff(p_establishment_id)
    or (
      private.gestify_order_role_for_scope(p_establishment_id) = 'cliente'
      and p_status = 'pedido_criado'::public.order_status
      and (
        p_created_by = (select auth.uid())
        or p_customer_user_id = (select auth.uid())
      )
    ),
    false
  )
$$;

create or replace function private.gestify_order_can_delete(
  p_establishment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
  select coalesce(
    private.gestify_order_role_for_scope(p_establishment_id) = 'admin',
    false
  )
$$;

create or replace function private.gestify_order_can_insert_event(
  p_order_id uuid,
  p_establishment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
  select coalesce(current_setting('app.order_status_flow', true), '') = 'on'
    and exists (
      select 1
      from public.orders o
      where o.id = p_order_id
        and o.establishment_id = coalesce(p_establishment_id, o.establishment_id)
        and private.gestify_order_can_read(
          o.establishment_id,
          o.created_by,
          o.customer_user_id
        )
    )
$$;

revoke all on function private.gestify_order_role_for_scope(uuid)
  from public, anon, authenticated;
revoke all on function private.gestify_order_is_staff(uuid)
  from public, anon, authenticated;
revoke all on function private.gestify_order_can_read(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.gestify_order_can_insert(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.gestify_order_can_update(uuid, uuid, uuid, public.order_status)
  from public, anon, authenticated;
revoke all on function private.gestify_order_can_delete(uuid)
  from public, anon, authenticated;
revoke all on function private.gestify_order_can_insert_event(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.gestify_order_role_for_scope(uuid)
  to authenticated, service_role;
grant execute on function private.gestify_order_is_staff(uuid)
  to authenticated, service_role;
grant execute on function private.gestify_order_can_read(uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function private.gestify_order_can_insert(uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function private.gestify_order_can_update(uuid, uuid, uuid, public.order_status)
  to authenticated, service_role;
grant execute on function private.gestify_order_can_delete(uuid)
  to authenticated, service_role;
grant execute on function private.gestify_order_can_insert_event(uuid, uuid)
  to authenticated, service_role;

create or replace function public.gestify_require_order_status_flow()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status is distinct from old.status
    and coalesce(current_setting('app.order_status_flow', true), '') <> 'on'
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
set search_path to 'public', 'pg_temp'
as $$
begin
  if coalesce(current_setting('app.order_status_flow', true), '') <> 'on' then
    raise exception 'Timeline de pedido deve ser registrada pela RPC oficial'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.gestify_require_order_status_flow()
  from public, anon, authenticated;
revoke all on function public.gestify_require_order_event_flow()
  from public, anon, authenticated;

drop trigger if exists gestify_require_order_status_flow on public.orders;
create trigger gestify_require_order_status_flow
  before update of status on public.orders
  for each row
  execute function public.gestify_require_order_status_flow();

drop trigger if exists gestify_require_order_event_flow
  on public.order_status_events;
create trigger gestify_require_order_event_flow
  before insert on public.order_status_events
  for each row
  execute function public.gestify_require_order_event_flow();

-- Existing RPC and trigger flows that legitimately move orders/timeline.
alter function public.advance_order_status(uuid, public.order_status, text)
  set app.order_status_flow to 'on';
alter function public.cancel_order(uuid, text)
  set app.order_status_flow to 'on';
alter function public.reopen_order(uuid, text)
  set app.order_status_flow to 'on';
alter function private.accept_order_impl(uuid)
  set app.order_status_flow to 'on';

do $$
declare
  v_signature text;
begin
  for v_signature in
    select signature
    from (
      values
        ('public.advance_order(uuid)'),
        ('public.create_invoice_from_separation(uuid)'),
        ('public.create_pre_invoice_from_separation(uuid, uuid, text)'),
        ('public.finalize_faturamento(uuid, text, text)'),
        ('public.finish_order_separation(uuid, text)'),
        ('public.mark_as_delivered(uuid)'),
        ('public.mark_order_delivered(uuid)'),
        ('public.reject_order(uuid, text)'),
        ('public.send_order_to_transport(uuid, text, text)'),
        ('public.send_to_transport(uuid)'),
        ('public.set_order_status(uuid, public.order_status, text, boolean)'),
        ('public.start_faturamento(uuid)'),
        ('public.start_preparo(uuid)'),
        ('public.start_separacao(uuid)')
    ) as known_flows(signature)
  loop
    if to_regprocedure(v_signature) is not null then
      execute format('alter function %s set app.order_status_flow to %L', v_signature, 'on');
    end if;
  end loop;
end $$;

alter function public.on_order_created_add_status_event()
  set app.order_status_flow to 'on';
alter function public.on_order_insert_create_event()
  set app.order_status_flow to 'on';
alter function public.on_order_status_change_create_event()
  set app.order_status_flow to 'on';

alter table public.orders enable row level security;
alter table public.order_status_events enable row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
  loop
    execute format('drop policy if exists %I on public.orders', v_policy.policyname);
  end loop;

  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'order_status_events'
  loop
    execute format(
      'drop policy if exists %I on public.order_status_events',
      v_policy.policyname
    );
  end loop;
end $$;

create policy "orders_select_canonical"
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

create policy "orders_insert_canonical"
  on public.orders
  for insert
  to authenticated
  with check (
    private.gestify_order_can_insert(
      establishment_id,
      created_by,
      customer_user_id
    )
  );

create policy "orders_update_canonical"
  on public.orders
  for update
  to authenticated
  using (
    private.gestify_order_can_update(
      establishment_id,
      created_by,
      customer_user_id,
      status
    )
  )
  with check (
    private.gestify_order_can_update(
      establishment_id,
      created_by,
      customer_user_id,
      status
    )
  );

create policy "orders_delete_admin_canonical"
  on public.orders
  for delete
  to authenticated
  using (private.gestify_order_can_delete(establishment_id));

create policy "order_status_events_select_canonical"
  on public.order_status_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_status_events.order_id
        and o.establishment_id = coalesce(
          order_status_events.establishment_id,
          o.establishment_id
        )
        and private.gestify_order_can_read(
          o.establishment_id,
          o.created_by,
          o.customer_user_id
        )
    )
  );

create policy "order_status_events_insert_flow_canonical"
  on public.order_status_events
  for insert
  to authenticated
  with check (
    private.gestify_order_can_insert_event(
      order_id,
      establishment_id
    )
  );
