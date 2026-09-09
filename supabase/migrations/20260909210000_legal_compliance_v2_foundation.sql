begin;

-- Legal document registry. The existing v1.3 Terms remain the active login gate;
-- v2 documents are registered independently so rollout can be explicit and reversible.
create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  version_id text not null unique,
  version_label text not null,
  title text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  effective_at timestamptz,
  published_at timestamptz,
  requires_acceptance boolean not null default false,
  requires_reacceptance boolean not null default false,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_legal_document_versions_type_status
  on public.legal_document_versions (document_type, status, effective_at desc nulls last);

-- Generic append-only legal acceptance ledger. Existing user_terms_acceptances is kept
-- intact for backward compatibility while new legal documents use this ledger.
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  establishment_id uuid references public.establishments(id) on delete set null,
  document_type text not null,
  document_version_id text not null references public.legal_document_versions(version_id) on delete restrict,
  accepted_at timestamptz not null default now(),
  accepted_source text not null default 'web',
  accepted_from_path text,
  ip_address inet,
  user_agent text,
  auth_session_id text,
  representative_authority boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_legal_acceptances_user_document_establishment
  on public.legal_acceptances (
    user_id,
    document_version_id,
    coalesce(establishment_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists idx_legal_acceptances_establishment
  on public.legal_acceptances (establishment_id, accepted_at desc);
create index if not exists idx_legal_acceptances_user
  on public.legal_acceptances (user_id, accepted_at desc);

-- Contract/plan entitlements are deliberately separate from the generic plan catalog.
-- A negotiated contract therefore overrides catalog limits without mutating the plan.
create table if not exists public.establishment_entitlements (
  establishment_id uuid primary key references public.establishments(id) on delete cascade,
  billing_policy text not null default 'paid'
    check (billing_policy in ('paid', 'complimentary', 'trial', 'internal', 'custom_contract')),
  automatic_billing_allowed boolean not null default true,
  plan_reference text,
  contract_type text,
  max_establishments integer check (max_establishments is null or max_establishments > 0),
  max_users integer check (max_users is null or max_users > 0),
  max_products integer check (max_products is null or max_products > 0),
  max_orders integer check (max_orders is null or max_orders > 0),
  max_technical_sheets integer check (max_technical_sheets is null or max_technical_sheets > 0),
  modules jsonb not null default '{}'::jsonb,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  source_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > effective_at),
  check (billing_policy <> 'complimentary' or automatic_billing_allowed = false)
);

-- LGPD/data subject request workflow.
create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid references public.establishments(id) on delete set null,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in (
    'access', 'correction', 'deletion', 'anonymization', 'portability',
    'opposition', 'consent_withdrawal', 'information'
  )),
  status text not null default 'received' check (status in (
    'received', 'identity_verification', 'in_review', 'waiting_controller',
    'processing', 'completed', 'rejected_with_basis', 'canceled'
  )),
  subject_name text,
  subject_contact text,
  description text,
  identity_verified_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  resolution_notes text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_data_subject_requests_establishment_status
  on public.data_subject_requests (establishment_id, status, created_at desc);

-- Security incident register. Records are not automatically deleted by this migration.
create table if not exists public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid references public.establishments(id) on delete set null,
  reported_by_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  detected_at timestamptz not null default now(),
  confirmed_at timestamptz,
  contained_at timestamptz,
  closed_at timestamptz,
  severity text not null default 'under_review' check (severity in (
    'under_review', 'low', 'medium', 'high', 'critical'
  )),
  status text not null default 'open' check (status in (
    'open', 'triage', 'contained', 'investigating', 'remediated', 'closed'
  )),
  data_categories text[] not null default '{}',
  estimated_subjects integer check (estimated_subjects is null or estimated_subjects >= 0),
  controller_notified_at timestamptz,
  anpd_notification_required boolean,
  anpd_notified_at timestamptz,
  subjects_notified_at timestamptz,
  root_cause text,
  corrective_actions text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_security_incidents_establishment_status
  on public.security_incidents (establishment_id, status, detected_at desc);

-- Subprocessor/vendor registry for auditability and future public transparency.
create table if not exists public.subprocessors (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  service_category text not null,
  purpose text not null,
  data_categories text[] not null default '{}',
  processing_location text,
  international_transfer boolean not null default false,
  transfer_mechanism text,
  privacy_url text,
  dpa_status text not null default 'review_required' check (dpa_status in (
    'review_required', 'reviewed', 'signed', 'not_applicable'
  )),
  security_reviewed_at timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive', 'planned')),
  effective_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, service_category)
);

-- Operational retention matrix. Automation starts disabled on purpose; no data is
-- destroyed until each category has a proven technical process and legal review.
create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  rule_text text not null,
  retention_days integer check (retention_days is null or retention_days >= 0),
  terminal_action text not null default 'review' check (terminal_action in (
    'review', 'delete', 'anonymize', 'archive_restricted'
  )),
  legal_basis text,
  automation_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tenant offboarding state machine. Destructive execution is intentionally separated
-- from initiation so an admin cannot accidentally delete a tenant in one click.
create table if not exists public.tenant_offboarding (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete restrict,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'requested' check (status in (
    'requested', 'read_only', 'export_window', 'retention',
    'deletion_scheduled', 'completed', 'canceled'
  )),
  reason text,
  requested_at timestamptz not null default now(),
  read_only_at timestamptz,
  export_deadline_at timestamptz,
  retention_started_at timestamptz,
  deletion_scheduled_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_tenant_offboarding_open
  on public.tenant_offboarding (establishment_id)
  where status not in ('completed', 'canceled');

create table if not exists public.tenant_offboarding_events (
  id uuid primary key default gen_random_uuid(),
  offboarding_id uuid not null references public.tenant_offboarding(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  from_status text,
  to_status text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_tenant_offboarding_events_offboarding
  on public.tenant_offboarding_events (offboarding_id, created_at desc);

-- Harden direct database access. Application mutations go through authenticated server
-- routes/actions using the service role after tenant/admin authorization.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'legal_document_versions',
    'legal_acceptances',
    'establishment_entitlements',
    'data_subject_requests',
    'security_incidents',
    'subprocessors',
    'data_retention_policies',
    'tenant_offboarding',
    'tenant_offboarding_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('revoke all on table public.%I from service_role', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end $$;

-- Register currently active Terms v1.3 and v2 rollout candidates.
insert into public.legal_document_versions (
  document_type, version_id, version_label, title, slug, status,
  effective_at, published_at, requires_acceptance, requires_reacceptance, metadata
) values
  ('terms', 'saas-v1.3-2026-04-23', 'v1.3', 'Termos do Serviço', '/termos-de-uso', 'published',
   '2026-04-23 00:00:00+00', '2026-04-23 00:00:00+00', true, true,
   '{"current_login_gate":true}'::jsonb),
  ('terms', 'saas-v2.0-2026-09-09', 'v2.0', 'Termos do Serviço', '/termos-de-uso', 'draft',
   null, null, true, true, '{"rollout":"pending_legal_review"}'::jsonb),
  ('privacy', 'privacy-v2.0-2026-09-09', 'v2.0', 'Política de Privacidade', '/politica-de-privacidade', 'draft',
   null, null, false, false, '{"rollout":"pending_legal_review"}'::jsonb),
  ('cookies', 'cookies-v2.0-2026-09-09', 'v2.0', 'Política de Cookies', '/politica-de-cookies', 'draft',
   null, null, false, false, '{"rollout":"pending_legal_review"}'::jsonb),
  ('governance', 'governance-v2.0-2026-09-09', 'v2.0', 'Política de Governança e Proteção de Dados', '/governanca-e-protecao-de-dados', 'draft',
   null, null, false, false, '{"rollout":"pending_legal_review"}'::jsonb),
  ('accessibility', 'accessibility-v2.0-2026-09-09', 'v2.0', 'Política de Acessibilidade', '/acessibilidade', 'draft',
   null, null, false, false, '{"rollout":"pending_legal_review"}'::jsonb),
  ('dpa', 'dpa-v2.0-2026-09-09', 'v2.0', 'Acordo de Tratamento de Dados Pessoais (DPA)', '/dpa', 'published',
   '2026-09-09 00:00:00+00', '2026-09-09 00:00:00+00', true, false,
   '{"scope":"b2b_admin_acceptance","global_gate":false}'::jsonb),
  ('security', 'security-v2.0-2026-09-09', 'v2.0', 'Política de Segurança da Informação', '/seguranca-da-informacao', 'published',
   '2026-09-09 00:00:00+00', '2026-09-09 00:00:00+00', false, false,
   '{"scope":"public_security_summary"}'::jsonb)
on conflict (version_id) do update set
  title = excluded.title,
  slug = excluded.slug,
  metadata = public.legal_document_versions.metadata || excluded.metadata,
  updated_at = now();

-- Backfill old Terms acceptances into the generic ledger without changing the old ledger.
insert into public.legal_acceptances (
  user_id,
  establishment_id,
  document_type,
  document_version_id,
  accepted_at,
  accepted_source,
  accepted_from_path,
  ip_address,
  user_agent,
  auth_session_id,
  representative_authority,
  metadata
)
select
  uta.user_id,
  uta.establishment_id,
  'terms',
  uta.terms_version_id,
  uta.accepted_at,
  coalesce(uta.accepted_source, 'legacy_terms_ledger'),
  uta.accepted_from_path,
  uta.ip_address,
  uta.user_agent,
  uta.auth_session_id,
  false,
  jsonb_build_object('migrated_from', 'user_terms_acceptances', 'legacy_id', uta.id)
from public.user_terms_acceptances uta
where uta.terms_version_id = 'saas-v1.3-2026-04-23'
on conflict do nothing;

-- Santino special contract: contractual entitlement overrides generic Growth limits.
insert into public.establishment_entitlements (
  establishment_id,
  billing_policy,
  automatic_billing_allowed,
  plan_reference,
  contract_type,
  max_establishments,
  max_users,
  max_products,
  max_technical_sheets,
  modules,
  effective_at,
  source_ref,
  notes
)
select
  e.id,
  'complimentary',
  false,
  'growth',
  'special_free_license',
  1,
  20,
  5000,
  1000,
  '{"estoque":true,"engenharia":true}'::jsonb,
  '2026-09-09 00:00:00+00',
  'Contrato Gestify x Santino - Licença Gratuita Especial v1.0 - 2026-09-09',
  'Valor devido R$ 0,00; sem cobrança automática; limites contratuais prevalecem sobre o catálogo genérico.'
from public.establishments e
where e.id = 'fde0f0be-7a6d-4648-bd25-fb964022565d'::uuid
on conflict (establishment_id) do update set
  billing_policy = excluded.billing_policy,
  automatic_billing_allowed = excluded.automatic_billing_allowed,
  plan_reference = excluded.plan_reference,
  contract_type = excluded.contract_type,
  max_establishments = excluded.max_establishments,
  max_users = excluded.max_users,
  max_products = excluded.max_products,
  max_technical_sheets = excluded.max_technical_sheets,
  modules = excluded.modules,
  effective_at = excluded.effective_at,
  source_ref = excluded.source_ref,
  notes = excluded.notes,
  updated_at = now();

-- Initial subprocessor inventory. These rows are an audit inventory, not a promise that
-- every optional integration is active for every tenant.
insert into public.subprocessors (
  provider, service_category, purpose, data_categories, processing_location,
  international_transfer, transfer_mechanism, dpa_status, status, metadata
) values
  ('Supabase', 'database_auth_storage', 'Banco de dados, autenticação e recursos de infraestrutura da plataforma.', array['account','authentication','operational'], 'Infraestrutura contratada conforme projeto', true, 'LGPD/ANPD mechanism review required per flow', 'review_required', 'active', '{"required":true}'::jsonb),
  ('Vercel', 'application_hosting', 'Hospedagem e execução da aplicação web.', array['technical','request_metadata'], 'Infraestrutura global do provedor', true, 'LGPD/ANPD mechanism review required per flow', 'review_required', 'active', '{"required":true}'::jsonb),
  ('GitHub', 'source_ci', 'Versionamento de código e automações de CI/CD; dados de produção não devem ser armazenados no repositório.', array['technical'], 'Infraestrutura global do provedor', true, 'LGPD/ANPD mechanism review required per flow', 'review_required', 'active', '{"production_data_expected":false}'::jsonb),
  ('Resend', 'transactional_email', 'Envio de comunicações transacionais quando configurado.', array['name','email','message_metadata'], 'Infraestrutura do provedor', true, 'LGPD/ANPD mechanism review required per flow', 'review_required', 'active', '{}'::jsonb),
  ('Cloudflare R2', 'disaster_recovery_storage', 'Destino S3 compatível para backup off-site quando o fluxo de DR estiver habilitado.', array['encrypted_backup'], 'Infraestrutura do provedor', true, 'LGPD/ANPD mechanism review required per flow', 'review_required', 'planned', '{"encrypted_before_upload":true}'::jsonb),
  ('Google', 'support_embedded_services', 'Suporte por e-mail e serviços incorporados opcionais, conforme uso.', array['contact','support','optional_embedded_service'], 'Infraestrutura global do provedor', true, 'LGPD/ANPD mechanism review required per flow', 'review_required', 'active', '{}'::jsonb)
on conflict (provider, service_category) do update set
  purpose = excluded.purpose,
  data_categories = excluded.data_categories,
  processing_location = excluded.processing_location,
  international_transfer = excluded.international_transfer,
  transfer_mechanism = excluded.transfer_mechanism,
  status = excluded.status,
  metadata = public.subprocessors.metadata || excluded.metadata,
  updated_at = now();

insert into public.data_retention_policies (
  category, rule_text, retention_days, terminal_action, legal_basis, automation_enabled, metadata
) values
  ('account_authentication', 'Durante a relação e pelo período necessário para segurança, auditoria e defesa de direitos.', null, 'review', 'Execução contratual, segurança e exercício regular de direitos.', false, '{}'::jsonb),
  ('security_access_logs', 'Manter pelo período necessário para investigação, auditoria, prevenção a fraude e estabilidade, com minimização.', null, 'review', 'Segurança, prevenção a fraude e exercício regular de direitos.', false, '{}'::jsonb),
  ('legal_acceptances', 'Manter enquanto necessário para prova contratual, obrigação legal e defesa de direitos.', null, 'archive_restricted', 'Prova contratual e exercício regular de direitos.', false, '{}'::jsonb),
  ('customer_operational_data', 'Manter durante a prestação do serviço e janela técnica de exportação, backup e eliminação aplicável.', null, 'review', 'Execução contratual e instruções do Controlador.', false, '{"export_window_days":30}'::jsonb),
  ('backups', 'Seguir ciclo técnico limitado; quando eliminação imediata não for possível, manter protegido e fora do uso operacional até expiração.', null, 'review', 'Continuidade, segurança e defesa de direitos.', false, '{}'::jsonb),
  ('billing_fiscal_financial', 'Manter conforme obrigações fiscais, contábeis, regulatórias e exercício de direitos.', null, 'archive_restricted', 'Obrigação legal/regulatória e exercício regular de direitos.', false, '{}'::jsonb),
  ('data_subject_requests', 'Manter pelo período necessário para comprovar atendimento e exercer direitos.', null, 'archive_restricted', 'Cumprimento da LGPD e exercício regular de direitos.', false, '{}'::jsonb),
  ('security_incidents', 'Manter registro de incidente envolvendo dados pessoais por no mínimo 5 anos, sem prejuízo de prazo superior aplicável.', 1825, 'archive_restricted', 'Regulamentação ANPD aplicável e prestação de contas.', false, '{"minimum_days":1825}'::jsonb)
on conflict (category) do update set
  rule_text = excluded.rule_text,
  retention_days = excluded.retention_days,
  terminal_action = excluded.terminal_action,
  legal_basis = excluded.legal_basis,
  metadata = public.data_retention_policies.metadata || excluded.metadata,
  updated_at = now();

comment on table public.legal_acceptances is 'Ledger genérico append-only de aceites jurídicos; user_terms_acceptances permanece para compatibilidade do gate atual.';
comment on table public.establishment_entitlements is 'Condições contratuais específicas por tenant que prevalecem sobre limites genéricos do catálogo de planos.';
comment on table public.tenant_offboarding is 'Estado controlado de encerramento de tenant; não executa exclusão destrutiva automaticamente.';

commit;
