begin;

-- Production historically had this relation before the tracked migration chain.
-- Fresh environments do not, so reconstruct the minimal current-compatible
-- schema before applying the original SELECT grant. Keep it fail-closed by
-- enabling/forcing RLS and revoking direct access before adding scoped policies.
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
revoke all on table public.order_items_labels from anon, authenticated;

drop policy if exists gestify_order_items_labels_select on public.order_items_labels;
create policy gestify_order_items_labels_select
on public.order_items_labels
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items_labels.order_id
      and public.gestify_is_establishment_member(o.establishment_id)
  )
);

drop policy if exists gestify_order_items_labels_write on public.order_items_labels;
create policy gestify_order_items_labels_write
on public.order_items_labels
for all
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items_labels.order_id
      and public.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque']::text[]
      )
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items_labels.order_id
      and public.gestify_has_establishment_role(
        o.establishment_id,
        array['admin','operacao','estoque']::text[]
      )
  )
);

-- RLS restricts rows by order/establishment membership. The authenticated role
-- needs table-level SELECT to read collected order items; writes remain revoked
-- and flow through audited server/RPC paths.
grant select on table public.order_items_labels to authenticated;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260709050933_grant_order_items_labels_select_to_authenticated',
  'Reconstructed the legacy order_items_labels schema when absent, enabled fail-closed RLS, and granted authenticated SELECT under tenant-scoped policy.'
)
on conflict (migration_name) do nothing;

commit;
