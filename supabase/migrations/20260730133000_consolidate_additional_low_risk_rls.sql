begin;

-- establishment_memberships: keep the same access model with one SELECT policy.
drop policy if exists "memberships_select_admin_same_establishment" on public.establishment_memberships;
drop policy if exists "memberships_select_own" on public.establishment_memberships;

create policy "establishment_memberships_select_own_or_admin"
  on public.establishment_memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.gestify_has_establishment_role(establishment_id, array['admin']))
  );

-- fiscal_company_profiles: split the previous ALL policy into write-only policies
-- and keep a single tenant-scoped SELECT policy.
drop policy if exists "Members can read own fiscal company profiles" on public.fiscal_company_profiles;
drop policy if exists "fiscal_company_profiles_tenant_select" on public.fiscal_company_profiles;
drop policy if exists "fiscal_company_profiles_fiscal_write" on public.fiscal_company_profiles;

create policy "fiscal_company_profiles_select_member"
  on public.fiscal_company_profiles
  for select
  to authenticated
  using ((select private.gestify_is_establishment_member(establishment_id)));

create policy "fiscal_company_profiles_insert_fiscal"
  on public.fiscal_company_profiles
  for insert
  to authenticated
  with check ((select private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal'])));

create policy "fiscal_company_profiles_update_fiscal"
  on public.fiscal_company_profiles
  for update
  to authenticated
  using ((select private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal'])))
  with check ((select private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal'])));

create policy "fiscal_company_profiles_delete_admin"
  on public.fiscal_company_profiles
  for delete
  to authenticated
  using ((select private.gestify_has_establishment_role(establishment_id, array['admin'])));

-- inventory_movements: remove duplicate identical INSERT policies.
drop policy if exists "insert_inventory_movements_by_establishment" on public.inventory_movements;
drop policy if exists "inventory_movements_insert_by_membership" on public.inventory_movements;

create policy "inventory_movements_insert_member"
  on public.inventory_movements
  for insert
  to authenticated
  with check ((select private.gestify_is_establishment_member(establishment_id)));

commit;
