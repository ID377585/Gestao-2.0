begin;

-- Evidentiary ledgers are append-only. The service role may read and append,
-- but must not rewrite or delete historical legal/offboarding evidence.
revoke update, delete on table public.legal_acceptances from service_role;
revoke update, delete on table public.tenant_offboarding_events from service_role;

grant select, insert on table public.legal_acceptances to service_role;
grant select, insert on table public.tenant_offboarding_events to service_role;

-- No direct client access. Keep explicit restrictive policies as defense in depth.
drop policy if exists legal_acceptances_no_direct_access on public.legal_acceptances;
create policy legal_acceptances_no_direct_access
  on public.legal_acceptances
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists tenant_offboarding_events_no_direct_access on public.tenant_offboarding_events;
create policy tenant_offboarding_events_no_direct_access
  on public.tenant_offboarding_events
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table public.legal_acceptances force row level security;
alter table public.tenant_offboarding_events force row level security;

-- Keep the legacy Terms ledger as the compatibility gate, while every new Terms
-- acceptance is mirrored to the generic legal ledger. This allows a gradual migration
-- without changing the current login flow or losing evidentiary history.
create or replace function public.gestify_mirror_terms_acceptance_to_legal_ledger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
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
  ) values (
    new.user_id,
    new.establishment_id,
    'terms',
    new.terms_version_id,
    new.accepted_at,
    new.accepted_source,
    new.accepted_from_path,
    new.ip_address,
    new.user_agent,
    new.auth_session_id,
    false,
    jsonb_build_object('mirrored_from', 'user_terms_acceptances', 'legacy_id', new.id)
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.gestify_mirror_terms_acceptance_to_legal_ledger() from public;
revoke all on function public.gestify_mirror_terms_acceptance_to_legal_ledger() from anon, authenticated;
grant execute on function public.gestify_mirror_terms_acceptance_to_legal_ledger() to service_role;

drop trigger if exists trg_mirror_terms_acceptance_to_legal_ledger
  on public.user_terms_acceptances;
create trigger trg_mirror_terms_acceptance_to_legal_ledger
after insert on public.user_terms_acceptances
for each row
execute function public.gestify_mirror_terms_acceptance_to_legal_ledger();

comment on table public.legal_acceptances is
  'Append-only server-side ledger for versioned legal document acceptances.';
comment on table public.tenant_offboarding_events is
  'Append-only audit trail for tenant offboarding state transitions.';
comment on function public.gestify_mirror_terms_acceptance_to_legal_ledger() is
  'Mirrors legacy Terms acceptances into the generic append-only legal ledger during gradual migration.';

commit;
