begin;

-- Phase 2 hardening:
-- - restore hosted tables that predated complete migration history;
-- - remove anonymous SQL access from operational tables that still had broad grants;
-- - restrict legacy PUBLIC policies to authenticated users;
-- - convert direct auth.uid()/auth.role() calls in policy expressions to initPlan-friendly SELECT calls.

-- Shipping and billing were originally created out of band in the hosted
-- project. Recreate their exact structural contract before later RLS
-- consolidation so a clean staging bootstrap is self-contained.
create table if not exists public.shipping_carriers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  vehicle_type text,
  has_refrigeration boolean not null default false,
  initial_temp_c numeric,
  delivery_temp_c numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shipping_carriers_establishment_id
  on public.shipping_carriers(establishment_id);

alter table public.shipping_carriers enable row level security;
alter table public.shipping_carriers force row level security;

drop policy if exists shipping_carriers_select on public.shipping_carriers;
create policy shipping_carriers_select
  on public.shipping_carriers
  for select
  to authenticated
  using ((select private.gestify_is_establishment_member(establishment_id)));

drop policy if exists shipping_carriers_insert on public.shipping_carriers;
create policy shipping_carriers_insert
  on public.shipping_carriers
  for insert
  to authenticated
  with check ((select private.gestify_is_establishment_member(establishment_id)));

drop policy if exists shipping_carriers_update on public.shipping_carriers;
create policy shipping_carriers_update
  on public.shipping_carriers
  for update
  to authenticated
  using ((select private.gestify_is_establishment_member(establishment_id)))
  with check ((select private.gestify_is_establishment_member(establishment_id)));

create table if not exists public.order_billing_drafts (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  base_cost numeric not null,
  markup_percent numeric not null,
  total_value numeric not null,
  items jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  subtotal numeric not null default 0,
  total_with_markup numeric not null default 0,
  freight_value numeric not null default 0,
  carrier_id uuid references public.shipping_carriers(id)
);

create index if not exists idx_order_billing_drafts_establishment_id
  on public.order_billing_drafts(establishment_id);
create index if not exists idx_order_billing_drafts_created_by
  on public.order_billing_drafts(created_by);
create index if not exists idx_order_billing_drafts_carrier_id
  on public.order_billing_drafts(carrier_id);

alter table public.order_billing_drafts enable row level security;
alter table public.order_billing_drafts force row level security;

revoke all privileges on table public.shipping_carriers
  from anon, authenticated, public;
grant select, insert, update, delete
  on table public.shipping_carriers
  to authenticated;
grant all privileges on table public.shipping_carriers to service_role;

revoke all privileges on table public.order_billing_drafts
  from anon, authenticated, public;
grant select, insert, update, delete
  on table public.order_billing_drafts
  to authenticated;
grant all privileges on table public.order_billing_drafts to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inventory_movements',
    'kitchen_checklist_run_items',
    'kitchen_checklist_runs',
    'kitchen_checklist_template_items',
    'kitchen_checklist_templates',
    'losses',
    'order_items',
    'order_line_items',
    'order_separation_sessions',
    'order_timeline',
    'product_nutrition_facts',
    'shipping_carriers',
    'technical_sheet_ingredients',
    'technical_sheet_nutrition_snapshots'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all privileges on table public.%I from anon', table_name);
      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    end if;
  end loop;
end $$;

do $$
declare
  policy_record record;
  statement text;
  normalized_qual text;
  normalized_with_check text;
begin
  for policy_record in
    select schemaname, tablename, policyname, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        'public' = any(roles)
        or qual like '%auth.uid()%'
        or with_check like '%auth.uid()%'
        or qual like '%auth.role()%'
        or with_check like '%auth.role()%'
      )
  loop
    normalized_qual := policy_record.qual;
    normalized_with_check := policy_record.with_check;

    if normalized_qual is not null then
      normalized_qual := replace(normalized_qual, 'auth.uid()', '(select auth.uid())');
      normalized_qual := replace(normalized_qual, 'auth.role()', '(select auth.role())');
    end if;

    if normalized_with_check is not null then
      normalized_with_check := replace(normalized_with_check, 'auth.uid()', '(select auth.uid())');
      normalized_with_check := replace(normalized_with_check, 'auth.role()', '(select auth.role())');
    end if;

    statement := format(
      'alter policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );

    if 'public' = any(policy_record.roles) then
      statement := statement || ' to authenticated';
    end if;

    if normalized_qual is not null then
      statement := statement || format(' using (%s)', normalized_qual);
    end if;

    if normalized_with_check is not null then
      statement := statement || format(' with check (%s)', normalized_with_check);
    end if;

    execute statement;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
