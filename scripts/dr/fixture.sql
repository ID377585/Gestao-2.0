create schema if not exists private;

create type public.gestify_dr_order_status as enum (
  'created',
  'approved',
  'completed',
  'cancelled'
);

create table public.establishments (
  id uuid primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key,
  full_name text not null,
  role text not null default 'user',
  avatar_path text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (establishment_id, user_id)
);

create table public.products (
  id uuid primary key,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text not null,
  sku text not null,
  created_at timestamptz not null default now(),
  unique (establishment_id, sku)
);

create table public.orders (
  id uuid primary key,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  created_by uuid not null,
  status public.gestify_dr_order_status not null default 'created',
  total_amount numeric(14, 2) not null check (total_amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index memberships_user_establishment_idx
  on public.memberships (user_id, establishment_id)
  where is_active = true;

create index products_establishment_idx
  on public.products (establishment_id);

create index orders_establishment_created_idx
  on public.orders (establishment_id, created_at desc);

create index audit_logs_establishment_created_idx
  on public.audit_logs (establishment_id, created_at desc);

alter table public.establishments enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.audit_logs enable row level security;

create policy establishments_member_select
  on public.establishments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships membership
      where membership.establishment_id = establishments.id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy profiles_self_select
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy memberships_self_select
  on public.memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and is_active = true
  );

create policy products_tenant_select
  on public.products
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships membership
      where membership.establishment_id = products.establishment_id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy orders_tenant_select
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships membership
      where membership.establishment_id = orders.establishment_id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy orders_tenant_update
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.memberships membership
      where membership.establishment_id = orders.establishment_id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'admin', 'operacao')
    )
  )
  with check (
    exists (
      select 1
      from public.memberships membership
      where membership.establishment_id = orders.establishment_id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'admin', 'operacao')
    )
  );

create policy audit_logs_tenant_select
  on public.audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships membership
      where membership.establishment_id = audit_logs.establishment_id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'admin')
    )
  );

grant usage on schema public to authenticated;
grant select on public.establishments, public.profiles, public.memberships, public.products,
  public.orders, public.audit_logs to authenticated;
grant update (status, note) on public.orders to authenticated;

-- Supabase local grants broad table privileges to anon through default
-- privileges. The production Gestify explicitly removes that surface, so the
-- fixture must reproduce the same fail-closed posture before it is backed up.
revoke all privileges on table
  public.establishments,
  public.profiles,
  public.memberships,
  public.products,
  public.orders,
  public.audit_logs
from anon;

revoke all privileges on table
  public.establishments,
  public.profiles,
  public.memberships,
  public.products,
  public.orders,
  public.audit_logs
from PUBLIC;

alter default privileges in schema public
  revoke all privileges on tables from anon;

alter default privileges in schema public
  revoke all privileges on tables from PUBLIC;

create or replace function private.gestify_dr_reject_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Gestify audit log is append-only'
    using errcode = '55000';
end;
$$;

create trigger gestify_dr_audit_logs_append_only
before update or delete or truncate on public.audit_logs
for each statement execute function private.gestify_dr_reject_audit_mutation();

create or replace function public.gestify_core_security_audit()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'ok',
    not exists (
      select 1
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relkind = 'r'
        and relation.relrowsecurity = false
    ),
    'version', 'gestify-dr-fixture-v1'
  );
$$;

revoke all on function public.gestify_core_security_audit() from public, anon, authenticated;
grant execute on function public.gestify_core_security_audit() to service_role;

insert into public.establishments (id, name)
values
  ('11111111-1111-4111-8111-111111111111', 'Tenant A'),
  ('22222222-2222-4222-8222-222222222222', 'Tenant B');

insert into public.profiles (id, full_name, role)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Usuário Tenant A', 'admin'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Usuário Tenant B', 'admin');

insert into public.memberships (id, establishment_id, user_id, role)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'admin'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-0000-4000-8000-000000000002',
    'admin'
  );

insert into public.products (id, establishment_id, name, sku)
values
  (
    'aaaaaaaa-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'Produto A',
    'A-001'
  ),
  (
    'bbbbbbbb-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    'Produto B',
    'B-001'
  );

insert into public.orders (
  id,
  establishment_id,
  created_by,
  status,
  total_amount,
  note
)
values
  (
    'aaaaaaaa-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'approved',
    125.50,
    'Pedido do tenant A'
  ),
  (
    'bbbbbbbb-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-0000-4000-8000-000000000002',
    'created',
    89.90,
    'Pedido do tenant B'
  );

insert into public.audit_logs (
  id,
  establishment_id,
  actor_user_id,
  event_type,
  payload
)
values (
  'aaaaaaaa-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'fixture.created',
  '{"source":"drill"}'::jsonb
);
