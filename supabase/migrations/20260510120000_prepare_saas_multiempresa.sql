-- Preparacao SaaS Multiempresa
-- Base inicial para planos, assinaturas e auditoria global por empresa.

create table if not exists public.establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Empresa',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.establishments
  add column if not exists name text default 'Empresa',
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'cliente',
  sector text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text default '',
  add column if not exists role text default 'cliente',
  add column if not exists sector text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role'
      and n.nspname = 'public'
  ) then
    create type public.app_role as enum (
      'admin',
      'operacao',
      'estoque',
      'engenharia',
      'compras',
      'fiscal',
      'financeiro',
      'producao',
      'entrega',
      'cliente'
    );
  end if;
end $$;

create table if not exists public.establishment_memberships (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid not null,
  role public.app_role not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.establishment_memberships
  add column if not exists establishment_id uuid,
  add column if not exists user_id uuid,
  add column if not exists role public.app_role default 'admin',
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now();

create unique index if not exists establishment_memberships_establishment_user_unique
  on public.establishment_memberships(establishment_id, user_id);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  establishment_id uuid not null,
  role text not null default 'admin',
  is_active boolean not null default true,
  org_id uuid,
  unit_id uuid,
  created_at timestamptz not null default now()
);

alter table public.memberships
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists establishment_id uuid,
  add column if not exists role text default 'admin',
  add column if not exists is_active boolean default true,
  add column if not exists org_id uuid,
  add column if not exists unit_id uuid,
  add column if not exists created_at timestamptz default now();

alter table public.memberships
  alter column role set default 'admin',
  alter column is_active set default true,
  alter column created_at set default now();

create unique index if not exists memberships_establishment_user_unique
  on public.memberships(establishment_id, user_id);

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'order_status'
      and n.nspname = 'public'
  ) then
    create type public.order_status as enum (
      'pedido_criado',
      'aceitou_pedido',
      'em_preparo',
      'em_separacao',
      'em_faturamento',
      'em_transporte',
      'entregue',
      'cancelado',
      'reaberto',
      'faturamento'
    );
  end if;
end $$;

alter type public.order_status add value if not exists 'pedido_criado';
alter type public.order_status add value if not exists 'aceitou_pedido';
alter type public.order_status add value if not exists 'em_preparo';
alter type public.order_status add value if not exists 'em_separacao';
alter type public.order_status add value if not exists 'em_faturamento';
alter type public.order_status add value if not exists 'em_transporte';
alter type public.order_status add value if not exists 'entregue';
alter type public.order_status add value if not exists 'cancelado';
alter type public.order_status add value if not exists 'reaberto';
alter type public.order_status add value if not exists 'faturamento';

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  created_by uuid not null,
  customer_user_id uuid not null,
  status public.order_status not null default 'pedido_criado',
  notes text,
  order_number bigint generated by default as identity,
  accepted_at timestamptz,
  accepted_by uuid,
  cancel_reason text,
  canceled_at timestamptz,
  canceled_by uuid,
  carrier text,
  delivered_at timestamptz,
  delivered_by uuid,
  reopened_at timestamptz,
  reopened_by uuid,
  shipped_at timestamptz,
  shipped_by uuid,
  tracking_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists establishment_id uuid,
  add column if not exists created_by uuid,
  add column if not exists customer_user_id uuid,
  add column if not exists status public.order_status default 'pedido_criado',
  add column if not exists notes text,
  add column if not exists order_number bigint,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid,
  add column if not exists cancel_reason text,
  add column if not exists canceled_at timestamptz,
  add column if not exists canceled_by uuid,
  add column if not exists carrier text,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivered_by uuid,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid,
  add column if not exists shipped_at timestamptz,
  add column if not exists shipped_by uuid,
  add column if not exists tracking_code text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists orders_order_number_unique
  on public.orders(order_number);

create index if not exists orders_establishment_status_idx
  on public.orders(establishment_id, status);

create table if not exists public.order_line_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  establishment_id uuid not null,
  product_id uuid,
  product_name text not null,
  quantity numeric not null default 1,
  unit_label text not null default 'UN',
  production_assigned_to uuid,
  production_start_at timestamptz,
  production_end_at timestamptz,
  production_missing_qty numeric,
  production_status text,
  created_at timestamptz not null default now()
);

alter table public.order_line_items
  add column if not exists order_id uuid,
  add column if not exists establishment_id uuid,
  add column if not exists product_id uuid,
  add column if not exists product_name text,
  add column if not exists quantity numeric default 1,
  add column if not exists unit_label text default 'UN',
  add column if not exists production_assigned_to uuid,
  add column if not exists production_start_at timestamptz,
  add column if not exists production_end_at timestamptz,
  add column if not exists production_missing_qty numeric,
  add column if not exists production_status text,
  add column if not exists created_at timestamptz default now();

create index if not exists order_line_items_order_id_idx
  on public.order_line_items(order_id);

create index if not exists order_line_items_establishment_idx
  on public.order_line_items(establishment_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  product_name text not null,
  qty numeric not null default 1,
  unit text not null default 'UN',
  production_assigned_to uuid,
  production_missing_qty numeric,
  production_status text,
  created_at timestamptz not null default now()
);

alter table public.order_items
  add column if not exists order_id uuid,
  add column if not exists product_name text,
  add column if not exists qty numeric default 1,
  add column if not exists unit text default 'UN',
  add column if not exists production_assigned_to uuid,
  add column if not exists production_missing_qty numeric,
  add column if not exists production_status text,
  add column if not exists created_at timestamptz default now();

create index if not exists order_items_order_id_idx
  on public.order_items(order_id);

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  establishment_id uuid,
  from_status public.order_status,
  to_status public.order_status not null,
  action text not null default 'status_changed',
  note text,
  message text,
  client_label text,
  visible_to_client boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.order_status_events
  add column if not exists order_id uuid,
  add column if not exists establishment_id uuid,
  add column if not exists from_status public.order_status,
  add column if not exists to_status public.order_status,
  add column if not exists action text default 'status_changed',
  add column if not exists note text,
  add column if not exists message text,
  add column if not exists client_label text,
  add column if not exists visible_to_client boolean default true,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now();

create index if not exists order_status_events_order_id_idx
  on public.order_status_events(order_id);

create table if not exists public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  product_id uuid not null,
  quantity numeric not null default 0,
  unit_label text not null default 'UN',
  location text,
  min_qty numeric,
  med_qty numeric,
  max_qty numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stock_balances
  add column if not exists establishment_id uuid,
  add column if not exists product_id uuid,
  add column if not exists quantity numeric default 0,
  add column if not exists unit_label text default 'UN',
  add column if not exists location text,
  add column if not exists min_qty numeric,
  add column if not exists med_qty numeric,
  add column if not exists max_qty numeric,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists stock_balances_establishment_product_unit_unique
  on public.stock_balances(establishment_id, product_id, unit_label);

create table if not exists public.inventory_labels (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  product_id uuid,
  label_code text not null,
  qty numeric not null,
  qty_balance numeric not null default 0,
  used_qty numeric not null default 0,
  unit_label text not null,
  status text not null default 'available',
  order_id uuid,
  separated_at timestamptz,
  separated_by uuid,
  created_by uuid,
  notes text,
  last_action text,
  movement_id uuid,
  batch_number text,
  manufacturing_date date,
  expiration_date date,
  storage_location text,
  created_at timestamptz not null default now()
);

alter table public.inventory_labels
  add column if not exists establishment_id uuid,
  add column if not exists product_id uuid,
  add column if not exists label_code text,
  add column if not exists qty numeric,
  add column if not exists qty_balance numeric default 0,
  add column if not exists used_qty numeric default 0,
  add column if not exists unit_label text,
  add column if not exists status text default 'available',
  add column if not exists order_id uuid,
  add column if not exists separated_at timestamptz,
  add column if not exists separated_by uuid,
  add column if not exists created_by uuid,
  add column if not exists notes text,
  add column if not exists last_action text,
  add column if not exists movement_id uuid,
  add column if not exists batch_number text,
  add column if not exists manufacturing_date date,
  add column if not exists expiration_date date,
  add column if not exists storage_location text,
  add column if not exists created_at timestamptz default now();

create unique index if not exists inventory_labels_establishment_label_code_unique
  on public.inventory_labels(establishment_id, label_code);

create index if not exists inventory_labels_product_idx
  on public.inventory_labels(establishment_id, product_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  product_id uuid not null,
  label_id uuid,
  inventory_count_id uuid,
  order_id uuid,
  qty numeric not null,
  qty_delta numeric,
  unit_label text not null,
  direction text not null,
  movement_type text,
  reason text,
  location text,
  notes text,
  details jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.inventory_movements
  add column if not exists establishment_id uuid,
  add column if not exists product_id uuid,
  add column if not exists label_id uuid,
  add column if not exists inventory_count_id uuid,
  add column if not exists order_id uuid,
  add column if not exists qty numeric,
  add column if not exists qty_delta numeric,
  add column if not exists unit_label text,
  add column if not exists direction text,
  add column if not exists movement_type text,
  add column if not exists reason text,
  add column if not exists location text,
  add column if not exists notes text,
  add column if not exists details jsonb,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now();

create index if not exists inventory_movements_establishment_product_idx
  on public.inventory_movements(establishment_id, product_id);

create or replace function public.fn_upsert_stock_balance(
  p_establishment_id uuid,
  p_product_id uuid,
  p_qty_delta numeric,
  p_unit_label text
)
returns setof public.stock_balances
language sql
security invoker
set search_path = public, pg_temp
as $$
  insert into public.stock_balances (
    establishment_id,
    product_id,
    quantity,
    unit_label,
    updated_at
  )
  values (
    p_establishment_id,
    p_product_id,
    coalesce(p_qty_delta, 0),
    upper(trim(coalesce(p_unit_label, 'UN'))),
    now()
  )
  on conflict (establishment_id, product_id, unit_label)
  do update set
    quantity = public.stock_balances.quantity + excluded.quantity,
    updated_at = now()
  returning *;
$$;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  monthly_price_in_cents integer,
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  plan_slug text not null references public.subscription_plans(slug),
  status text not null default 'trialing' check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'blocked')
  ),
  external_customer_id text,
  external_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_subscriptions_establishment_idx
  on public.company_subscriptions(establishment_id);

create index if not exists company_subscriptions_status_idx
  on public.company_subscriptions(status);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  actor_user_id uuid,
  target_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_establishment_created_idx
  on public.audit_logs(establishment_id, created_at desc);

create index if not exists audit_logs_actor_idx
  on public.audit_logs(actor_user_id);

insert into public.subscription_plans (slug, name, description, monthly_price_in_cents, limits)
values
  (
    'starter',
    'Starter',
    'Plano para pequena operacao, cozinha, confeitaria ou restaurante pequeno.',
    3990,
    '{"users":5,"establishments":1,"products":500}'::jsonb
  ),
  (
    'growth',
    'Growth',
    'Plano para operacao maior, empresa com mais setores ou pequena rede.',
    9990,
    '{"users":20,"establishments":3,"products":5000}'::jsonb
  ),
  (
    'enterprise',
    'Enterprise',
    'Plano personalizado para redes, operacao premium ou implantacao sob medida.',
    null,
    '{"users":null,"establishments":null,"products":null}'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price_in_cents = excluded.monthly_price_in_cents,
  limits = excluded.limits,
  updated_at = now();

alter table public.subscription_plans enable row level security;
alter table public.company_subscriptions enable row level security;
alter table public.audit_logs enable row level security;

-- Leitura de planos para usuarios autenticados.
drop policy if exists "Authenticated users can read active plans" on public.subscription_plans;
create policy "Authenticated users can read active plans"
  on public.subscription_plans
  for select
  to authenticated
  using (is_active = true);

-- Assinaturas: usuarios podem consultar somente empresas onde possuem membership ativa.
drop policy if exists "Members can read own company subscriptions" on public.company_subscriptions;
create policy "Members can read own company subscriptions"
  on public.company_subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.establishment_id = company_subscriptions.establishment_id
        and m.user_id = auth.uid()
        and m.is_active = true
    )
  );

-- Auditoria: usuarios podem consultar somente logs da propria empresa.
drop policy if exists "Members can read own company audit logs" on public.audit_logs;
create policy "Members can read own company audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.establishment_id = audit_logs.establishment_id
        and m.user_id = auth.uid()
        and m.is_active = true
    )
  );
