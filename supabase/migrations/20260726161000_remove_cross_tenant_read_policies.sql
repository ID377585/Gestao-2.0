begin;

-- Products: preserve application CRUD, remove anonymous table access and
-- legacy policies that made every tenant's catalog readable.
revoke all privileges on table public.products from anon;
revoke truncate, references, trigger on table public.products from authenticated;

drop policy if exists "products_select_authenticated" on public.products;
drop policy if exists "allow read products for logged users" on public.products;
drop policy if exists "allow products by membership" on public.products;

-- Fiscal data: existing tenant and role policies remain the authorization boundary.
revoke all privileges on table public.fiscal_company_profiles from anon;
revoke truncate, references, trigger on table public.fiscal_company_profiles from authenticated;

drop policy if exists "Authenticated users can read fiscal company profiles"
  on public.fiscal_company_profiles;

revoke all privileges on table public.fiscal_product_mappings from anon;
revoke truncate, references, trigger on table public.fiscal_product_mappings from authenticated;

drop policy if exists "Authenticated users can read fiscal product mappings"
  on public.fiscal_product_mappings;

-- Revision history is read-only to application clients and scoped through the
-- owning technical sheet/establishment.
revoke all privileges on table public.technical_sheet_versions from anon;
revoke all privileges on table public.technical_sheet_versions from authenticated;
grant select on table public.technical_sheet_versions to authenticated;

drop policy if exists "read_versions_same_establishment"
  on public.technical_sheet_versions;

create policy "technical_sheet_versions_tenant_select"
on public.technical_sheet_versions
for select
to authenticated
using (
  (select private.gestify_is_establishment_member(establishment_id))
);

revoke all privileges on table public.technical_sheet_revision_logs from anon;
revoke all privileges on table public.technical_sheet_revision_logs from authenticated;
grant select on table public.technical_sheet_revision_logs to authenticated;

drop policy if exists "read_logs_authenticated"
  on public.technical_sheet_revision_logs;

create policy "technical_sheet_revision_logs_tenant_select"
on public.technical_sheet_revision_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.technical_sheets ts
    where ts.id = technical_sheet_revision_logs.technical_sheet_id
      and (select private.gestify_is_establishment_member(ts.establishment_id))
  )
);

notify pgrst, 'reload schema';

commit;
