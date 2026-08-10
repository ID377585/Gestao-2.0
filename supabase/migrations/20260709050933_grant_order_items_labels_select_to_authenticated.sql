begin;

-- The original hosted project already contained this table before migration
-- history was complete. Define the missing baseline here so clean staging and
-- preview databases do not depend on an out-of-band dashboard-created object.
create table if not exists public.order_items_labels (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  order_item_id uuid references public.order_items(id),
  label_id uuid not null references public.inventory_labels(id),
  qty_used numeric not null,
  unit_label text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_labels_order_id
  on public.order_items_labels(order_id);
create index if not exists idx_order_items_labels_order_item_id
  on public.order_items_labels(order_item_id);
create index if not exists idx_order_items_labels_label_id
  on public.order_items_labels(label_id);

alter table public.order_items_labels enable row level security;
alter table public.order_items_labels force row level security;

drop policy if exists gestify_order_items_labels_select
  on public.order_items_labels;
create policy gestify_order_items_labels_select
  on public.order_items_labels
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items_labels.order_id
        and (select private.gestify_is_establishment_member(o.establishment_id))
    )
  );

drop policy if exists gestify_order_items_labels_write
  on public.order_items_labels;
create policy gestify_order_items_labels_write
  on public.order_items_labels
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items_labels.order_id
        and (select private.gestify_has_establishment_role(
          o.establishment_id,
          array['admin', 'operacao', 'estoque']::text[]
        ))
    )
  )
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_items_labels.order_id
        and (select private.gestify_has_establishment_role(
          o.establishment_id,
          array['admin', 'operacao', 'estoque']::text[]
        ))
    )
  );

-- The browser only needs read access. Mutations continue through reviewed
-- SECURITY DEFINER lifecycle RPCs; service_role retains maintenance access.
revoke all privileges on table public.order_items_labels
  from anon, authenticated, public;
grant select on table public.order_items_labels to authenticated;
grant all privileges on table public.order_items_labels to service_role;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260709050933_grant_order_items_labels_select_to_authenticated',
  'Created the missing order_items_labels baseline, indexes and tenant-scoped RLS; granted authenticated read-only access and service_role maintenance access.'
)
on conflict (migration_name) do nothing;

commit;
