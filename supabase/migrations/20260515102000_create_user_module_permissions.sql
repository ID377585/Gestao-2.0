-- Cria controle granular de acesso por modulo/sessao do sistema.
-- Mantem o papel principal em memberships/establishment_memberships,
-- mas permite liberar ou bloquear areas adicionais por usuario e estabelecimento.

begin;

create table if not exists public.user_module_permissions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null,
  can_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint user_module_permissions_module_key_check check (
    module_key in (
      'operacao',
      'estoque',
      'engenharia',
      'compras',
      'fiscal',
      'financeiro',
      'administracao'
    )
  ),
  constraint user_module_permissions_unique unique (establishment_id, user_id, module_key)
);

create index if not exists user_module_permissions_user_establishment_idx
  on public.user_module_permissions(user_id, establishment_id);

create index if not exists user_module_permissions_establishment_module_idx
  on public.user_module_permissions(establishment_id, module_key, can_access);

-- Popula permissoes iniciais para usuarios existentes com base no papel atual.
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
    when m.role = 'operacao' then module.module_key in ('operacao', 'engenharia')
    when m.role = 'producao' then module.module_key in ('operacao', 'engenharia')
    when m.role = 'estoque' then module.module_key in ('estoque')
    when m.role = 'fiscal' then module.module_key in ('fiscal')
    when m.role = 'entrega' then module.module_key in ('operacao')
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
on conflict (establishment_id, user_id, module_key) do nothing;

commit;
