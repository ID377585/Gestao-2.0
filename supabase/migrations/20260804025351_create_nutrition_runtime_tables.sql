begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.nutrition_settings (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null unique,
  timezone text not null default 'America/Sao_Paulo',
  require_geolocation boolean not null default false,
  allow_geolocation_refusal_with_reason boolean not null default true,
  default_low_due_days integer not null default 7,
  default_medium_due_days integer not null default 3,
  default_high_due_days integer not null default 1,
  default_critical_due_hours integer not null default 4,
  escalation_rules jsonb not null default '{}'::jsonb,
  retention_rules jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_settings_due_check check (
    default_low_due_days between 1 and 365
    and default_medium_due_days between 1 and 365
    and default_high_due_days between 0 and 365
    and default_critical_due_hours between 1 and 720
  )
);

create table if not exists public.nutrition_inspections (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  inspection_code text null,
  title text not null,
  inspection_type text not null default 'vistoria',
  sector text null,
  scheduled_for timestamptz null,
  expected_duration_minutes integer null,
  status text not null default 'scheduled',
  inspector_user_id uuid null references auth.users(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_inspections_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_inspections_code_unique unique (establishment_id, inspection_code),
  constraint nutrition_inspections_status_check check (status in ('scheduled','in_progress','paused','completed','canceled','overdue')),
  constraint nutrition_inspections_duration_check check (expected_duration_minutes is null or expected_duration_minutes between 1 and 1440)
);

create table if not exists public.nutrition_nonconformities (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  code text null,
  source_type text not null default 'manual',
  title text not null,
  description text null,
  sector text null,
  location text null,
  category text null,
  severity text not null default 'medium',
  immediate_containment text null,
  opened_at timestamptz not null default now(),
  due_at timestamptz null,
  status text not null default 'open',
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_nonconformities_code_unique unique (establishment_id, code),
  constraint nutrition_nonconformities_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_nonconformities_source_check check (source_type in ('inspection_item','temperature','sanitation','document','training','supplier','pop','manual')),
  constraint nutrition_nonconformities_severity_check check (severity in ('low','medium','high','critical')),
  constraint nutrition_nonconformities_status_check check (status in ('open','awaiting_acceptance','in_correction','awaiting_evidence','awaiting_validation','reinspection_scheduled','in_reinspection','failed_reinspection','closed','canceled'))
);

create table if not exists public.nutrition_action_plans (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  title text not null,
  description text null,
  source_type text not null default 'manual',
  source_id uuid null,
  nonconformity_id uuid null references public.nutrition_nonconformities(id) on delete set null,
  sector text null,
  status text not null default 'open',
  priority text not null default 'medium',
  due_at timestamptz null,
  completed_at timestamptz null,
  canceled_at timestamptz null,
  cancel_reason text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_action_plans_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_action_plans_status_check check (status in ('open','in_progress','awaiting_validation','completed','canceled')),
  constraint nutrition_action_plans_priority_check check (priority in ('low','medium','high','critical'))
);

create table if not exists public.nutrition_action_items (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  action_plan_id uuid not null references public.nutrition_action_plans(id) on delete cascade,
  what text not null,
  why text null,
  where_text text null,
  how_text text null,
  due_at timestamptz null,
  status text not null default 'pending',
  priority text not null default 'medium',
  estimated_cost numeric(14, 2) null,
  actual_cost numeric(14, 2) null,
  progress_percent numeric(5, 2) not null default 0,
  validation_result text null,
  validation_comment text null,
  completed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_action_items_what_check check (char_length(btrim(what)) > 0),
  constraint nutrition_action_items_status_check check (status in ('pending','accepted','in_progress','awaiting_evidence','awaiting_validation','completed','rejected','canceled')),
  constraint nutrition_action_items_priority_check check (priority in ('low','medium','high','critical')),
  constraint nutrition_action_items_progress_check check (progress_percent >= 0 and progress_percent <= 100),
  constraint nutrition_action_items_cost_check check ((estimated_cost is null or estimated_cost >= 0) and (actual_cost is null or actual_cost >= 0))
);

create table if not exists public.nutrition_temperature_points (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  name text not null,
  control_type text not null,
  sector text null,
  equipment_or_product text null,
  min_value numeric(10, 2) null,
  max_value numeric(10, 2) null,
  unit text not null default 'C',
  default_corrective_action text null,
  is_active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_temperature_points_name_check check (char_length(btrim(name)) > 0),
  constraint nutrition_temperature_points_type_check check (char_length(btrim(control_type)) > 0),
  constraint nutrition_temperature_points_range_check check (min_value is null or max_value is null or min_value <= max_value)
);

create table if not exists public.nutrition_temperature_records (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  point_id uuid not null references public.nutrition_temperature_points(id) on delete restrict,
  measured_value numeric(10, 2) not null,
  unit text not null default 'C',
  status text not null default 'within_limits',
  measured_at timestamptz not null default now(),
  observed_by uuid null references auth.users(id) on delete set null,
  observation text null,
  immediate_action text null,
  created_at timestamptz not null default now(),
  constraint nutrition_temperature_records_status_check check (status in ('within_limits','out_of_limits','confirmed_exception'))
);

create table if not exists public.nutrition_pops (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  code text null,
  title text not null,
  objective text null,
  scope text null,
  applicable_sectors text[] not null default array[]::text[],
  status text not null default 'draft',
  next_review_at date null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_pops_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_pops_status_check check (status in ('draft','in_review','approved','active','replaced','canceled'))
);

create table if not exists public.nutrition_sanitation_plans (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  name text not null,
  sector text null,
  target_item text not null,
  method text null,
  product_name text null,
  dilution_or_concentration text null,
  contact_time text null,
  required_ppe text null,
  evidence_required boolean not null default false,
  status text not null default 'active',
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_sanitation_plans_name_check check (char_length(btrim(name)) > 0),
  constraint nutrition_sanitation_plans_target_check check (char_length(btrim(target_item)) > 0),
  constraint nutrition_sanitation_plans_status_check check (status in ('active','inactive','canceled'))
);

create table if not exists public.nutrition_documents (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  document_type text not null,
  title text not null,
  document_number text null,
  issuer text null,
  issued_at date null,
  valid_until date null,
  visibility text not null default 'internal',
  status text not null default 'active',
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_documents_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_documents_type_check check (char_length(btrim(document_type)) > 0),
  constraint nutrition_documents_visibility_check check (visibility in ('internal','restricted','external_share')),
  constraint nutrition_documents_status_check check (status in ('active','near_expiration','expired','replaced','canceled'))
);

create table if not exists public.nutrition_trainings (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  title text not null,
  description text null,
  instructor text null,
  workload_minutes integer null,
  validity_days integer null,
  status text not null default 'active',
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_trainings_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_trainings_workload_check check (workload_minutes is null or workload_minutes > 0),
  constraint nutrition_trainings_validity_check check (validity_days is null or validity_days > 0),
  constraint nutrition_trainings_status_check check (status in ('active','inactive','canceled'))
);

create table if not exists public.nutrition_supplier_assessments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  supplier_id uuid null,
  supplier_name text not null,
  assessment_date date not null default current_date,
  quality_score numeric(5, 2) null,
  sanitary_status text not null default 'pending',
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_supplier_assessments_name_check check (char_length(btrim(supplier_name)) > 0),
  constraint nutrition_supplier_assessments_score_check check (quality_score is null or (quality_score >= 0 and quality_score <= 100)),
  constraint nutrition_supplier_assessments_status_check check (sanitary_status in ('pending','approved','approved_with_restriction','suspended','rejected'))
);

create table if not exists public.nutrition_reports (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  report_type text not null,
  source_type text not null,
  source_id uuid null,
  title text not null,
  format text not null,
  file_path text null,
  verification_code text null,
  content_hash text null,
  version integer not null default 1,
  status text not null default 'draft',
  generated_by uuid null references auth.users(id) on delete set null,
  generated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_reports_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_reports_format_check check (format in ('pdf','docx','xlsx','html')),
  constraint nutrition_reports_status_check check (status in ('draft','generated','sent','canceled','failed'))
);

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
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create index if not exists nutrition_inspections_status_schedule_idx on public.nutrition_inspections(establishment_id, status, scheduled_for desc);
create index if not exists nutrition_nonconformities_status_due_idx on public.nutrition_nonconformities(establishment_id, status, due_at);
create index if not exists nutrition_action_plans_status_due_idx on public.nutrition_action_plans(establishment_id, status, due_at);
create index if not exists nutrition_action_items_plan_idx on public.nutrition_action_items(establishment_id, action_plan_id, status);
create index if not exists nutrition_temperature_records_point_time_idx on public.nutrition_temperature_records(establishment_id, point_id, measured_at desc);
create index if not exists nutrition_documents_status_validity_idx on public.nutrition_documents(establishment_id, status, valid_until);
create index if not exists nutrition_trainings_status_idx on public.nutrition_trainings(establishment_id, status, updated_at desc);
create index if not exists nutrition_supplier_assessments_supplier_idx on public.nutrition_supplier_assessments(establishment_id, supplier_id, assessment_date desc);
create index if not exists nutrition_reports_source_idx on public.nutrition_reports(establishment_id, source_type, source_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'nutrition_settings',
    'nutrition_inspections',
    'nutrition_nonconformities',
    'nutrition_action_plans',
    'nutrition_action_items',
    'nutrition_temperature_points',
    'nutrition_temperature_records',
    'nutrition_pops',
    'nutrition_sanitation_plans',
    'nutrition_documents',
    'nutrition_trainings',
    'nutrition_supplier_assessments',
    'nutrition_reports'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert, update on table public.%I to authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_member_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.gestify_is_establishment_member(establishment_id)))',
      table_name || '_member_select',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_staff_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''fiscal'']::text[])))',
      table_name || '_staff_insert',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_staff_update', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''fiscal'']::text[]))) with check ((select private.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''fiscal'']::text[])))',
      table_name || '_staff_update',
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

notify pgrst, 'reload schema';

commit;
