-- Restores the security contract observed in the live environment after a clean replay.
-- This migration is intentionally additive/idempotent and must be validated in staging first.

begin;

-- Tables that are protected in the live environment must never be replayed with RLS disabled.
alter table if exists public.establishment_memberships enable row level security;
alter table if exists public.establishments enable row level security;
alter table if exists public.inventory_labels enable row level security;
alter table if exists public.memberships enable row level security;
alter table if exists public.order_invoice_items enable row level security;
alter table if exists public.order_invoices enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.order_line_items enable row level security;
alter table if exists public.pre_invoice_items enable row level security;
alter table if exists public.pre_invoices enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.technical_sheets enable row level security;
alter table if exists public.user_notification_preferences enable row level security;

-- establishments: active members may read their own establishment.
drop policy if exists "Members can read own establishments" on public.establishments;
create policy "Members can read own establishments"
  on public.establishments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.establishment_id = establishments.id
        and m.user_id = (select auth.uid())
        and m.is_active = true
    )
  );

-- memberships: a signed-in user may read only their own membership rows.
drop policy if exists memberships_read_own on public.memberships;
create policy memberships_read_own
  on public.memberships
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- order_items: preserve the live ownership/staff contract.
drop policy if exists order_items_insert_own_only_in_created on public.order_items;
create policy order_items_insert_own_only_in_created
  on public.order_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and o.customer_user_id = (select auth.uid())
        and o.status = 'pedido_criado'::public.order_status
    )
  );

drop policy if exists order_items_select_own_or_staff on public.order_items;
create policy order_items_select_own_or_staff
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and (
          o.customer_user_id = (select auth.uid())
          or public.is_staff()
        )
    )
  );

-- order_line_items: membership is the authenticated authorization boundary.
-- service_role keeps its database privileges and does not need an auth.role() branch
-- inside a policy scoped to authenticated.
drop policy if exists insert_order_line_items_by_membership on public.order_line_items;
create policy insert_order_line_items_by_membership
  on public.order_line_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.memberships m
      where m.establishment_id = order_line_items.establishment_id
        and m.user_id = (select auth.uid())
        and m.is_active = true
    )
  );

drop policy if exists select_order_line_items_by_membership on public.order_line_items;
create policy select_order_line_items_by_membership
  on public.order_line_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.establishment_id = order_line_items.establishment_id
        and m.user_id = (select auth.uid())
        and m.is_active = true
    )
  );

-- technical_sheets: CRUD remains scoped to an active establishment membership.
drop policy if exists technical_sheets_select_same_establishment on public.technical_sheets;
create policy technical_sheets_select_same_establishment
  on public.technical_sheets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = technical_sheets.establishment_id
        and em.user_id = (select auth.uid())
        and em.is_active = true
    )
  );

drop policy if exists technical_sheets_insert_same_establishment on public.technical_sheets;
create policy technical_sheets_insert_same_establishment
  on public.technical_sheets
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = technical_sheets.establishment_id
        and em.user_id = (select auth.uid())
        and em.is_active = true
    )
  );

drop policy if exists technical_sheets_update_same_establishment on public.technical_sheets;
create policy technical_sheets_update_same_establishment
  on public.technical_sheets
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = technical_sheets.establishment_id
        and em.user_id = (select auth.uid())
        and em.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = technical_sheets.establishment_id
        and em.user_id = (select auth.uid())
        and em.is_active = true
    )
  );

drop policy if exists technical_sheets_delete_same_establishment on public.technical_sheets;
create policy technical_sheets_delete_same_establishment
  on public.technical_sheets
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = technical_sheets.establishment_id
        and em.user_id = (select auth.uid())
        and em.is_active = true
    )
  );

-- Prevent unauthenticated callers from invoking a SECURITY DEFINER helper used by RLS.
revoke all privileges on function public.current_user_can_manage_establishment(uuid) from public;
revoke all privileges on function public.current_user_can_manage_establishment(uuid) from anon;
grant execute on function public.current_user_can_manage_establishment(uuid) to authenticated;
grant execute on function public.current_user_can_manage_establishment(uuid) to service_role;

-- Pin mutable search paths identified by the Security Advisor.
alter function public.update_updated_at_column() set search_path = pg_catalog, public;
alter function public.set_updated_at() set search_path = pg_catalog, public;
alter function private.gestify_legacy_table_names() set search_path = pg_catalog, private;

commit;
