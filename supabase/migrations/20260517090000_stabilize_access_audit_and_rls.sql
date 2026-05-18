-- Stabilizes access permissions, administrative audit logs and RLS policies.
-- This migration is intentionally idempotent to be safe in production.

begin;

create extension if not exists pgcrypto;

create table if not exists public.user_access_audit_logs (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  target_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_access_audit_logs_action_check check (
    action in (
      'create_user',
      'update_user',
      'reset_password',
      'deactivate_user',
      'reactivate_user',
      'delete_user'
    )
  )
);

create index if not exists user_access_audit_logs_establishment_created_idx
  on public.user_access_audit_logs(establishment_id, created_at desc);

create index if not exists user_access_audit_logs_actor_idx
  on public.user_access_audit_logs(actor_user_id);

create index if not exists user_access_audit_logs_target_idx
  on public.user_access_audit_logs(target_user_id);

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_module_permissions_updated_at on public.user_module_permissions;
create trigger set_user_module_permissions_updated_at
before update on public.user_module_permissions
for each row
execute function public.set_updated_at();

create or replace function public.current_user_can_manage_establishment(target_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = target_establishment_id
      and em.user_id = auth.uid()
      and em.is_active = true
      and em.role in ('admin', 'operacao')
  );
$$;

alter table public.user_module_permissions enable row level security;
alter table public.user_access_audit_logs enable row level security;

drop policy if exists "manage module permissions by establishment admins" on public.user_module_permissions;
create policy "manage module permissions by establishment admins"
  on public.user_module_permissions
  for all
  using (public.current_user_can_manage_establishment(establishment_id))
  with check (public.current_user_can_manage_establishment(establishment_id));

drop policy if exists "read audit logs by establishment admins" on public.user_access_audit_logs;
create policy "read audit logs by establishment admins"
  on public.user_access_audit_logs
  for select
  using (public.current_user_can_manage_establishment(establishment_id));

drop policy if exists "insert audit logs by establishment admins" on public.user_access_audit_logs;
create policy "insert audit logs by establishment admins"
  on public.user_access_audit_logs
  for insert
  with check (public.current_user_can_manage_establishment(establishment_id));

insert into public.user_module_permissions (
  establishment_id,
  user_id,
  module_key,
  can_access,
  updated_by
)
select
  em.establishment_id,
  em.user_id,
  module.module_key,
  case
    when em.role = 'admin' then true
    when em.role in ('operacao', 'producao') then module.module_key in ('operacao', 'engenharia')
    when em.role = 'estoque' then module.module_key = 'estoque'
    when em.role = 'fiscal' then module.module_key = 'fiscal'
    when em.role = 'entrega' then module.module_key = 'operacao'
    else false
  end as can_access,
  null
from public.establishment_memberships em
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
where em.establishment_id is not null
on conflict (establishment_id, user_id, module_key) do nothing;

commit;
