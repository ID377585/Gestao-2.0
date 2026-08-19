begin;

-- Several tenant tables existed in the legacy Production database before this
-- migration history became self-contained. Reconstruct the current compatible
-- contracts so staging/DR can be built exclusively from versioned migrations.

create table if not exists public.customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  establishment_id uuid not null,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);
create index if not exists customers_establishment_id_idx on public.customers(establishment_id);

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  total_items integer,
  total_products integer
);
create index if not exists idx_inventory_counts_created_by on public.inventory_counts(created_by);
create index if not exists idx_inventory_counts_estab on public.inventory_counts(establishment_id);
create index if not exists idx_inventory_counts_estab_created on public.inventory_counts(establishment_id, started_at desc);

create table if not exists public.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  inventory_count_id uuid not null references public.inventory_counts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  unit_label text not null,
  counted_qty numeric not null,
  current_stock_before numeric,
  diff_qty numeric not null,
  created_at timestamptz not null default now(),
  product_name text,
  status text,
  error_message text
);
create index if not exists idx_inventory_count_items_count on public.inventory_count_items(inventory_count_id);
create index if not exists idx_inventory_count_items_product on public.inventory_count_items(product_id);

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
create index if not exists shipping_carriers_establishment_id_idx on public.shipping_carriers(establishment_id);

create table if not exists public.order_billing_drafts (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id),
  order_id uuid not null references public.orders(id) on delete cascade,
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
create unique index if not exists order_billing_drafts_order_id_key on public.order_billing_drafts(order_id);
create index if not exists idx_order_billing_drafts_carrier_id on public.order_billing_drafts(carrier_id);
create index if not exists idx_order_billing_drafts_created_by on public.order_billing_drafts(created_by);
create index if not exists idx_order_billing_drafts_establishment_id on public.order_billing_drafts(establishment_id);

create table if not exists public.fiscal_company_profiles (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null unique,
  razao_social text not null,
  nome_fantasia text,
  cnpj text not null,
  inscricao_estadual text,
  telefone text,
  endereco text,
  numero text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_company_profiles_establishment_id_fkey'
      and conrelid = 'public.fiscal_company_profiles'::regclass
  ) then
    alter table public.fiscal_company_profiles
      add constraint fiscal_company_profiles_establishment_id_fkey
      foreign key (establishment_id) references public.establishments(id)
      on delete restrict not valid;
  end if;
end $$;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  product_id uuid not null references public.products(id),
  label_id uuid references public.inventory_labels(id),
  order_id uuid references public.orders(id),
  movement_type text default 'entrada_etiqueta',
  direction text not null,
  qty numeric not null,
  unit_label text not null,
  details jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  reason text,
  notes text,
  inventory_count_id uuid references public.inventory_counts(id),
  qty_delta numeric,
  location text default 'Estoque Principal',
  constraint inventory_movements_unit_uppercase check (unit_label = upper(unit_label))
);
create index if not exists idx_inventory_movements_created_at on public.inventory_movements(created_at desc);
create index if not exists idx_inventory_movements_created_by on public.inventory_movements(created_by);
create index if not exists idx_inventory_movements_estab_prod_unit on public.inventory_movements(establishment_id, product_id, unit_label);
create index if not exists idx_inventory_movements_inventory_count_id on public.inventory_movements(inventory_count_id);
create index if not exists idx_inventory_movements_order_id on public.inventory_movements(order_id);
create index if not exists idx_inventory_movements_product_id on public.inventory_movements(product_id);
create index if not exists inventory_movements_label_id_idx on public.inventory_movements(label_id);

-- Fail closed during reconstruction. Canonical tenant policies are installed by
-- the immediately-following consolidation migrations. Shipping carriers keep a
-- small tenant-scoped policy set because no later migration creates them fresh.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers',
    'inventory_counts',
    'inventory_count_items',
    'shipping_carriers',
    'order_billing_drafts',
    'fiscal_company_profiles',
    'inventory_movements'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all privileges on table public.%I from anon, authenticated', table_name);
    execute format('grant all privileges on table public.%I to service_role', table_name);
  end loop;
end $$;

grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.inventory_counts to authenticated;
grant select, insert, update, delete on table public.inventory_count_items to authenticated;
grant select, insert, update, delete on table public.shipping_carriers to authenticated;
grant select, insert, update, delete on table public.order_billing_drafts to authenticated;
grant select, insert, update, delete on table public.fiscal_company_profiles to authenticated;
grant select, insert, update, delete on table public.inventory_movements to authenticated;

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

commit;
