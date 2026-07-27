begin;

-- The legacy Compras client already writes and filters establishment_id.
-- Keep the established tenant-scoped policies and remove the older catalog
-- policies that granted access based only on having any active membership.
drop policy if exists "gestify_suppliers_catalog_select_authenticated_member"
  on public.suppliers;
drop policy if exists "gestify_suppliers_catalog_insert_authenticated_member"
  on public.suppliers;
drop policy if exists "gestify_suppliers_catalog_update_authenticated_member"
  on public.suppliers;

notify pgrst, 'reload schema';

commit;
