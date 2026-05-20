-- Corrige cadastro/edição de fornecedores.
-- A tabela public.suppliers já possui RLS ativo e política de SELECT,
-- mas faltavam políticas para INSERT e UPDATE via usuário autenticado.

drop policy if exists gestify_suppliers_catalog_insert_authenticated_member on public.suppliers;
drop policy if exists gestify_suppliers_catalog_update_authenticated_member on public.suppliers;

create policy gestify_suppliers_catalog_insert_authenticated_member
on public.suppliers
for insert
to authenticated
with check (
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

create policy gestify_suppliers_catalog_update_authenticated_member
on public.suppliers
for update
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
)
with check (
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
