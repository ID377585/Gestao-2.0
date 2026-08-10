-- Minimal pre-cutover schema used only by the isolated order RLS drill.
-- It reproduces the relevant historical risks: duplicate permissive policies,
-- duplicate timeline triggers and broad authenticated table privileges.

create extension if not exists pgcrypto;

-- Reproduce the database roles and auth.uid() contract used by Supabase without
-- starting the full local Supabase service stack.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin nologin superuser;
  end if;
end $$;

create schema if not exists auth;
create schema if not exists private;

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = pg_catalog, pg_temp
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (
        nullif(current_setting('request.jwt.claims', true), '')::jsonb
        ->> 'sub'
      )
    ),
    ''
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
set search_path = pg_catalog, pg_temp
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.role', true),
      (
        nullif(current_setting('request.jwt.claims', true), '')::jsonb
        ->> 'role'
      )
    ),
    ''
  )
$$;

grant usage on schema auth, public, private
  to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role()
  to anon, authenticated, service_role;

create type public.app_role as enum (
  'admin',
  'operacao',
  'producao',
  'estoque',
  'fiscal',
  'entrega',
  'cliente'
);

create type public.order_status as enum (
  'pedido_criado',
  'aceitou_pedido',
  'em_preparo',
  'em_separacao',
  'em_faturamento',
  'em_transporte',
  'entregue',
  'cancelado'
);

create table public.establishments (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  establishment_id uuid not null references public.establishments(id),
  role text not null,
  created_at timestamptz not null default now(),
  org_id uuid,
  unit_id uuid,
  is_active boolean not null default true,
  unique (user_id, establishment_id)
);

create table public.establishment_memberships (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id),
  user_id uuid not null,
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (establishment_id, user_id)
);

create table public.customers (
  user_id uuid primary key,
  establishment_id uuid not null references public.establishments(id),
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  enabled boolean not null default true,
  primary key (from_status, to_status)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null,
  order_number bigint not null,
  status public.order_status not null default 'pedido_criado',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid,
  canceled_at timestamptz,
  canceled_by uuid,
  cancel_reason text,
  reopened_at timestamptz,
  reopened_by uuid,
  carrier text,
  tracking_code text,
  shipped_at timestamptz,
  shipped_by uuid,
  delivered_at timestamptz,
  delivered_by uuid,
  created_by uuid not null,
  establishment_id uuid not null references public.establishments(id)
);

create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  client_label text,
  visible_to_client boolean not null default true,
  note text,
  action text not null default 'advance',
  establishment_id uuid
);

create index memberships_user_active_idx
  on public.memberships (user_id, is_active, created_at desc);
create index memberships_establishment_id_idx
  on public.memberships (establishment_id);
create index establishment_memberships_user_active_idx
  on public.establishment_memberships (user_id, is_active, establishment_id);
create index customers_establishment_id_idx
  on public.customers (establishment_id);
create index orders_establishment_id_idx
  on public.orders (establishment_id);
create index order_status_events_order_id_idx
  on public.order_status_events (order_id);

insert into public.order_status_transitions (from_status, to_status)
values
  ('pedido_criado', 'aceitou_pedido'),
  ('aceitou_pedido', 'em_preparo'),
  ('em_preparo', 'em_separacao'),
  ('em_separacao', 'em_faturamento'),
  ('em_faturamento', 'em_transporte'),
  ('em_transporte', 'entregue');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_order_created_by()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if new.created_by is null then
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.set_event_establishment_id()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.establishment_id is null then
    select order_row.establishment_id
      into new.establishment_id
    from public.orders order_row
    where order_row.id = new.order_id;
  end if;
  return new;
end;
$$;

create or replace function public.gestify_prevent_order_identity_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.establishment_id is distinct from old.establishment_id
    or new.created_by is distinct from old.created_by
    or new.customer_user_id is distinct from old.customer_user_id
    or new.order_number is distinct from old.order_number
  then
    raise exception 'Campos de identidade do pedido não podem ser alterados'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Two initial-event functions and one status-change function are deliberately
-- installed so the cutover must remove duplicate timeline writes.
create or replace function public.on_order_created_add_status_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  insert into public.order_status_events (
    order_id,
    from_status,
    to_status,
    message,
    created_by
  ) values (
    new.id,
    null,
    new.status,
    'Pedido criado pelo cliente.',
    new.customer_user_id
  );
  return new;
end;
$$;

create or replace function public.on_order_insert_create_event()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  insert into public.order_status_events (
    order_id,
    from_status,
    to_status,
    client_label,
    visible_to_client,
    created_by
  ) values (
    new.id,
    null,
    new.status,
    'Pedido criado',
    true,
    new.created_by
  );
  return new;
end;
$$;

create or replace function public.on_order_status_change_create_event()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_events (
      order_id,
      from_status,
      to_status,
      client_label,
      visible_to_client,
      created_by
    ) values (
      new.id,
      old.status,
      new.status,
      new.status::text,
      true,
      (select auth.uid())
    );
  end if;
  return new;
end;
$$;

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger trg_set_order_created_by
  before insert on public.orders
  for each row execute function public.set_order_created_by();

create trigger gestify_prevent_order_identity_change
  before update on public.orders
  for each row execute function public.gestify_prevent_order_identity_change();

create trigger trg_set_event_establishment_id
  before insert on public.order_status_events
  for each row execute function public.set_event_establishment_id();

create trigger trg_order_created_event
  after insert on public.orders
  for each row execute function public.on_order_created_add_status_event();

create trigger trg_orders_insert_event
  after insert on public.orders
  for each row execute function public.on_order_insert_create_event();

create trigger trg_orders_status_change_event
  after update of status on public.orders
  for each row execute function public.on_order_status_change_create_event();

alter table public.orders enable row level security;
alter table public.order_status_events enable row level security;

-- Deliberately duplicated permissive policies matching the historical risk.
create policy orders_select_by_membership
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships membership
      where membership.user_id = (select auth.uid())
        and membership.establishment_id = orders.establishment_id
        and membership.is_active = true
    )
  );

create policy orders_select_scoped
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.establishment_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.establishment_id = orders.establishment_id
        and membership.is_active = true
    )
  );

create policy orders_insert_own
  on public.orders
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy orders_update_by_membership
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.memberships membership
      where membership.user_id = (select auth.uid())
        and membership.establishment_id = orders.establishment_id
        and membership.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.memberships membership
      where membership.user_id = (select auth.uid())
        and membership.establishment_id = orders.establishment_id
        and membership.is_active = true
    )
  );

create policy orders_update_scoped
  on public.orders
  for update
  to authenticated
  using (true)
  with check (true);

create policy order_events_select_by_membership
  on public.order_status_events
  for select
  to authenticated
  using (true);

create policy order_events_select_timeline
  on public.order_status_events
  for select
  to authenticated
  using (true);

create policy order_events_insert_authenticated
  on public.order_status_events
  for insert
  to authenticated
  with check (true);

grant all privileges on table public.orders to authenticated, service_role;
grant all privileges on table public.order_status_events to authenticated, service_role;
grant select on table
  public.establishments,
  public.memberships,
  public.establishment_memberships,
  public.customers,
  public.order_status_transitions
  to authenticated, service_role;

revoke all privileges on table public.orders from anon, public;
revoke all privileges on table public.order_status_events from anon, public;
