begin;
update public.legal_document_versions
set status='retired',
    metadata=coalesce(metadata,'{}'::jsonb)||'{"superseded_by":"saas-v2.1-2026-09-10"}'::jsonb,
    updated_at=now()
where document_type='terms'
  and status='published'
  and version_id<>'saas-v2.1-2026-09-10';

insert into public.legal_document_versions (
  document_type,version_id,version_label,title,slug,status,effective_at,published_at,
  requires_acceptance,requires_reacceptance,metadata
) values (
  'terms','saas-v2.1-2026-09-10','v2.1','Termos do Serviço','termos-de-uso','published',
  '2026-09-10 13:50:00+00','2026-09-10 13:50:00+00',true,true,
  '{"current_login_gate":true,"rollout":"published_2026-09-10","legal_review":"recommended_post_publication_validation"}'::jsonb
)
on conflict (version_id) do update set
  version_label=excluded.version_label,
  title=excluded.title,
  slug=excluded.slug,
  status=excluded.status,
  effective_at=excluded.effective_at,
  published_at=excluded.published_at,
  requires_acceptance=excluded.requires_acceptance,
  requires_reacceptance=excluded.requires_reacceptance,
  metadata=excluded.metadata,
  updated_at=now();
commit;
