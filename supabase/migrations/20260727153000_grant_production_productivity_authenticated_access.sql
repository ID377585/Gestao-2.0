begin;

-- production_productivity predates the tracked grant migration in the legacy
-- production database. Reconstruct the current compatible contract on fresh
-- environments so staging/DR can be built solely from migrations.
create table if not exists public.production_productivity (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid references public.order_line_items(id) on delete cascade,
  collaborator_id uuid references public.profiles(id),
  product_id uuid references public.products(id),
  qty_produced numeric not null,
  unit_label text,
  started_at timestamptz default now(),
  finished_at timestamptz,
  duration_minutes numeric,
  created_at timestamptz default now(),
  order_item_id_alt uuid references public.order_items(id)
);

create index if not exists idx_production_productivity_order_item
  on public.production_productivity(order_item_id);
create index if not exists idx_production_productivity_collaborator
  on public.production_productivity(collaborator_id);
create index if not exists idx_production_productivity_product_id
  on public.production_productivity(product_id);
create index if not exists idx_production_productivity_order_item_id_alt
  on public.production_productivity(order_item_id_alt);

alter table public.production_productivity enable row level security;
alter table public.production_productivity force row level security;

revoke all privileges on table public.production_productivity from anon, authenticated;
grant select, insert, update, delete on table public.production_productivity to authenticated;
grant all on table public.production_productivity to service_role;

drop policy if exists production_productivity_tenant_select on public.production_productivity;
create policy production_productivity_tenant_select
on public.production_productivity
for select
to authenticated
using (
  exists (
    select 1
    from public.order_line_items oli
    where oli.id = production_productivity.order_item_id
      and private.gestify_is_establishment_member(oli.establishment_id)
  )
  or exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = production_productivity.order_item_id_alt
      and private.gestify_is_establishment_member(o.establishment_id)
  )
);

drop policy if exists production_productivity_tenant_write on public.production_productivity;
create policy production_productivity_tenant_write
on public.production_productivity
for all
to authenticated
using (
  exists (
    select 1
    from public.order_line_items oli
    where oli.id = production_productivity.order_item_id
      and private.gestify_has_establishment_role(
        oli.establishment_id,
        array['admin','operacao','producao']::text[]
      )
  )
  or exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = production_productivity.order_item_id_alt
      and private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','producao']::text[]
      )
  )
)
with check (
  exists (
    select 1
    from public.order_line_items oli
    where oli.id = production_productivity.order_item_id
      and private.gestify_has_establishment_role(
        oli.establishment_id,
        array['admin','operacao','producao']::text[]
      )
  )
  or exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = production_productivity.order_item_id_alt
      and private.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','producao']::text[]
      )
  )
);

commit;
