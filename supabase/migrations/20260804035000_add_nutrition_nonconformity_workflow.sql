begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.nutrition_evidences (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  resource_type text not null,
  resource_id uuid not null,
  inspection_id uuid null references public.nutrition_inspections(id) on delete set null,
  answer_id uuid null references public.nutrition_inspection_answers(id) on delete set null,
  nonconformity_id uuid null references public.nutrition_nonconformities(id) on delete set null,
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

create table if not exists public.nutrition_audit_events (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  before_data jsonb null,
  after_data jsonb null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint nutrition_audit_events_action_check check (char_length(btrim(action)) > 0),
  constraint nutrition_audit_events_resource_check check (char_length(btrim(resource_type)) > 0)
);

create index if not exists nutrition_evidences_resource_idx
  on public.nutrition_evidences(establishment_id, resource_type, resource_id);
create index if not exists nutrition_evidences_nonconformity_idx
  on public.nutrition_evidences(establishment_id, nonconformity_id, created_at desc)
  where nonconformity_id is not null;
create index if not exists nutrition_reinspections_status_schedule_idx
  on public.nutrition_reinspections(establishment_id, status, scheduled_for);
create index if not exists nutrition_reinspections_nonconformity_idx
  on public.nutrition_reinspections(establishment_id, nonconformity_id, created_at desc);
create index if not exists nutrition_audit_events_resource_idx
  on public.nutrition_audit_events(establishment_id, resource_type, resource_id, created_at desc);

drop trigger if exists set_nutrition_evidences_updated_at on public.nutrition_evidences;
create trigger set_nutrition_evidences_updated_at
before update on public.nutrition_evidences
for each row execute function public.set_updated_at();

drop trigger if exists set_nutrition_reinspections_updated_at on public.nutrition_reinspections;
create trigger set_nutrition_reinspections_updated_at
before update on public.nutrition_reinspections
for each row execute function public.set_updated_at();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'nutrition_evidences',
    'nutrition_reinspections',
    'nutrition_audit_events'
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

revoke all on table public.nutrition_audit_events from authenticated;
grant select, insert on table public.nutrition_audit_events to authenticated;
drop policy if exists nutrition_audit_events_staff_update on public.nutrition_audit_events;

notify pgrst, 'reload schema';

commit;
