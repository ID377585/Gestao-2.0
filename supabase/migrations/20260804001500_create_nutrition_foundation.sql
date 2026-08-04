begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

create table if not exists public.nutrition_inspection_templates (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  name text not null,
  description text null,
  inspection_type text not null default 'vistoria',
  technical_reference text null,
  applicable_sectors text[] not null default array[]::text[],
  status text not null default 'draft',
  current_version integer not null default 1,
  expected_duration_minutes integer null,
  minimum_approval_percent numeric(5, 2) null,
  require_geolocation boolean not null default false,
  require_photo_on_nonconformity boolean not null default true,
  require_comment_on_nonconformity boolean not null default true,
  require_signature boolean not null default false,
  recurrence_rule jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  approved_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz null,
  updated_by uuid null references auth.users(id) on delete set null,
  canceled_by uuid null references auth.users(id) on delete set null,
  canceled_at timestamptz null,
  cancel_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_inspection_templates_name_check check (char_length(btrim(name)) > 0),
  constraint nutrition_inspection_templates_status_check check (
    status in ('draft', 'active', 'inactive', 'replaced', 'canceled')
  ),
  constraint nutrition_inspection_templates_duration_check check (
    expected_duration_minutes is null or expected_duration_minutes between 1 and 1440
  ),
  constraint nutrition_inspection_templates_percent_check check (
    minimum_approval_percent is null
    or (minimum_approval_percent >= 0 and minimum_approval_percent <= 100)
  )
);

create table if not exists public.nutrition_inspection_template_versions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  template_id uuid not null references public.nutrition_inspection_templates(id) on delete restrict,
  version integer not null,
  status text not null default 'draft',
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  approved_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_inspection_template_versions_unique unique (establishment_id, template_id, version),
  constraint nutrition_inspection_template_versions_status_check check (
    status in ('draft', 'active', 'inactive', 'replaced', 'canceled')
  )
);

create table if not exists public.nutrition_inspection_sections (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  template_version_id uuid not null references public.nutrition_inspection_template_versions(id) on delete cascade,
  title text not null,
  description text null,
  order_index integer not null default 0,
  weight numeric(8, 3) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_inspection_sections_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_inspection_sections_weight_check check (weight >= 0)
);

create table if not exists public.nutrition_inspection_items (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  template_version_id uuid not null references public.nutrition_inspection_template_versions(id) on delete cascade,
  section_id uuid not null references public.nutrition_inspection_sections(id) on delete cascade,
  title text not null,
  instruction text null,
  technical_reference text null,
  response_type text not null default 'conformity',
  order_index integer not null default 0,
  weight numeric(8, 3) not null default 1,
  default_severity text not null default 'medium',
  evidence_required boolean not null default false,
  comment_required boolean not null default false,
  create_nonconformity_on_failure boolean not null default true,
  default_due_days integer null,
  responsible_role text null,
  display_conditions jsonb not null default '{}'::jsonb,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_inspection_items_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_inspection_items_response_type_check check (
    response_type in (
      'conformity',
      'yes_no',
      'short_text',
      'long_text',
      'number',
      'temperature',
      'datetime',
      'single_choice',
      'multiple_choice',
      'photo',
      'document',
      'signature'
    )
  ),
  constraint nutrition_inspection_items_severity_check check (
    default_severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint nutrition_inspection_items_weight_check check (weight >= 0),
  constraint nutrition_inspection_items_due_check check (
    default_due_days is null or default_due_days between 0 and 365
  )
);

create table if not exists public.nutrition_inspections (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  inspection_code text null,
  template_id uuid null references public.nutrition_inspection_templates(id) on delete restrict,
  template_version_id uuid null references public.nutrition_inspection_template_versions(id) on delete restrict,
  template_snapshot jsonb not null default '{}'::jsonb,
  title text not null,
  inspection_type text not null default 'vistoria',
  target_company_name text null,
  target_unit_name text null,
  sector text null,
  scheduled_for timestamptz null,
  expected_duration_minutes integer null,
  status text not null default 'scheduled',
  inspector_user_id uuid null references auth.users(id) on delete set null,
  participants jsonb not null default '[]'::jsonb,
  started_at timestamptz null,
  paused_at timestamptz null,
  resumed_at timestamptz null,
  completed_at timestamptz null,
  canceled_at timestamptz null,
  cancel_reason text null,
  latitude numeric(10, 7) null,
  longitude numeric(10, 7) null,
  geolocation_accuracy_meters numeric(10, 2) null,
  geolocation_status text not null default 'not_requested',
  geolocation_address text null,
  geolocation_distance_meters numeric(10, 2) null,
  geolocation_failure_reason text null,
  total_items integer not null default 0,
  compliant_items integer not null default 0,
  noncompliant_items integer not null default 0,
  not_applicable_items integer not null default 0,
  score numeric(8, 3) null,
  compliance_percent numeric(5, 2) null,
  result text null,
  exceeded_time_reason text null,
  version integer not null default 1,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_inspections_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_inspections_code_unique unique (establishment_id, inspection_code),
  constraint nutrition_inspections_status_check check (
    status in ('scheduled', 'in_progress', 'paused', 'completed', 'canceled', 'overdue')
  ),
  constraint nutrition_inspections_geo_status_check check (
    geolocation_status in ('not_requested', 'captured', 'denied', 'unavailable', 'failed')
  ),
  constraint nutrition_inspections_result_check check (
    result is null or result in ('approved', 'approved_with_restrictions', 'failed')
  ),
  constraint nutrition_inspections_percent_check check (
    compliance_percent is null or (compliance_percent >= 0 and compliance_percent <= 100)
  ),
  constraint nutrition_inspections_counts_check check (
    total_items >= 0 and compliant_items >= 0 and noncompliant_items >= 0 and not_applicable_items >= 0
  )
);

create table if not exists public.nutrition_inspection_answers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  inspection_id uuid not null references public.nutrition_inspections(id) on delete cascade,
  item_id uuid null references public.nutrition_inspection_items(id) on delete set null,
  section_id uuid null references public.nutrition_inspection_sections(id) on delete set null,
  response_type text not null,
  response_value jsonb not null default '{}'::jsonb,
  conformity_status text null,
  score numeric(8, 3) null,
  comment text null,
  answered_by uuid null references auth.users(id) on delete set null,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_inspection_answers_unique unique (establishment_id, inspection_id, item_id),
  constraint nutrition_inspection_answers_conformity_check check (
    conformity_status is null or conformity_status in ('compliant', 'noncompliant', 'not_applicable')
  )
);

create table if not exists public.nutrition_evidences (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  resource_type text not null,
  resource_id uuid not null,
  inspection_id uuid null references public.nutrition_inspections(id) on delete set null,
  answer_id uuid null references public.nutrition_inspection_answers(id) on delete set null,
  nonconformity_id uuid null,
  file_path text not null,
  file_name text null,
  mime_type text not null,
  file_size_bytes bigint null,
  caption text null,
  category text null,
  metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  removed_at timestamptz null,
  removed_by uuid null references auth.users(id) on delete set null,
  remove_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_evidences_resource_check check (
    resource_type in (
      'inspection',
      'inspection_answer',
      'nonconformity',
      'action_item',
      'reinspection',
      'temperature_record',
      'sanitation_record',
      'document',
      'training',
      'report'
    )
  ),
  constraint nutrition_evidences_size_check check (file_size_bytes is null or file_size_bytes >= 0),
  constraint nutrition_evidences_path_check check (char_length(btrim(file_path)) > 0)
);

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

create table if not exists public.nutrition_nonconformities (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  code text null,
  source_type text not null default 'manual',
  source_id uuid null,
  inspection_id uuid null references public.nutrition_inspections(id) on delete set null,
  answer_id uuid null references public.nutrition_inspection_answers(id) on delete set null,
  title text not null,
  description text null,
  sector text null,
  location text null,
  category text null,
  severity text not null default 'medium',
  food_safety_risk text null,
  initial_evidence_summary text null,
  immediate_containment text null,
  responsible_user_id uuid null references auth.users(id) on delete set null,
  manager_user_id uuid null references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  due_at timestamptz null,
  status text not null default 'open',
  root_cause text null,
  corrective_action text null,
  correction_evidence_summary text null,
  validator_user_id uuid null references auth.users(id) on delete set null,
  validation_result text null,
  validation_comment text null,
  validation_at timestamptz null,
  needs_reinspection boolean not null default false,
  reinspection_due_at timestamptz null,
  reinspection_result text null,
  closed_at timestamptz null,
  canceled_at timestamptz null,
  cancel_reason text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_nonconformities_code_unique unique (establishment_id, code),
  constraint nutrition_nonconformities_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_nonconformities_source_check check (
    source_type in (
      'inspection_item',
      'temperature',
      'sanitation',
      'document',
      'training',
      'supplier',
      'pop',
      'manual'
    )
  ),
  constraint nutrition_nonconformities_severity_check check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint nutrition_nonconformities_status_check check (
    status in (
      'open',
      'awaiting_acceptance',
      'in_correction',
      'awaiting_evidence',
      'awaiting_validation',
      'reinspection_scheduled',
      'in_reinspection',
      'failed_reinspection',
      'closed',
      'canceled'
    )
  ),
  constraint nutrition_nonconformities_validation_check check (
    validation_result is null or validation_result in ('approved', 'rejected')
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nutrition_evidences_nonconformity_fk'
  ) then
    alter table public.nutrition_evidences
      add constraint nutrition_evidences_nonconformity_fk
      foreign key (nonconformity_id)
      references public.nutrition_nonconformities(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.nutrition_action_plans (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  title text not null,
  description text null,
  source_type text not null default 'manual',
  source_id uuid null,
  inspection_id uuid null references public.nutrition_inspections(id) on delete set null,
  nonconformity_id uuid null references public.nutrition_nonconformities(id) on delete set null,
  sector text null,
  status text not null default 'open',
  priority text not null default 'medium',
  responsible_user_id uuid null references auth.users(id) on delete set null,
  validator_user_id uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  completed_at timestamptz null,
  canceled_at timestamptz null,
  cancel_reason text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_action_plans_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_action_plans_status_check check (
    status in ('open', 'in_progress', 'awaiting_validation', 'completed', 'canceled')
  ),
  constraint nutrition_action_plans_priority_check check (
    priority in ('low', 'medium', 'high', 'critical')
  )
);

create table if not exists public.nutrition_action_items (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  action_plan_id uuid not null references public.nutrition_action_plans(id) on delete cascade,
  what text not null,
  why text null,
  where_text text null,
  how_text text null,
  responsible_user_id uuid null references auth.users(id) on delete set null,
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
  constraint nutrition_action_items_status_check check (
    status in ('pending', 'accepted', 'in_progress', 'awaiting_evidence', 'awaiting_validation', 'completed', 'rejected', 'canceled')
  ),
  constraint nutrition_action_items_priority_check check (
    priority in ('low', 'medium', 'high', 'critical')
  ),
  constraint nutrition_action_items_progress_check check (
    progress_percent >= 0 and progress_percent <= 100
  ),
  constraint nutrition_action_items_cost_check check (
    (estimated_cost is null or estimated_cost >= 0)
    and (actual_cost is null or actual_cost >= 0)
  )
);

create table if not exists public.nutrition_reinspections (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  nonconformity_id uuid not null references public.nutrition_nonconformities(id) on delete restrict,
  original_inspection_id uuid null references public.nutrition_inspections(id) on delete set null,
  scheduled_for timestamptz null,
  responsible_user_id uuid null references auth.users(id) on delete set null,
  scope text null,
  status text not null default 'scheduled',
  started_at timestamptz null,
  completed_at timestamptz null,
  result text null,
  result_comment text null,
  latitude numeric(10, 7) null,
  longitude numeric(10, 7) null,
  geolocation_accuracy_meters numeric(10, 2) null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_reinspections_status_check check (
    status in ('scheduled', 'in_progress', 'completed', 'canceled')
  ),
  constraint nutrition_reinspections_result_check check (
    result is null or result in ('approved', 'rejected')
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nutrition_signatures_reinspection_fk'
  ) then
    alter table public.nutrition_signatures
      add constraint nutrition_signatures_reinspection_fk
      foreign key (reinspection_id)
      references public.nutrition_reinspections(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.nutrition_temperature_points (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  name text not null,
  control_type text not null,
  sector text null,
  equipment_or_product text null,
  min_value numeric(8, 3) null,
  max_value numeric(8, 3) null,
  unit text not null default 'C',
  frequency_rule jsonb not null default '{}'::jsonb,
  responsible_user_id uuid null references auth.users(id) on delete set null,
  thermometer_id uuid null,
  require_photo boolean not null default false,
  default_corrective_action text null,
  is_active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_temperature_points_name_check check (char_length(btrim(name)) > 0),
  constraint nutrition_temperature_points_range_check check (
    min_value is null or max_value is null or min_value <= max_value
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nutrition_temperature_points_thermometer_fk'
  ) then
    alter table public.nutrition_temperature_points
      add constraint nutrition_temperature_points_thermometer_fk
      foreign key (thermometer_id)
      references public.nutrition_thermometers(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.nutrition_temperature_records (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  point_id uuid not null references public.nutrition_temperature_points(id) on delete restrict,
  thermometer_id uuid null references public.nutrition_thermometers(id) on delete set null,
  measured_value numeric(8, 3) not null,
  unit text not null default 'C',
  status text not null default 'within_limits',
  measured_at timestamptz not null default now(),
  observed_by uuid null references auth.users(id) on delete set null,
  observation text null,
  immediate_action text null,
  evidence_id uuid null references public.nutrition_evidences(id) on delete set null,
  nonconformity_id uuid null references public.nutrition_nonconformities(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_temperature_records_status_check check (
    status in ('within_limits', 'out_of_limits', 'confirmed_exception', 'canceled')
  )
);

create table if not exists public.nutrition_pops (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  code text null,
  title text not null,
  objective text null,
  scope text null,
  status text not null default 'draft',
  current_version integer not null default 1,
  applicable_sectors text[] not null default array[]::text[],
  next_review_at date null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_pops_code_unique unique (establishment_id, code),
  constraint nutrition_pops_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_pops_status_check check (
    status in ('draft', 'in_review', 'approved', 'active', 'replaced', 'canceled')
  )
);

create table if not exists public.nutrition_pop_versions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  pop_id uuid not null references public.nutrition_pops(id) on delete restrict,
  version integer not null,
  content jsonb not null default '{}'::jsonb,
  file_path text null,
  status text not null default 'draft',
  effective_from date null,
  next_review_at date null,
  author_user_id uuid null references auth.users(id) on delete set null,
  reviewer_user_id uuid null references auth.users(id) on delete set null,
  approver_user_id uuid null references auth.users(id) on delete set null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_pop_versions_unique unique (establishment_id, pop_id, version),
  constraint nutrition_pop_versions_status_check check (
    status in ('draft', 'in_review', 'approved', 'active', 'replaced', 'canceled')
  )
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
  utensils text null,
  required_ppe text null,
  frequency_rule jsonb not null default '{}'::jsonb,
  executor_user_id uuid null references auth.users(id) on delete set null,
  verifier_user_id uuid null references auth.users(id) on delete set null,
  pop_id uuid null references public.nutrition_pops(id) on delete set null,
  evidence_required boolean not null default false,
  status text not null default 'active',
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_sanitation_plans_name_check check (char_length(btrim(name)) > 0),
  constraint nutrition_sanitation_plans_target_check check (char_length(btrim(target_item)) > 0),
  constraint nutrition_sanitation_plans_status_check check (
    status in ('active', 'inactive', 'canceled')
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

create table if not exists public.nutrition_documents (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  document_type text not null,
  title text not null,
  document_number text null,
  issuer text null,
  issued_at date null,
  valid_until date null,
  next_renewal_at date null,
  responsible_user_id uuid null references auth.users(id) on delete set null,
  visibility text not null default 'internal',
  status text not null default 'active',
  alert_days_before integer[] not null default array[30, 15, 7],
  current_version integer not null default 1,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  canceled_by uuid null references auth.users(id) on delete set null,
  canceled_at timestamptz null,
  cancel_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_documents_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_documents_status_check check (
    status in ('active', 'near_expiration', 'expired', 'replaced', 'canceled')
  ),
  constraint nutrition_documents_visibility_check check (
    visibility in ('internal', 'restricted', 'external_share')
  )
);

create table if not exists public.nutrition_document_versions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  document_id uuid not null references public.nutrition_documents(id) on delete restrict,
  version integer not null,
  file_path text not null,
  file_name text null,
  mime_type text not null,
  file_size_bytes bigint null,
  checksum text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint nutrition_document_versions_unique unique (establishment_id, document_id, version),
  constraint nutrition_document_versions_path_check check (char_length(btrim(file_path)) > 0),
  constraint nutrition_document_versions_size_check check (file_size_bytes is null or file_size_bytes >= 0)
);

create table if not exists public.nutrition_trainings (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  title text not null,
  description text null,
  content_summary text null,
  instructor text null,
  workload_minutes integer null,
  validity_days integer null,
  mandatory_roles text[] not null default array[]::text[],
  status text not null default 'active',
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_trainings_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_trainings_workload_check check (workload_minutes is null or workload_minutes > 0),
  constraint nutrition_trainings_validity_check check (validity_days is null or validity_days > 0),
  constraint nutrition_trainings_status_check check (
    status in ('active', 'inactive', 'canceled')
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

create table if not exists public.nutrition_supplier_assessments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  supplier_id uuid null,
  supplier_name text not null,
  assessment_date date not null default current_date,
  quality_score numeric(5, 2) null,
  sanitary_status text not null default 'pending',
  supplied_categories text[] not null default array[]::text[],
  notes text null,
  nonconformity_id uuid null references public.nutrition_nonconformities(id) on delete set null,
  action_plan_id uuid null references public.nutrition_action_plans(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_supplier_assessments_name_check check (char_length(btrim(supplier_name)) > 0),
  constraint nutrition_supplier_assessments_score_check check (
    quality_score is null or (quality_score >= 0 and quality_score <= 100)
  ),
  constraint nutrition_supplier_assessments_status_check check (
    sanitary_status in ('pending', 'approved', 'approved_with_restriction', 'suspended', 'rejected')
  )
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
  constraint nutrition_reports_format_check check (format in ('pdf', 'docx', 'xlsx', 'html')),
  constraint nutrition_reports_status_check check (
    status in ('draft', 'generated', 'sent', 'canceled', 'failed')
  )
);

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

create unique index if not exists nutrition_report_deliveries_idempotency_idx
  on public.nutrition_report_deliveries(establishment_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.nutrition_audit_events (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid null,
  request_id text null,
  before_data jsonb null,
  after_data jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint nutrition_audit_events_action_check check (char_length(btrim(action)) > 0),
  constraint nutrition_audit_events_resource_check check (char_length(btrim(resource_type)) > 0)
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
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists nutrition_templates_establishment_status_idx
  on public.nutrition_inspection_templates(establishment_id, status, updated_at desc);
create index if not exists nutrition_template_versions_template_idx
  on public.nutrition_inspection_template_versions(establishment_id, template_id, version desc);
create index if not exists nutrition_sections_version_order_idx
  on public.nutrition_inspection_sections(establishment_id, template_version_id, order_index);
create index if not exists nutrition_items_section_order_idx
  on public.nutrition_inspection_items(establishment_id, section_id, order_index);
create index if not exists nutrition_inspections_status_schedule_idx
  on public.nutrition_inspections(establishment_id, status, scheduled_for desc);
create index if not exists nutrition_inspections_inspector_idx
  on public.nutrition_inspections(establishment_id, inspector_user_id, scheduled_for desc);
create index if not exists nutrition_answers_inspection_idx
  on public.nutrition_inspection_answers(establishment_id, inspection_id);
create index if not exists nutrition_evidences_resource_idx
  on public.nutrition_evidences(establishment_id, resource_type, resource_id);
create index if not exists nutrition_nonconformities_status_due_idx
  on public.nutrition_nonconformities(establishment_id, status, due_at);
create index if not exists nutrition_nonconformities_responsible_idx
  on public.nutrition_nonconformities(establishment_id, responsible_user_id, status);
create index if not exists nutrition_action_plans_status_due_idx
  on public.nutrition_action_plans(establishment_id, status, due_at);
create index if not exists nutrition_action_items_plan_idx
  on public.nutrition_action_items(establishment_id, action_plan_id, status);
create index if not exists nutrition_reinspections_status_schedule_idx
  on public.nutrition_reinspections(establishment_id, status, scheduled_for);
create index if not exists nutrition_temperature_records_point_time_idx
  on public.nutrition_temperature_records(establishment_id, point_id, measured_at desc);
create index if not exists nutrition_sanitation_records_plan_schedule_idx
  on public.nutrition_sanitation_records(establishment_id, sanitation_plan_id, scheduled_for desc);
create index if not exists nutrition_documents_status_validity_idx
  on public.nutrition_documents(establishment_id, status, valid_until);
create index if not exists nutrition_trainings_status_idx
  on public.nutrition_trainings(establishment_id, status, updated_at desc);
create index if not exists nutrition_supplier_assessments_supplier_idx
  on public.nutrition_supplier_assessments(establishment_id, supplier_id, assessment_date desc);
create index if not exists nutrition_reports_source_idx
  on public.nutrition_reports(establishment_id, source_type, source_id);
create index if not exists nutrition_audit_events_resource_idx
  on public.nutrition_audit_events(establishment_id, resource_type, resource_id, created_at desc);

do $$
declare
  table_name text;
  insert_only_table_name text;
begin
  foreach table_name in array array[
    'nutrition_settings',
    'nutrition_inspection_templates',
    'nutrition_inspection_template_versions',
    'nutrition_inspection_sections',
    'nutrition_inspection_items',
    'nutrition_inspections',
    'nutrition_inspection_answers',
    'nutrition_evidences',
    'nutrition_nonconformities',
    'nutrition_action_plans',
    'nutrition_action_items',
    'nutrition_reinspections',
    'nutrition_temperature_points',
    'nutrition_thermometers',
    'nutrition_temperature_records',
    'nutrition_pops',
    'nutrition_pop_versions',
    'nutrition_sanitation_plans',
    'nutrition_sanitation_records',
    'nutrition_documents',
    'nutrition_trainings',
    'nutrition_training_sessions',
    'nutrition_training_attendees',
    'nutrition_supplier_assessments',
    'nutrition_reports',
    'nutrition_report_deliveries'
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

    execute format(
      'drop trigger if exists %I on public.%I',
      'set_' || table_name || '_updated_at',
      table_name
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  end loop;

  foreach insert_only_table_name in array array[
    'nutrition_document_versions',
    'nutrition_signatures',
    'nutrition_audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', insert_only_table_name);
    execute format('grant select, insert on table public.%I to authenticated', insert_only_table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', insert_only_table_name);

    execute format('drop policy if exists %I on public.%I', insert_only_table_name || '_member_select', insert_only_table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.gestify_is_establishment_member(establishment_id)))',
      insert_only_table_name || '_member_select',
      insert_only_table_name
    );

    execute format('drop policy if exists %I on public.%I', insert_only_table_name || '_staff_insert', insert_only_table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''fiscal'']::text[])))',
      insert_only_table_name || '_staff_insert',
      insert_only_table_name
    );

    execute format('drop policy if exists %I on public.%I', insert_only_table_name || '_service_role_all', insert_only_table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      insert_only_table_name || '_service_role_all',
      insert_only_table_name
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
  and (select private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin', 'operacao', 'fiscal']::text[]))
);

drop policy if exists "nutrition_files_staff_update" on storage.objects;
create policy "nutrition_files_staff_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'nutrition-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (select private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin', 'operacao', 'fiscal']::text[]))
)
with check (
  bucket_id = 'nutrition-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (select private.gestify_has_establishment_role(((storage.foldername(name))[1])::uuid, array['admin', 'operacao', 'fiscal']::text[]))
);

notify pgrst, 'reload schema';

commit;
