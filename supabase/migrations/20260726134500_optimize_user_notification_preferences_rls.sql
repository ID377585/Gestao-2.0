begin;

revoke all privileges on table public.user_notification_preferences from anon;
revoke all privileges on table public.user_notification_preferences from authenticated;
grant select, insert, update on table public.user_notification_preferences to authenticated;

drop policy if exists "user_notification_preferences_select_own" on public.user_notification_preferences;
drop policy if exists "user_notification_preferences_insert_own" on public.user_notification_preferences;
drop policy if exists "user_notification_preferences_update_own" on public.user_notification_preferences;

create policy "user_notification_preferences_select_own"
on public.user_notification_preferences
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "user_notification_preferences_insert_own"
on public.user_notification_preferences
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "user_notification_preferences_update_own"
on public.user_notification_preferences
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

notify pgrst, 'reload schema';

commit;
