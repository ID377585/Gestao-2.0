begin;

alter table public.user_module_permissions
  drop constraint if exists user_module_permissions_module_key_check;

alter table public.user_module_permissions
  add constraint user_module_permissions_module_key_check
  check (
    module_key in (
      'operacao',
      'estoque',
      'engenharia',
      'nutricao',
      'compras',
      'fiscal',
      'financeiro',
      'rh',
      'administracao'
    )
  );

with active_memberships as (
  select
    m.establishment_id,
    m.user_id,
    m.role::text as role
  from public.memberships m
  where m.establishment_id is not null
    and coalesce(m.is_active, true) = true

  union

  select
    em.establishment_id,
    em.user_id,
    em.role::text as role
  from public.establishment_memberships em
  where em.establishment_id is not null
    and coalesce(em.is_active, true) = true
)
insert into public.user_module_permissions (
  establishment_id,
  user_id,
  module_key,
  can_access,
  updated_at
)
select
  active_memberships.establishment_id,
  active_memberships.user_id,
  'nutricao',
  active_memberships.role = 'admin',
  now()
from active_memberships
on conflict (establishment_id, user_id, module_key) do nothing;

notify pgrst, 'reload schema';

commit;
