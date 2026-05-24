-- Cria convites multiempresa para vincular usuarios a estabelecimentos.
-- O token puro nunca e salvo: apenas o hash SHA-256 fica no banco.

begin;

create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  email text not null,
  role text not null,
  sector text null,
  token_hash text not null,
  status text not null default 'pending',
  invited_by uuid null references auth.users(id) on delete set null,
  accepted_by uuid null references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_invitations_email_check check (position('@' in email) > 1),
  constraint tenant_invitations_role_check check (
    role in ('admin', 'operacao', 'producao', 'estoque', 'fiscal', 'entrega')
  ),
  constraint tenant_invitations_status_check check (
    status in ('pending', 'accepted', 'canceled', 'expired')
  ),
  constraint tenant_invitations_token_hash_unique unique (token_hash)
);

create index if not exists tenant_invitations_establishment_status_idx
  on public.tenant_invitations(establishment_id, status, created_at desc);

create index if not exists tenant_invitations_email_status_idx
  on public.tenant_invitations(email, status);

create index if not exists tenant_invitations_expires_at_idx
  on public.tenant_invitations(expires_at);

create unique index if not exists tenant_invitations_pending_email_establishment_unique
  on public.tenant_invitations(establishment_id, lower(email))
  where status = 'pending';

alter table public.tenant_invitations enable row level security;
alter table public.tenant_invitations force row level security;

revoke all on table public.tenant_invitations from anon;
revoke all on table public.tenant_invitations from authenticated;

drop policy if exists tenant_invitations_select_admin_operacao on public.tenant_invitations;
drop policy if exists tenant_invitations_insert_admin_operacao on public.tenant_invitations;
drop policy if exists tenant_invitations_update_admin_operacao on public.tenant_invitations;
drop policy if exists tenant_invitations_delete_admin on public.tenant_invitations;

create policy tenant_invitations_select_admin_operacao
  on public.tenant_invitations
  for select
  to authenticated
  using (
    public.gestify_has_establishment_role(
      establishment_id,
      array['admin', 'operacao']
    )
  );

create policy tenant_invitations_insert_admin_operacao
  on public.tenant_invitations
  for insert
  to authenticated
  with check (
    public.gestify_has_establishment_role(
      establishment_id,
      array['admin', 'operacao']
    )
  );

create policy tenant_invitations_update_admin_operacao
  on public.tenant_invitations
  for update
  to authenticated
  using (
    public.gestify_has_establishment_role(
      establishment_id,
      array['admin', 'operacao']
    )
  )
  with check (
    public.gestify_has_establishment_role(
      establishment_id,
      array['admin', 'operacao']
    )
  );

create policy tenant_invitations_delete_admin
  on public.tenant_invitations
  for delete
  to authenticated
  using (
    public.gestify_has_establishment_role(
      establishment_id,
      array['admin']
    )
  );

-- Service role continua podendo operar a tabela em fluxos internos de convite.
-- Authenticated recebe permissoes SQL, mas RLS limita leitura/escrita por papel e empresa.
grant select, insert, update, delete on table public.tenant_invitations to authenticated;

commit;
