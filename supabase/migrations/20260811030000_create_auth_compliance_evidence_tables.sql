begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create extension if not exists pgcrypto;
create schema if not exists private;

-- These audit tables intentionally do not reference auth.users or establishments.
-- Immutable evidence must survive account/tenant deletion without ON DELETE
-- actions rewriting history or preventing the operational deletion itself.
create table if not exists public.user_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  establishment_id uuid null,
  terms_version_id text not null,
  document_slug text not null,
  document_title text not null,
  accepted_at timestamptz not null default pg_catalog.now(),
  accepted_from_path text null,
  accepted_source text not null,
  ip_address inet null,
  user_agent text null,
  auth_session_id uuid null,
  evidence_origin text not null default 'direct',
  created_at timestamptz not null default pg_catalog.now(),
  constraint user_terms_acceptances_user_terms_version_key
    unique (user_id, terms_version_id),
  constraint user_terms_acceptances_evidence_origin_check
    check (evidence_origin in ('direct', 'metadata_backfill')),
  constraint user_terms_acceptances_version_not_blank_check
    check (pg_catalog.btrim(terms_version_id) <> ''),
  constraint user_terms_acceptances_source_not_blank_check
    check (pg_catalog.btrim(accepted_source) <> '')
);

create table if not exists public.user_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  establishment_id uuid null,
  path text null,
  ip_address inet null,
  user_agent text null,
  auth_session_id uuid null,
  event_type text not null default 'authenticated_access',
  created_at timestamptz not null default pg_catalog.now(),
  constraint user_access_logs_event_type_not_blank_check
    check (pg_catalog.btrim(event_type) <> '')
);

create index if not exists user_terms_acceptances_user_time_idx
  on public.user_terms_acceptances (user_id, accepted_at desc);

create index if not exists user_terms_acceptances_establishment_time_idx
  on public.user_terms_acceptances (establishment_id, accepted_at desc)
  where establishment_id is not null;

create index if not exists user_terms_acceptances_session_idx
  on public.user_terms_acceptances (auth_session_id)
  where auth_session_id is not null;

create index if not exists user_access_logs_user_time_idx
  on public.user_access_logs (user_id, created_at desc);

create index if not exists user_access_logs_establishment_time_idx
  on public.user_access_logs (establishment_id, created_at desc)
  where establishment_id is not null;

create index if not exists user_access_logs_session_time_idx
  on public.user_access_logs (auth_session_id, created_at desc)
  where auth_session_id is not null;

alter table public.user_terms_acceptances enable row level security;
alter table public.user_terms_acceptances force row level security;
alter table public.user_access_logs enable row level security;
alter table public.user_access_logs force row level security;

-- No client policy is created. Authenticated users cannot read or append these
-- records directly; the authorized server persists them through service_role.
revoke all on table public.user_terms_acceptances
  from public, anon, authenticated;
revoke all on table public.user_access_logs
  from public, anon, authenticated;

revoke update, delete, truncate, references, trigger
  on table public.user_terms_acceptances from service_role;
revoke update, delete, truncate, references, trigger
  on table public.user_access_logs from service_role;

grant select, insert on table public.user_terms_acceptances to service_role;
grant select, insert on table public.user_access_logs to service_role;

drop trigger if exists gestify_prevent_audit_mutation
  on public.user_terms_acceptances;
create trigger gestify_prevent_audit_mutation
before update or delete on public.user_terms_acceptances
for each row execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_truncate
  on public.user_terms_acceptances;
create trigger gestify_prevent_audit_truncate
before truncate on public.user_terms_acceptances
for each statement execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_mutation
  on public.user_access_logs;
create trigger gestify_prevent_audit_mutation
before update or delete on public.user_access_logs
for each row execute function private.gestify_reject_audit_mutation();

drop trigger if exists gestify_prevent_audit_truncate
  on public.user_access_logs;
create trigger gestify_prevent_audit_truncate
before truncate on public.user_access_logs
for each statement execute function private.gestify_reject_audit_mutation();

comment on table public.user_terms_acceptances is
  'Append-only server-side evidence of terms acceptance. Historical metadata backfills are explicitly labelled and contain no reconstructed IP, user-agent or session values.';
comment on column public.user_terms_acceptances.user_id is
  'Auth user UUID captured as evidence, intentionally without a foreign key so account deletion cannot mutate history.';
comment on column public.user_terms_acceptances.establishment_id is
  'Tenant UUID captured at acceptance time, intentionally without a foreign key so tenant deletion cannot mutate history.';
comment on column public.user_terms_acceptances.evidence_origin is
  'direct for contemporaneous server evidence; metadata_backfill for evidence reconstructed from legacy Auth metadata.';
comment on table public.user_access_logs is
  'Append-only server-side authenticated access telemetry, denied to browser roles.';
comment on column public.user_access_logs.user_id is
  'Auth user UUID captured as telemetry, intentionally without a foreign key so account deletion cannot mutate history.';
comment on column public.user_access_logs.establishment_id is
  'Tenant UUID captured at access time, intentionally without a foreign key so tenant deletion cannot mutate history.';

-- The legacy application stored current terms acceptance only in Auth metadata.
-- Reconstruct one clearly-labelled row per user/version. This does not invent
-- contemporaneous IP, user-agent or session evidence.
with metadata_acceptances as (
  select
    u.id as user_id,
    u.raw_app_meta_data -> 'gestify_compliance' as compliance
  from auth.users u
  where pg_catalog.jsonb_typeof(
    u.raw_app_meta_data -> 'gestify_compliance'
  ) = 'object'
), valid_acceptances as (
  select
    m.user_id,
    m.compliance ->> 'current_terms_version' as terms_version_id,
    coalesce(
      nullif(m.compliance ->> 'current_terms_slug', ''),
      '/termos-de-uso'
    ) as document_slug,
    coalesce(
      nullif(m.compliance ->> 'current_terms_title', ''),
      'Termos do Serviço'
    ) as document_title,
    (m.compliance ->> 'current_terms_accepted_at')::timestamptz as accepted_at,
    nullif(m.compliance ->> 'last_access_path', '') as accepted_from_path
  from metadata_acceptances m
  where nullif(m.compliance ->> 'current_terms_version', '') is not null
    and nullif(m.compliance ->> 'current_terms_accepted_at', '') is not null
    and pg_catalog.pg_input_is_valid(
      m.compliance ->> 'current_terms_accepted_at',
      'timestamp with time zone'
    )
)
insert into public.user_terms_acceptances (
  user_id,
  establishment_id,
  terms_version_id,
  document_slug,
  document_title,
  accepted_at,
  accepted_from_path,
  accepted_source,
  ip_address,
  user_agent,
  auth_session_id,
  evidence_origin
)
select
  acceptance.user_id,
  membership.establishment_id,
  acceptance.terms_version_id,
  acceptance.document_slug,
  acceptance.document_title,
  acceptance.accepted_at,
  acceptance.accepted_from_path,
  'metadata_backfill',
  null,
  null,
  null,
  'metadata_backfill'
from valid_acceptances acceptance
left join lateral (
  select m.establishment_id
  from public.memberships m
  where m.user_id = acceptance.user_id
    and m.is_active = true
  order by m.created_at desc nulls last, m.id desc
  limit 1
) membership on true
on conflict (user_id, terms_version_id) do nothing;

create or replace function public.gestify_auth_compliance_audit()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, information_schema, public, pg_temp
as $function$
declare
  v_missing_tables jsonb;
  v_tables_without_rls jsonb;
  v_tables_without_forced_rls jsonb;
  v_unexpected_policies jsonb;
  v_client_grants jsonb;
  v_mutable_service_role_grants jsonb;
  v_missing_service_role_grants jsonb;
  v_missing_row_guards jsonb;
  v_missing_truncate_guards jsonb;
  v_missing_unique_constraints jsonb;
  v_metadata_backfill_rows bigint;
  v_direct_evidence_rows bigint;
begin
  with required_tables(table_name) as (
    values ('user_terms_acceptances'), ('user_access_logs')
  )
  select coalesce(jsonb_agg(r.table_name order by r.table_name), '[]'::jsonb)
    into v_missing_tables
  from required_tables r
  where pg_catalog.to_regclass(
    pg_catalog.format('public.%I', r.table_name)
  ) is null;

  select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    into v_tables_without_rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('user_terms_acceptances', 'user_access_logs')
    and c.relrowsecurity = false;

  select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    into v_tables_without_forced_rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('user_terms_acceptances', 'user_access_logs')
    and c.relforcerowsecurity = false;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', p.tablename,
        'policy', p.policyname,
        'command', p.cmd,
        'roles', p.roles
      )
      order by p.tablename, p.policyname
    ),
    '[]'::jsonb
  )
    into v_unexpected_policies
  from pg_catalog.pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('user_terms_acceptances', 'user_access_logs');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', g.table_name,
        'grantee', g.grantee,
        'privilege', g.privilege_type
      )
      order by g.table_name, g.grantee, g.privilege_type
    ),
    '[]'::jsonb
  )
    into v_client_grants
  from information_schema.table_privileges g
  where g.table_schema = 'public'
    and g.table_name in ('user_terms_acceptances', 'user_access_logs')
    and g.grantee in ('anon', 'authenticated', 'PUBLIC');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', g.table_name,
        'privilege', g.privilege_type
      )
      order by g.table_name, g.privilege_type
    ),
    '[]'::jsonb
  )
    into v_mutable_service_role_grants
  from information_schema.table_privileges g
  where g.table_schema = 'public'
    and g.table_name in ('user_terms_acceptances', 'user_access_logs')
    and g.grantee = 'service_role'
    and g.privilege_type in (
      'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    );

  with required_grants(table_name, privilege_type) as (
    values
      ('user_terms_acceptances', 'SELECT'),
      ('user_terms_acceptances', 'INSERT'),
      ('user_access_logs', 'SELECT'),
      ('user_access_logs', 'INSERT')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', r.table_name,
        'privilege', r.privilege_type
      )
      order by r.table_name, r.privilege_type
    ),
    '[]'::jsonb
  )
    into v_missing_service_role_grants
  from required_grants r
  where not exists (
    select 1
    from information_schema.table_privileges g
    where g.table_schema = 'public'
      and g.table_name = r.table_name
      and g.grantee = 'service_role'
      and g.privilege_type = r.privilege_type
  );

  with audit_tables(table_name) as (
    values ('user_terms_acceptances'), ('user_access_logs')
  )
  select coalesce(jsonb_agg(a.table_name order by a.table_name), '[]'::jsonb)
    into v_missing_row_guards
  from audit_tables a
  where not exists (
    select 1
    from pg_catalog.pg_trigger tg
    where tg.tgrelid = pg_catalog.to_regclass(
      pg_catalog.format('public.%I', a.table_name)
    )
      and tg.tgname = 'gestify_prevent_audit_mutation'
      and not tg.tgisinternal
  );

  with audit_tables(table_name) as (
    values ('user_terms_acceptances'), ('user_access_logs')
  )
  select coalesce(jsonb_agg(a.table_name order by a.table_name), '[]'::jsonb)
    into v_missing_truncate_guards
  from audit_tables a
  where not exists (
    select 1
    from pg_catalog.pg_trigger tg
    where tg.tgrelid = pg_catalog.to_regclass(
      pg_catalog.format('public.%I', a.table_name)
    )
      and tg.tgname = 'gestify_prevent_audit_truncate'
      and not tg.tgisinternal
  );

  select case
    when exists (
      select 1
      from pg_catalog.pg_constraint con
      where con.conrelid = pg_catalog.to_regclass(
        'public.user_terms_acceptances'
      )
        and con.contype = 'u'
        and con.conname = 'user_terms_acceptances_user_terms_version_key'
    ) then '[]'::jsonb
    else jsonb_build_array(
      'user_terms_acceptances(user_id,terms_version_id)'
    )
  end
    into v_missing_unique_constraints;

  select count(*)
    into v_metadata_backfill_rows
  from public.user_terms_acceptances
  where evidence_origin = 'metadata_backfill';

  select count(*)
    into v_direct_evidence_rows
  from public.user_terms_acceptances
  where evidence_origin = 'direct';

  return jsonb_build_object(
    'ok',
      jsonb_array_length(v_missing_tables) = 0
      and jsonb_array_length(v_tables_without_rls) = 0
      and jsonb_array_length(v_tables_without_forced_rls) = 0
      and jsonb_array_length(v_unexpected_policies) = 0
      and jsonb_array_length(v_client_grants) = 0
      and jsonb_array_length(v_mutable_service_role_grants) = 0
      and jsonb_array_length(v_missing_service_role_grants) = 0
      and jsonb_array_length(v_missing_row_guards) = 0
      and jsonb_array_length(v_missing_truncate_guards) = 0
      and jsonb_array_length(v_missing_unique_constraints) = 0,
    'contract_version', 'gestify-auth-compliance-v1',
    'checked_at', pg_catalog.clock_timestamp(),
    'missing_tables', v_missing_tables,
    'tables_without_rls', v_tables_without_rls,
    'tables_without_forced_rls', v_tables_without_forced_rls,
    'unexpected_policies', v_unexpected_policies,
    'client_grants', v_client_grants,
    'mutable_service_role_grants', v_mutable_service_role_grants,
    'missing_service_role_grants', v_missing_service_role_grants,
    'missing_row_guards', v_missing_row_guards,
    'missing_truncate_guards', v_missing_truncate_guards,
    'missing_unique_constraints', v_missing_unique_constraints,
    'metadata_backfill_rows', v_metadata_backfill_rows,
    'direct_evidence_rows', v_direct_evidence_rows
  );
end;
$function$;

revoke all on function public.gestify_auth_compliance_audit()
  from public, anon, authenticated;
grant execute on function public.gestify_auth_compliance_audit()
  to service_role;

comment on function public.gestify_auth_compliance_audit() is
  'Service-role-only contract for immutable terms evidence and authenticated access telemetry.';

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260811030000_create_auth_compliance_evidence_tables',
  'Created service-role-only, forced-RLS, append-only terms acceptance and access telemetry evidence tables; reconstructed legacy terms acceptance from Auth metadata with explicit metadata_backfill provenance.'
)
on conflict (migration_name) do nothing;

notify pgrst, 'reload schema';

commit;
