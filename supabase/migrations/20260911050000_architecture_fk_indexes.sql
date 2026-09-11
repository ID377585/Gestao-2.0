-- Architecture closure: forward-only FK index reconciliation.
-- Safe on environments where any index already exists.

create index if not exists idx_data_subject_requests_assigned_to
  on public.data_subject_requests (assigned_to);
create index if not exists idx_data_subject_requests_requested_by
  on public.data_subject_requests (requested_by_user_id);
create index if not exists idx_legal_acceptances_document_version
  on public.legal_acceptances (document_version_id);
create index if not exists idx_security_incidents_reported_by
  on public.security_incidents (reported_by_user_id);
create index if not exists idx_tenant_offboarding_requested_by
  on public.tenant_offboarding (requested_by_user_id);
create index if not exists idx_tenant_offboarding_events_actor
  on public.tenant_offboarding_events (actor_user_id);
create index if not exists idx_tenant_offboarding_events_establishment
  on public.tenant_offboarding_events (establishment_id);
