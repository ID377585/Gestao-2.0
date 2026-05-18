begin;

-- Restore legacy supplier catalog reads without changing or deleting supplier data.
-- suppliers is a legacy/global table without establishment_id, so this is an interim
-- read policy for authenticated users who have at least one active membership.

revoke all on table public.suppliers from anon;
grant select on table public.suppliers to authenticated;

drop policy if exists gestify_deny_direct_client_access on public.suppliers;
drop policy if exists gestify_suppliers_catalog_select_authenticated_member on public.suppliers;

create policy gestify_suppliers_catalog_select_authenticated_member
on public.suppliers
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and coalesce(m.is_active, true) = true
  )
  or exists (
    select 1
    from public.establishment_memberships em
    where em.user_id = auth.uid()
      and em.is_active = true
  )
);

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '202605170005_gestify_restore_suppliers_catalog_read',
  'Restored SELECT access to the legacy suppliers catalog for authenticated users with active membership; no supplier rows were changed or deleted.'
)
on conflict (migration_name) do nothing;

commit;
