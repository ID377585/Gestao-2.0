begin;

-- The hosted database already contained this table before the migration history
-- became complete. Recreate the exact structural contract so a clean staging
-- bootstrap does not depend on a dashboard-created object.
create table if not exists public.production_productivity (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid,
  collaborator_id uuid,
  product_id uuid,
  qty_produced numeric not null,
  unit_label text,
  started_at timestamptz default now(),
  finished_at timestamptz,
  duration_minutes numeric,
  created_at timestamptz default now(),
  order_item_id_alt uuid
);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.production_productivity'::regclass
      and conname = 'production_productivity_order_item_id_fkey'
  ) then
    alter table public.production_productivity
      add constraint production_productivity_order_item_id_fkey
      foreign key (order_item_id)
      references public.order_line_items(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.production_productivity'::regclass
      and conname = 'production_productivity_order_item_id_alt_fkey'
  ) then
    alter table public.production_productivity
      add constraint production_productivity_order_item_id_alt_fkey
      foreign key (order_item_id_alt)
      references public.order_items(id)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.production_productivity'::regclass
      and conname = 'production_productivity_collaborator_id_fkey'
  ) then
    alter table public.production_productivity
      add constraint production_productivity_collaborator_id_fkey
      foreign key (collaborator_id)
      references public.profiles(id)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.production_productivity'::regclass
      and conname = 'production_productivity_product_id_fkey'
  ) then
    alter table public.production_productivity
      add constraint production_productivity_product_id_fkey
      foreign key (product_id)
      references public.products(id)
      not valid;
  end if;
end $$;

create index if not exists idx_production_productivity_order_item
  on public.production_productivity(order_item_id);
create index if not exists idx_production_productivity_order_item_id_alt
  on public.production_productivity(order_item_id_alt);
create index if not exists idx_production_productivity_collaborator
  on public.production_productivity(collaborator_id);
create index if not exists idx_production_productivity_product_id
  on public.production_productivity(product_id);

alter table public.production_productivity enable row level security;
alter table public.production_productivity force row level security;

drop policy if exists production_productivity_tenant_select
  on public.production_productivity;
create policy production_productivity_tenant_select
  on public.production_productivity
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.order_line_items oli
      where oli.id = production_productivity.order_item_id
        and (select private.gestify_is_establishment_member(oli.establishment_id))
    )
    or exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = production_productivity.order_item_id_alt
        and (select private.gestify_is_establishment_member(o.establishment_id))
    )
  );

drop policy if exists production_productivity_tenant_write
  on public.production_productivity;
create policy production_productivity_tenant_write
  on public.production_productivity
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.order_line_items oli
      where oli.id = production_productivity.order_item_id
        and (select private.gestify_has_establishment_role(
          oli.establishment_id,
          array['admin', 'operacao', 'producao']::text[]
        ))
    )
    or exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = production_productivity.order_item_id_alt
        and (select private.gestify_has_establishment_role(
          o.establishment_id,
          array['admin', 'operacao', 'producao']::text[]
        ))
    )
  )
  with check (
    exists (
      select 1
      from public.order_line_items oli
      where oli.id = production_productivity.order_item_id
        and (select private.gestify_has_establishment_role(
          oli.establishment_id,
          array['admin', 'operacao', 'producao']::text[]
        ))
    )
    or exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = production_productivity.order_item_id_alt
        and (select private.gestify_has_establishment_role(
          o.establishment_id,
          array['admin', 'operacao', 'producao']::text[]
        ))
    )
  );

revoke all privileges on table public.production_productivity
  from anon, authenticated, public;
grant select, insert, update, delete
  on table public.production_productivity
  to authenticated;
grant all privileges
  on table public.production_productivity
  to service_role;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260727153000_grant_production_productivity_authenticated_access',
  'Created the missing production_productivity baseline with tenant-scoped RLS, exact hosted foreign keys and indexes, authenticated DML constrained by membership/role, and no anonymous access.'
)
on conflict (migration_name) do nothing;

commit;
