drop policy if exists nutrition_notifications_member_select on public.nutrition_notifications;
create policy nutrition_notifications_member_select
on public.nutrition_notifications
for select
to authenticated
using (
  (select private.gestify_is_establishment_member(establishment_id))
  and (target_user_id is null or target_user_id = (select auth.uid()))
);

drop policy if exists nutrition_notifications_member_update_read on public.nutrition_notifications;
create policy nutrition_notifications_member_update_read
on public.nutrition_notifications
for update
to authenticated
using (
  (select private.gestify_is_establishment_member(establishment_id))
  and (target_user_id is null or target_user_id = (select auth.uid()))
)
with check (
  (select private.gestify_is_establishment_member(establishment_id))
  and (target_user_id is null or target_user_id = (select auth.uid()))
);

drop policy if exists nutrition_notifications_service_role_all on public.nutrition_notifications;
create policy nutrition_notifications_service_role_all
on public.nutrition_notifications
for all
to service_role
using (true)
with check (true);
