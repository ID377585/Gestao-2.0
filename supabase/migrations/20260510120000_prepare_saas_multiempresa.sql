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
