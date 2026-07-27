begin;

revoke all privileges on table public.tenant_invitations from anon;
revoke all privileges on table public.tenant_invitations from authenticated;
grant select, insert, update on table public.tenant_invitations to authenticated;

drop policy if exists "tenant_invitations_staff_insert" on public.tenant_invitations;
drop policy if exists "tenant_invitations_staff_read" on public.tenant_invitations;
drop policy if exists "tenant_invitations_staff_update" on public.tenant_invitations;

create policy "tenant_invitations_staff_read"
on public.tenant_invitations
for select
to authenticated
using (
  (select private.gestify_has_establishment_role(
    establishment_id,
    array['admin','operacao']::text[]
  ))
);

create policy "tenant_invitations_staff_insert"
on public.tenant_invitations
for insert
to authenticated
with check (
  (select private.gestify_has_establishment_role(
    establishment_id,
    array['admin','operacao']::text[]
  ))
);

create policy "tenant_invitations_staff_update"
on public.tenant_invitations
for update
to authenticated
using (
  (select private.gestify_has_establishment_role(
    establishment_id,
    array['admin','operacao']::text[]
  ))
)
with check (
  (select private.gestify_has_establishment_role(
    establishment_id,
    array['admin','operacao']::text[]
  ))
);

notify pgrst, 'reload schema';

commit;
