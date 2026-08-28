begin;

create or replace function private.gestify_can_access_module(
  target_establishment_id uuid,
  target_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.establishment_id = target_establishment_id
      and m.is_active = true
      and coalesce(
        (
          select ump.can_access
          from public.user_module_permissions ump
          where ump.establishment_id = target_establishment_id
            and ump.user_id = (select auth.uid())
            and ump.module_key = target_module_key
          limit 1
        ),
        case
          when m.role = 'admin' then true
          when m.role = 'estoque' and target_module_key in ('estoque', 'rh') then true
          when m.role in ('operacao', 'producao')
            and target_module_key in ('operacao', 'engenharia', 'rh') then true
          when m.role = 'fiscal' and target_module_key in ('fiscal', 'rh') then true
          when m.role = 'entrega' and target_module_key in ('operacao', 'rh') then true
          else false
        end
      ) = true
  );
$$;

revoke all on function private.gestify_can_access_module(uuid, text)
  from public, anon;
grant execute on function private.gestify_can_access_module(uuid, text)
  to authenticated, service_role;

comment on function private.gestify_can_access_module(uuid, text) is
  'Valida associação ativa e permissão efetiva por módulo, respeitando overrides e defaults de papel do Gestify.';

drop policy if exists inventory_catalog_items_member_select
  on public.inventory_catalog_items;
drop policy if exists inventory_catalog_items_member_insert
  on public.inventory_catalog_items;
drop policy if exists inventory_catalog_items_member_update
  on public.inventory_catalog_items;
drop policy if exists inventory_catalog_items_member_delete
  on public.inventory_catalog_items;

create policy inventory_catalog_items_module_select
on public.inventory_catalog_items
for select
to authenticated
using (
  (select private.gestify_can_access_module(
    inventory_catalog_items.establishment_id,
    'estoque'
  ))
);

create policy inventory_catalog_items_module_insert
on public.inventory_catalog_items
for insert
to authenticated
with check (
  (select private.gestify_can_access_module(
    inventory_catalog_items.establishment_id,
    'estoque'
  ))
);

create policy inventory_catalog_items_module_update
on public.inventory_catalog_items
for update
to authenticated
using (
  (select private.gestify_can_access_module(
    inventory_catalog_items.establishment_id,
    'estoque'
  ))
)
with check (
  (select private.gestify_can_access_module(
    inventory_catalog_items.establishment_id,
    'estoque'
  ))
);

create policy inventory_catalog_items_module_delete
on public.inventory_catalog_items
for delete
to authenticated
using (
  (select private.gestify_can_access_module(
    inventory_catalog_items.establishment_id,
    'estoque'
  ))
);

commit;
