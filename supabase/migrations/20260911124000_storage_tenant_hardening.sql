-- Tenant-scope sensitive Storage buckets without deleting objects.
-- Object paths for these buckets are expected to start with establishment_id UUID.

begin;

-- Buckets are created by application/runtime flows in some environments. Only
-- harden rows that already exist so fresh migration replay stays deterministic.
update storage.buckets
set public = false
where id in (
  'fiscal-certificates',
  'fiscal-nfe-xmls',
  'invoice-entry-files',
  'technical-sheet-images',
  'technical-sheets'
);

-- Remove legacy authenticated-wide policies. This does not delete objects.
drop policy if exists "Usuários autenticados podem enviar XMLs fiscais" on storage.objects;
drop policy if exists "Usuários autenticados podem enviar certificados fiscais" on storage.objects;
drop policy if exists "Usuários autenticados podem ler XMLs fiscais" on storage.objects;
drop policy if exists "Usuários autenticados podem ler certificados fiscais" on storage.objects;
drop policy if exists "invoice entry files authenticated delete" on storage.objects;
drop policy if exists "invoice entry files authenticated insert" on storage.objects;
drop policy if exists "invoice entry files authenticated update" on storage.objects;
drop policy if exists "technical sheet images authenticated delete" on storage.objects;
drop policy if exists "technical sheet images authenticated insert" on storage.objects;
drop policy if exists "technical sheet images authenticated update" on storage.objects;
drop policy if exists technical_sheet_images_authenticated_delete on storage.objects;
drop policy if exists technical_sheet_images_authenticated_insert on storage.objects;
drop policy if exists technical_sheet_images_authenticated_update on storage.objects;

-- Fiscal certificate/XML objects are restricted to fiscal/admin roles.
drop policy if exists gestify_fiscal_storage_select on storage.objects;
create policy gestify_fiscal_storage_select on storage.objects
for select to authenticated
using (
  bucket_id in ('fiscal-certificates','fiscal-nfe-xmls')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin','fiscal'])
);

drop policy if exists gestify_fiscal_storage_insert on storage.objects;
create policy gestify_fiscal_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('fiscal-certificates','fiscal-nfe-xmls')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin','fiscal'])
);

drop policy if exists gestify_fiscal_storage_update on storage.objects;
create policy gestify_fiscal_storage_update on storage.objects
for update to authenticated
using (
  bucket_id in ('fiscal-certificates','fiscal-nfe-xmls')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin','fiscal'])
)
with check (
  bucket_id in ('fiscal-certificates','fiscal-nfe-xmls')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin','fiscal'])
);

drop policy if exists gestify_fiscal_storage_delete on storage.objects;
create policy gestify_fiscal_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('fiscal-certificates','fiscal-nfe-xmls')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin','fiscal'])
);

-- Other sensitive operational files: active tenant members can read; staff can write.
drop policy if exists gestify_operational_storage_member_select on storage.objects;
create policy gestify_operational_storage_member_select on storage.objects
for select to authenticated
using (
  bucket_id in ('invoice-entry-files','technical-sheet-images','technical-sheets')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.gestify_is_establishment_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists gestify_operational_storage_staff_insert on storage.objects;
create policy gestify_operational_storage_staff_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('invoice-entry-files','technical-sheet-images','technical-sheets')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin','operacao','estoque','fiscal'])
);

drop policy if exists gestify_operational_storage_staff_update on storage.objects;
create policy gestify_operational_storage_staff_update on storage.objects
for update to authenticated
using (
  bucket_id in ('invoice-entry-files','technical-sheet-images','technical-sheets')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin','operacao','estoque','fiscal'])
)
with check (
  bucket_id in ('invoice-entry-files','technical-sheet-images','technical-sheets')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin','operacao','estoque','fiscal'])
);

drop policy if exists gestify_operational_storage_admin_delete on storage.objects;
create policy gestify_operational_storage_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('invoice-entry-files','technical-sheet-images','technical-sheets')
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin'])
);

commit;
