-- Register Gestify Terms of Service v2.1 as the current published login gate.
-- Existing v1.3 acceptances remain immutable evidence; users must accept v2.1.

begin;

update public.legal_document_versions
set
  status = 'superseded',
  effective_to = '2026-09-10 13:50:00+00',
  is_current = false,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"superseded_by":"saas-v2.1-2026-09-10"}'::jsonb
where document_type = 'terms'
  and is_current = true;

insert into public.legal_document_versions (
  document_type,
  version_id,
  version_label,
  title,
  public_path,
  status,
  published_at,
  effective_from,
  requires_acceptance,
  is_current,
  metadata
) values (
  'terms',
  'saas-v2.1-2026-09-10',
  'v2.1',
  'Termos do Serviço',
  '/termos-de-uso',
  'published',
  '2026-09-10 13:50:00+00',
  '2026-09-10 13:50:00+00',
  true,
  true,
  '{"current_login_gate":true,"rollout":"published_2026-09-10","legal_review":"recommended_post_publication_validation"}'::jsonb
)
on conflict (version_id) do update set
  version_label = excluded.version_label,
  title = excluded.title,
  public_path = excluded.public_path,
  status = excluded.status,
  published_at = excluded.published_at,
  effective_from = excluded.effective_from,
  requires_acceptance = excluded.requires_acceptance,
  is_current = excluded.is_current,
  metadata = excluded.metadata;

commit;
