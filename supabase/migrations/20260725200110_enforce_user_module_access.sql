-- Permite que cada usuario autenticado leia somente as permissoes de modulos
-- do proprio vinculo ativo. A edicao continua restrita pelas policies de
-- administracao ja existentes.

begin;

alter table public.user_module_permissions enable row level security;

drop policy if exists "read own active module permissions" on public.user_module_permissions;
create policy "read own active module permissions"
  on public.user_module_permissions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.memberships m
      where m.establishment_id = user_module_permissions.establishment_id
        and m.user_id = (select auth.uid())
        and m.is_active = true
    )
  );

insert into public.user_module_permissions (
  establishment_id,
  user_id,
  module_key,
  can_access,
  updated_by
)
select
  m.establishment_id,
  m.user_id,
  module.module_key,
  case
    when m.role = 'admin' then true
    when m.role in ('operacao', 'producao') then module.module_key in ('operacao', 'engenharia')
    when m.role = 'estoque' then module.module_key = 'estoque'
    when m.role = 'fiscal' then module.module_key = 'fiscal'
    when m.role = 'entrega' then module.module_key = 'operacao'
    else false
  end as can_access,
  null
from public.memberships m
cross join (
  values
    ('operacao'),
    ('estoque'),
    ('engenharia'),
    ('compras'),
    ('fiscal'),
    ('financeiro'),
    ('administracao')
) as module(module_key)
where m.establishment_id is not null
  and m.is_active = true
  and exists (
    select 1
    from public.establishments e
    where e.id = m.establishment_id
  )
on conflict (establishment_id, user_id, module_key) do nothing;

commit;
