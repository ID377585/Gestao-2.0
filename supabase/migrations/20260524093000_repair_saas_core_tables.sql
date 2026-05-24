begin;

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
  establishment_id uuid not null references public.establishments(id) on delete cascade,
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

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_subscriptions_establishment_idx
  on public.company_subscriptions(establishment_id);

create index if not exists company_subscriptions_status_idx
  on public.company_subscriptions(status);

create index if not exists audit_logs_establishment_created_idx
  on public.audit_logs(establishment_id, created_at desc);

create index if not exists audit_logs_actor_idx
  on public.audit_logs(actor_user_id);

drop trigger if exists set_subscription_plans_updated_at on public.subscription_plans;
create trigger set_subscription_plans_updated_at
before update on public.subscription_plans
for each row
execute function public.update_updated_at_column();

drop trigger if exists set_company_subscriptions_updated_at on public.company_subscriptions;
create trigger set_company_subscriptions_updated_at
before update on public.company_subscriptions
for each row
execute function public.update_updated_at_column();

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

drop policy if exists "Authenticated users can read active plans" on public.subscription_plans;
create policy "Authenticated users can read active plans"
  on public.subscription_plans
  for select
  to authenticated
  using (is_active = true);

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

grant select on table public.subscription_plans to authenticated;
grant select on table public.company_subscriptions to authenticated;
grant select on table public.audit_logs to authenticated;

commit;
