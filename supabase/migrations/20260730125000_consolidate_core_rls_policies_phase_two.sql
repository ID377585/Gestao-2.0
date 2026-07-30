begin;

-- Normalize tenant helper functions used by RLS policies.
create or replace function private.gestify_is_establishment_member(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = (select auth.uid())
      and em.is_active = true
  )
  or exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = (select auth.uid())
      and coalesce(m.is_active, true) = true
  );
$function$;

create or replace function private.gestify_has_establishment_role(
  p_establishment_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = (select auth.uid())
      and em.is_active = true
      and em.role::text = any(p_roles)
  ) or exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = (select auth.uid())
      and coalesce(m.is_active, true) = true
      and m.role = any(p_roles)
  );
$function$;

create or replace function public.is_establishment_member(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
  select (select private.gestify_is_establishment_member(p_establishment_id));
$function$;

revoke all on function public.is_establishment_member(uuid) from public, anon;
grant execute on function public.is_establishment_member(uuid) to authenticated, service_role;

-- Products: one policy per operation.
drop policy if exists "Products - delete by allowed roles" on public.products;
drop policy if exists "Products - insert by allowed roles" on public.products;
drop policy if exists "Products - select by membership" on public.products;
drop policy if exists "Products - update by allowed roles" on public.products;
drop policy if exists "insert_products_by_membership" on public.products;
drop policy if exists "products_insert" on public.products;
drop policy if exists "products_select" on public.products;
drop policy if exists "products_select_by_establishment" on public.products;
drop policy if exists "products_update" on public.products;
drop policy if exists "select_products_by_membership" on public.products;
drop policy if exists "update_products_by_membership" on public.products;

create policy "products_member_select"
on public.products
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

create policy "products_allowed_roles_insert"
on public.products
for insert
to authenticated
with check (
  (select private.gestify_has_establishment_role(
    establishment_id,
    array['admin', 'estoque', 'fiscal']::text[]
  ))
);

create policy "products_allowed_roles_update"
on public.products
for update
to authenticated
using (
  (select private.gestify_has_establishment_role(
    establishment_id,
    array['admin', 'estoque', 'fiscal']::text[]
  ))
)
with check (
  (select private.gestify_has_establishment_role(
    establishment_id,
    array['admin', 'estoque', 'fiscal']::text[]
  ))
);

create policy "products_allowed_roles_delete"
on public.products
for delete
to authenticated
using (
  (select private.gestify_has_establishment_role(
    establishment_id,
    array['admin', 'estoque', 'fiscal']::text[]
  ))
);

-- Stock movements: member-scoped immutable-ish operational access.
drop policy if exists "Users can insert stock movements for their establishment" on public.stock_movements;
drop policy if exists "Users can read stock movements of their establishment" on public.stock_movements;
drop policy if exists "Users can update stock movements of their establishment" on public.stock_movements;
drop policy if exists "insert_stock_movements_by_establishment" on public.stock_movements;

create policy "stock_movements_member_select"
on public.stock_movements
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

create policy "stock_movements_member_insert"
on public.stock_movements
for insert
to authenticated
with check ((select private.gestify_is_establishment_member(establishment_id)));

create policy "stock_movements_member_update"
on public.stock_movements
for update
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)))
with check ((select private.gestify_is_establishment_member(establishment_id)));

-- Customers.
drop policy if exists "customers_delete_blocked" on public.customers;
drop policy if exists "customers_insert_temp_authenticated" on public.customers;
drop policy if exists "customers_select_authenticated" on public.customers;
drop policy if exists "customers_select_by_establishment" on public.customers;
drop policy if exists "customers_update_blocked" on public.customers;
drop policy if exists "customers_upsert_admin" on public.customers;

create policy "customers_member_select"
on public.customers
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

create policy "customers_member_insert"
on public.customers
for insert
to authenticated
with check ((select private.gestify_is_establishment_member(establishment_id)));

create policy "customers_admin_update"
on public.customers
for update
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])))
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

create policy "customers_admin_delete"
on public.customers
for delete
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

-- Inventory counts.
drop policy if exists "insert inventory_counts by membership" on public.inventory_counts;
drop policy if exists "insert_inventory_counts_by_establishment" on public.inventory_counts;
drop policy if exists "inventory_counts_insert_member" on public.inventory_counts;
drop policy if exists "inventory_counts_insert_own_establishment" on public.inventory_counts;
drop policy if exists "inventory_counts_select_member" on public.inventory_counts;
drop policy if exists "inventory_counts_select_own_establishment" on public.inventory_counts;
drop policy if exists "select inventory_counts by membership" on public.inventory_counts;
drop policy if exists "select_inventory_counts_by_establishment" on public.inventory_counts;
drop policy if exists "inventory_counts_update_member" on public.inventory_counts;

create policy "inventory_counts_member_select"
on public.inventory_counts
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

create policy "inventory_counts_member_insert"
on public.inventory_counts
for insert
to authenticated
with check ((select private.gestify_is_establishment_member(establishment_id)));

create policy "inventory_counts_member_update"
on public.inventory_counts
for update
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)))
with check ((select private.gestify_is_establishment_member(establishment_id)));

-- Inventory count items inherit scope from the parent inventory count.
drop policy if exists "insert inventory_count_items by membership" on public.inventory_count_items;
drop policy if exists "inventory_count_items_insert_member" on public.inventory_count_items;
drop policy if exists "inventory_count_items_insert_own_establishment" on public.inventory_count_items;
drop policy if exists "inventory_count_items_select_member" on public.inventory_count_items;
drop policy if exists "inventory_count_items_select_own_establishment" on public.inventory_count_items;
drop policy if exists "select inventory_count_items by membership" on public.inventory_count_items;
drop policy if exists "inventory_count_items_update_member" on public.inventory_count_items;

create policy "inventory_count_items_member_select"
on public.inventory_count_items
for select
to authenticated
using (
  exists (
    select 1
    from public.inventory_counts c
    where c.id = inventory_count_items.inventory_count_id
      and (select private.gestify_is_establishment_member(c.establishment_id))
  )
);

create policy "inventory_count_items_member_insert"
on public.inventory_count_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.inventory_counts c
    where c.id = inventory_count_items.inventory_count_id
      and (select private.gestify_is_establishment_member(c.establishment_id))
  )
);

create policy "inventory_count_items_member_update"
on public.inventory_count_items
for update
to authenticated
using (
  exists (
    select 1
    from public.inventory_counts c
    where c.id = inventory_count_items.inventory_count_id
      and (select private.gestify_is_establishment_member(c.establishment_id))
  )
)
with check (
  exists (
    select 1
    from public.inventory_counts c
    where c.id = inventory_count_items.inventory_count_id
      and (select private.gestify_is_establishment_member(c.establishment_id))
  )
);

-- Inventory labels.
drop policy if exists "inventory_labels_insert_by_membership" on public.inventory_labels;
drop policy if exists "inventory_labels_insert_member" on public.inventory_labels;
drop policy if exists "inventory_labels_select_by_membership" on public.inventory_labels;
drop policy if exists "inventory_labels_select_member" on public.inventory_labels;
drop policy if exists "read_inventory_labels_by_membership" on public.inventory_labels;
drop policy if exists "inventory_labels_update_by_membership" on public.inventory_labels;
drop policy if exists "inventory_labels_update_member" on public.inventory_labels;

create policy "inventory_labels_member_select"
on public.inventory_labels
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

create policy "inventory_labels_member_insert"
on public.inventory_labels
for insert
to authenticated
with check ((select private.gestify_is_establishment_member(establishment_id)));

create policy "inventory_labels_member_update"
on public.inventory_labels
for update
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)))
with check ((select private.gestify_is_establishment_member(establishment_id)));

-- Losses.
drop policy if exists "losses_insert_by_membership" on public.losses;
drop policy if exists "losses_insert_same_establishment" on public.losses;
drop policy if exists "losses_select_by_membership" on public.losses;
drop policy if exists "losses_select_same_establishment" on public.losses;

create policy "losses_member_select"
on public.losses
for select
to authenticated
using ((select private.gestify_is_establishment_member(establishment_id)));

create policy "losses_member_insert"
on public.losses
for insert
to authenticated
with check ((select private.gestify_is_establishment_member(establishment_id)));

-- Billing drafts must match both membership and the referenced order establishment.
drop policy if exists "Insert drafts from my establishment" on public.order_billing_drafts;
drop policy if exists "Read drafts from my establishment" on public.order_billing_drafts;
drop policy if exists "Update drafts from my establishment" on public.order_billing_drafts;
drop policy if exists "order_billing_drafts_insert" on public.order_billing_drafts;
drop policy if exists "order_billing_drafts_select" on public.order_billing_drafts;
drop policy if exists "order_billing_drafts_update" on public.order_billing_drafts;

create policy "order_billing_drafts_member_select"
on public.order_billing_drafts
for select
to authenticated
using (
  (select private.gestify_is_establishment_member(establishment_id))
  and exists (
    select 1
    from public.orders o
    where o.id = order_billing_drafts.order_id
      and o.establishment_id = order_billing_drafts.establishment_id
  )
);

create policy "order_billing_drafts_member_insert"
on public.order_billing_drafts
for insert
to authenticated
with check (
  (select private.gestify_is_establishment_member(establishment_id))
  and exists (
    select 1
    from public.orders o
    where o.id = order_billing_drafts.order_id
      and o.establishment_id = order_billing_drafts.establishment_id
  )
);

create policy "order_billing_drafts_member_update"
on public.order_billing_drafts
for update
to authenticated
using (
  (select private.gestify_is_establishment_member(establishment_id))
  and exists (
    select 1
    from public.orders o
    where o.id = order_billing_drafts.order_id
      and o.establishment_id = order_billing_drafts.establishment_id
  )
)
with check (
  (select private.gestify_is_establishment_member(establishment_id))
  and exists (
    select 1
    from public.orders o
    where o.id = order_billing_drafts.order_id
      and o.establishment_id = order_billing_drafts.establishment_id
  )
);

notify pgrst, 'reload schema';

commit;
