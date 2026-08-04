begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nutrition-files',
  'nutrition-files',
  false,
  20971520,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'text/html',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.nutrition_inspections
  add column if not exists geolocation_captured_at timestamptz null,
  add column if not exists started_by uuid null references auth.users(id) on delete set null,
  add column if not exists completed_by uuid null references auth.users(id) on delete set null,
  add column if not exists completion_notes text null,
  add column if not exists requires_signature boolean not null default false,
  add column if not exists requires_geolocation boolean not null default false,
  add column if not exists completion_integrity_hash text null,
  add column if not exists completed_snapshot jsonb null;

alter table public.nutrition_inspection_items
  add column if not exists evidence_required boolean not null default false;

create table if not exists public.nutrition_signatures (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  inspection_id uuid null references public.nutrition_inspections(id) on delete set null,
  reinspection_id uuid null,
  signer_name text not null,
  signer_role text null,
  signer_document text null,
  signature_path text null,
  signature_hash text null,
  declaration_text text null,
  refusal_reason text null,
  witness_name text null,
  signed_at timestamptz null,
  collected_by uuid null references auth.users(id) on delete set null,
  ip_address inet null,
  created_at timestamptz not null default now(),
  constraint nutrition_signatures_name_check check (char_length(btrim(signer_name)) > 0),
  constraint nutrition_signatures_signed_or_refused_check check (
    signed_at is not null or refusal_reason is not null
  )
);

create table if not exists public.nutrition_thermometers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  name text not null,
  identifier text null,
  calibration_due_at date null,
  verification_due_at date null,
  status text not null default 'active',
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_thermometers_name_check check (char_length(btrim(name)) > 0),
  constraint nutrition_thermometers_status_check check (
    status in ('active', 'inactive', 'maintenance', 'canceled')
  )
);

create table if not exists public.nutrition_sanitation_records (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  sanitation_plan_id uuid not null references public.nutrition_sanitation_plans(id) on delete restrict,
  scheduled_for timestamptz null,
  executed_at timestamptz null,
  verified_at timestamptz null,
  executor_user_id uuid null references auth.users(id) on delete set null,
  verifier_user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'pending',
  result text null,
  observation text null,
  evidence_id uuid null references public.nutrition_evidences(id) on delete set null,
  nonconformity_id uuid null references public.nutrition_nonconformities(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_sanitation_records_status_check check (
    status in ('pending', 'executed', 'verified', 'failed', 'canceled', 'overdue')
  ),
  constraint nutrition_sanitation_records_result_check check (
    result is null or result in ('approved', 'rejected')
  )
);

create table if not exists public.nutrition_training_sessions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  training_id uuid not null references public.nutrition_trainings(id) on delete restrict,
  session_type text not null default 'in_person',
  scheduled_for timestamptz null,
  completed_at timestamptz null,
  instructor text null,
  location text null,
  status text not null default 'scheduled',
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_training_sessions_type_check check (
    session_type in ('in_person', 'remote', 'hybrid')
  ),
  constraint nutrition_training_sessions_status_check check (
    status in ('scheduled', 'in_progress', 'completed', 'canceled')
  )
);

create table if not exists public.nutrition_training_attendees (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  session_id uuid not null references public.nutrition_training_sessions(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  attendee_name text null,
  attendance_status text not null default 'pending',
  assessment_score numeric(5, 2) null,
  certificate_path text null,
  signature_id uuid null references public.nutrition_signatures(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_training_attendees_person_check check (
    user_id is not null or nullif(attendee_name, '') is not null
  ),
  constraint nutrition_training_attendees_status_check check (
    attendance_status in ('pending', 'present', 'absent', 'justified', 'canceled')
  ),
  constraint nutrition_training_attendees_score_check check (
    assessment_score is null or (assessment_score >= 0 and assessment_score <= 100)
  )
);

alter table public.nutrition_reports
  add column if not exists preview_path text null,
  add column if not exists delivery_summary jsonb not null default '{}'::jsonb;

create table if not exists public.nutrition_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  report_id uuid not null references public.nutrition_reports(id) on delete restrict,
  channel text not null,
  recipient_name text null,
  recipient_address_masked text not null,
  status text not null default 'pending',
  idempotency_key text null,
  provider_message_id text null,
  error_message text null,
  requested_by uuid null references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_report_deliveries_channel_check check (
    channel in ('email', 'whatsapp', 'manual_share')
  ),
  constraint nutrition_report_deliveries_status_check check (
    status in ('pending', 'processing', 'sent', 'delivered', 'failed', 'canceled')
  )
);

alter table public.nutrition_report_deliveries
  add column if not exists channel_payload jsonb not null default '{}'::jsonb,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz null;

create table if not exists public.nutrition_inspection_addendums (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  inspection_id uuid not null references public.nutrition_inspections(id) on delete restrict,
  version integer not null default 1,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint nutrition_inspection_addendums_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_inspection_addendums_body_check check (char_length(btrim(body)) > 0)
);

create unique index if not exists nutrition_inspection_addendums_version_idx
  on public.nutrition_inspection_addendums(establishment_id, inspection_id, version);
create unique index if not exists nutrition_report_deliveries_idempotency_idx
  on public.nutrition_report_deliveries(establishment_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists nutrition_sanitation_records_plan_schedule_idx
  on public.nutrition_sanitation_records(establishment_id, sanitation_plan_id, scheduled_for desc);
create index if not exists nutrition_training_sessions_training_idx
  on public.nutrition_training_sessions(establishment_id, training_id, scheduled_for desc);
create index if not exists nutrition_training_attendees_session_idx
  on public.nutrition_training_attendees(establishment_id, session_id);
create index if not exists nutrition_thermometers_status_idx
  on public.nutrition_thermometers(establishment_id, status, calibration_due_at);

create index if not exists nutrition_evidences_answer_idx
  on public.nutrition_evidences(establishment_id, answer_id, created_at desc)
  where answer_id is not null and removed_at is null;

create index if not exists nutrition_evidences_inspection_idx
  on public.nutrition_evidences(establishment_id, inspection_id, created_at desc)
  where inspection_id is not null and removed_at is null;

create index if not exists nutrition_signatures_inspection_idx
  on public.nutrition_signatures(establishment_id, inspection_id, created_at desc)
  where inspection_id is not null;

create index if not exists nutrition_reports_file_idx
  on public.nutrition_reports(establishment_id, file_path)
  where file_path is not null;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'nutrition_signatures',
    'nutrition_inspection_addendums',
    'nutrition_sanitation_records',
    'nutrition_thermometers',
    'nutrition_training_sessions',
    'nutrition_training_attendees',
    'nutrition_report_deliveries'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert on table public.%I to authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_member_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.gestify_is_establishment_member(establishment_id)))',
      table_name || '_member_select',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_staff_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''fiscal'', ''rh'']::text[])))',
      table_name || '_staff_insert',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_service_role_all', table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      table_name || '_service_role_all',
      table_name
    );
  end loop;
end $$;

drop policy if exists "nutrition_files_member_select" on storage.objects;
create policy "nutrition_files_member_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'nutrition-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (select private.gestify_is_establishment_member(((storage.foldername(name))[1])::uuid))
);

drop policy if exists "nutrition_files_staff_insert" on storage.objects;
create policy "nutrition_files_staff_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'nutrition-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (select private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin', 'operacao', 'fiscal', 'rh']::text[]))
);

drop policy if exists "nutrition_files_staff_update" on storage.objects;
create policy "nutrition_files_staff_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'nutrition-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (select private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin', 'operacao', 'fiscal', 'rh']::text[]))
)
with check (
  bucket_id = 'nutrition-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (select private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin', 'operacao', 'fiscal', 'rh']::text[]))
);

notify pgrst, 'reload schema';

commit;
