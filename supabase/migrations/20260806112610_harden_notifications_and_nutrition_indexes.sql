begin;

alter function public.set_updated_at()
  set search_path = public, pg_temp;

drop policy if exists notifications_authenticated_select on public.notifications;
drop policy if exists notifications_authenticated_insert on public.notifications;
drop policy if exists notifications_authenticated_update on public.notifications;

create policy notifications_authenticated_select
on public.notifications for select to authenticated
using (
  archived_at is null
  and (user_id = (select auth.uid()) or "userId" = (select auth.uid())::text)
  and (establishment_id is null or private.gestify_is_establishment_member(establishment_id))
);

create policy notifications_authenticated_insert
on public.notifications for insert to authenticated
with check (
  (user_id = (select auth.uid()) or (user_id is null and "userId" = (select auth.uid())::text))
  and (establishment_id is null or private.gestify_is_establishment_member(establishment_id))
);

create policy notifications_authenticated_update
on public.notifications for update to authenticated
using (
  (user_id = (select auth.uid()) or "userId" = (select auth.uid())::text)
  and (establishment_id is null or private.gestify_is_establishment_member(establishment_id))
)
with check (
  (user_id = (select auth.uid()) or "userId" = (select auth.uid())::text)
  and (establishment_id is null or private.gestify_is_establishment_member(establishment_id))
);

create index if not exists nutrition_action_items_action_plan_id_idx on public.nutrition_action_items(action_plan_id);
create index if not exists nutrition_action_plans_nonconformity_id_idx on public.nutrition_action_plans(nonconformity_id);
create index if not exists nutrition_document_versions_document_id_idx on public.nutrition_document_versions(document_id);
create index if not exists nutrition_evidences_answer_id_idx on public.nutrition_evidences(answer_id);
create index if not exists nutrition_evidences_inspection_id_idx on public.nutrition_evidences(inspection_id);
create index if not exists nutrition_evidences_nonconformity_id_idx on public.nutrition_evidences(nonconformity_id);
create index if not exists nutrition_inspection_addendums_inspection_id_idx on public.nutrition_inspection_addendums(inspection_id);
create index if not exists nutrition_inspection_answers_inspection_id_idx on public.nutrition_inspection_answers(inspection_id);
create index if not exists nutrition_inspection_answers_item_id_idx on public.nutrition_inspection_answers(item_id);
create index if not exists nutrition_inspection_answers_section_id_idx on public.nutrition_inspection_answers(section_id);
create index if not exists nutrition_inspection_items_section_id_idx on public.nutrition_inspection_items(section_id);
create index if not exists nutrition_inspection_items_template_version_id_idx on public.nutrition_inspection_items(template_version_id);
create index if not exists nutrition_inspection_sections_template_version_id_idx on public.nutrition_inspection_sections(template_version_id);
create index if not exists nutrition_inspection_template_versions_template_id_idx on public.nutrition_inspection_template_versions(template_id);
create index if not exists nutrition_inspections_template_id_idx on public.nutrition_inspections(template_id);
create index if not exists nutrition_inspections_template_version_id_idx on public.nutrition_inspections(template_version_id);
create index if not exists nutrition_nonconformities_answer_id_idx on public.nutrition_nonconformities(answer_id);
create index if not exists nutrition_nonconformities_inspection_id_idx on public.nutrition_nonconformities(inspection_id);
create index if not exists nutrition_reinspections_nonconformity_id_idx on public.nutrition_reinspections(nonconformity_id);
create index if not exists nutrition_reinspections_original_inspection_id_idx on public.nutrition_reinspections(original_inspection_id);
create index if not exists nutrition_report_deliveries_report_id_idx on public.nutrition_report_deliveries(report_id);
create index if not exists nutrition_signatures_inspection_id_idx on public.nutrition_signatures(inspection_id);
create index if not exists nutrition_temperature_records_point_id_idx on public.nutrition_temperature_records(point_id);
create index if not exists nutrition_training_attendees_session_id_idx on public.nutrition_training_attendees(session_id);
create index if not exists nutrition_training_sessions_training_id_idx on public.nutrition_training_sessions(training_id);

notify pgrst, 'reload schema';
commit;
