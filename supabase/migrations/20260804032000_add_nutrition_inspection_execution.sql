begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.nutrition_inspection_templates (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  name text not null,
  description text null,
  inspection_type text not null default 'vistoria',
  technical_reference text null,
  applicable_sectors text[] not null default array[]::text[],
  status text not null default 'active',
  current_version integer not null default 1,
  expected_duration_minutes integer null,
  minimum_approval_percent numeric(5, 2) null,
  require_geolocation boolean not null default false,
  require_photo_on_nonconformity boolean not null default false,
  require_comment_on_nonconformity boolean not null default true,
  require_signature boolean not null default false,
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
  constraint nutrition_inspection_templates_status_check check (status in ('draft', 'active', 'inactive', 'replaced', 'canceled')),
  constraint nutrition_inspection_templates_duration_check check (expected_duration_minutes is null or expected_duration_minutes between 1 and 1440),
  constraint nutrition_inspection_templates_percent_check check (minimum_approval_percent is null or (minimum_approval_percent >= 0 and minimum_approval_percent <= 100))
);

create table if not exists public.nutrition_inspection_template_versions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  template_id uuid not null references public.nutrition_inspection_templates(id) on delete restrict,
  version integer not null,
  status text not null default 'active',
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  approved_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_inspection_template_versions_unique unique (establishment_id, template_id, version),
  constraint nutrition_inspection_template_versions_status_check check (status in ('draft', 'active', 'inactive', 'replaced', 'canceled'))
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
  constraint nutrition_inspection_items_response_type_check check (response_type in ('conformity', 'yes_no', 'short_text', 'long_text', 'number', 'temperature', 'datetime', 'single_choice', 'multiple_choice', 'photo', 'document', 'signature')),
  constraint nutrition_inspection_items_severity_check check (default_severity in ('low', 'medium', 'high', 'critical')),
  constraint nutrition_inspection_items_weight_check check (weight >= 0),
  constraint nutrition_inspection_items_due_check check (default_due_days is null or default_due_days between 0 and 365)
);

create table if not exists public.nutrition_inspection_answers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  inspection_id uuid not null references public.nutrition_inspections(id) on delete cascade,
  item_id uuid null references public.nutrition_inspection_items(id) on delete set null,
  section_id uuid null references public.nutrition_inspection_sections(id) on delete set null,
  response_type text not null default 'conformity',
  response_value jsonb not null default '{}'::jsonb,
  conformity_status text null,
  score numeric(8, 3) null,
  comment text null,
  answered_by uuid null references auth.users(id) on delete set null,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_inspection_answers_unique unique (establishment_id, inspection_id, item_id),
  constraint nutrition_inspection_answers_conformity_check check (conformity_status is null or conformity_status in ('compliant', 'noncompliant', 'not_applicable'))
);

alter table public.nutrition_inspections
  add column if not exists template_id uuid null references public.nutrition_inspection_templates(id) on delete restrict,
  add column if not exists template_version_id uuid null references public.nutrition_inspection_template_versions(id) on delete restrict,
  add column if not exists template_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists started_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists total_items integer not null default 0,
  add column if not exists compliant_items integer not null default 0,
  add column if not exists noncompliant_items integer not null default 0,
  add column if not exists not_applicable_items integer not null default 0,
  add column if not exists compliance_percent numeric(5, 2) null,
  add column if not exists result text null;

alter table public.nutrition_nonconformities
  add column if not exists source_id uuid null,
  add column if not exists inspection_id uuid null references public.nutrition_inspections(id) on delete set null,
  add column if not exists answer_id uuid null references public.nutrition_inspection_answers(id) on delete set null,
  add column if not exists food_safety_risk text null,
  add column if not exists initial_evidence_summary text null,
  add column if not exists responsible_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists manager_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists root_cause text null,
  add column if not exists corrective_action text null,
  add column if not exists correction_evidence_summary text null,
  add column if not exists validator_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists validation_result text null,
  add column if not exists validation_comment text null,
  add column if not exists validation_at timestamptz null,
  add column if not exists needs_reinspection boolean not null default false,
  add column if not exists reinspection_due_at timestamptz null,
  add column if not exists reinspection_result text null,
  add column if not exists closed_at timestamptz null,
  add column if not exists canceled_at timestamptz null,
  add column if not exists cancel_reason text null,
  add column if not exists version integer not null default 1;

create unique index if not exists nutrition_nonconformities_inspection_item_open_idx
  on public.nutrition_nonconformities(establishment_id, inspection_id, source_id)
  where source_type = 'inspection_item' and status <> 'canceled';

create index if not exists nutrition_templates_establishment_status_idx
  on public.nutrition_inspection_templates(establishment_id, status, updated_at desc);
create index if not exists nutrition_template_versions_template_idx
  on public.nutrition_inspection_template_versions(establishment_id, template_id, version desc);
create index if not exists nutrition_sections_version_order_idx
  on public.nutrition_inspection_sections(establishment_id, template_version_id, order_index);
create index if not exists nutrition_items_section_order_idx
  on public.nutrition_inspection_items(establishment_id, section_id, order_index);
create index if not exists nutrition_answers_inspection_idx
  on public.nutrition_inspection_answers(establishment_id, inspection_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'nutrition_inspection_templates',
    'nutrition_inspection_template_versions',
    'nutrition_inspection_sections',
    'nutrition_inspection_items',
    'nutrition_inspection_answers'
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

    execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
