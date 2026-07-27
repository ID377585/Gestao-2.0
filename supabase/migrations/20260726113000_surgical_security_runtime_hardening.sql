begin;

-- Required runtime grants. RLS remains the row-level authorization boundary.
grant select on table public.user_module_permissions to authenticated;
grant select, insert, update, delete on table public.inventory_sessions to authenticated;
grant select, insert, update, delete on table public.stock_balances to authenticated;

-- Only the signed-in user may manage their own notification preferences.
revoke all privileges on table public.notification_preferences from anon;
grant select, insert, update, delete on table public.notification_preferences to authenticated;

drop policy if exists "notification_preferences_own_select" on public.notification_preferences;
drop policy if exists "notification_preferences_own_insert" on public.notification_preferences;
drop policy if exists "notification_preferences_own_update" on public.notification_preferences;
drop policy if exists "notification_preferences_own_delete" on public.notification_preferences;

create policy "notification_preferences_own_select"
on public.notification_preferences
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "notification_preferences_own_insert"
on public.notification_preferences
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "notification_preferences_own_update"
on public.notification_preferences
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "notification_preferences_own_delete"
on public.notification_preferences
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Configuration, backup and server-managed benchmark data stay behind service-role code.
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'notification_thresholds',
    'products_cost_backup_20260527',
    'sales_price_benchmarks'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      policy_name := table_name || '_service_role_all';
      execute format('revoke all privileges on table public.%I from anon, authenticated', table_name);
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        policy_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- Anonymous access is unnecessary for the authenticated notification center.
revoke all privileges on table public.notifications from anon;

-- Authenticated users may create only notifications addressed to themselves.
drop policy if exists "Authenticated users can insert notifications" on public.notifications;
create policy "Authenticated users can insert own notifications"
on public.notifications
for insert
to authenticated
with check (user_id = (select auth.uid()));

-- A public bucket serves object URLs without a broad SELECT policy. Removing this
-- policy prevents anonymous listing of every avatar while preserving public URLs.
drop policy if exists "Public can view avatars" on storage.objects;

-- The broad tenant SELECT policy exposed all users' module permissions to any member.
-- The existing own-user policy remains responsible for client-side permission reads.
drop policy if exists "gestify_tenant_select" on public.user_module_permissions;

-- Replace the exposed public admin helper in membership RLS with the private helper.
drop policy if exists "memberships_select_admin_same_establishment" on public.establishment_memberships;
drop policy if exists "memberships_insert_admin" on public.establishment_memberships;
drop policy if exists "memberships_update_admin" on public.establishment_memberships;
drop policy if exists "memberships_delete_admin" on public.establishment_memberships;

create policy "memberships_select_admin_same_establishment"
on public.establishment_memberships
for select
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

create policy "memberships_insert_admin"
on public.establishment_memberships
for insert
to authenticated
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

create policy "memberships_update_admin"
on public.establishment_memberships
for update
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])))
with check ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

create policy "memberships_delete_admin"
on public.establishment_memberships
for delete
to authenticated
using ((select private.gestify_has_establishment_role(establishment_id, array['admin']::text[])));

revoke execute on function public.is_admin_in_establishment(uuid) from public, anon, authenticated;
grant execute on function public.is_admin_in_establishment(uuid) to service_role;

-- User-facing notification mutations execute with caller privileges and cannot target
-- another user's private notification. The parameters are kept for API compatibility.
create or replace function public.mark_notification_read(p_id uuid)
returns void
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
  update public.notifications
     set read_at = now(), "read" = true
   where id = p_id
     and (user_id is null or user_id = (select auth.uid()));
$$;

create or replace function public.mark_all_notifications_read(p_user_id uuid default null)
returns void
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
begin
  update public.notifications
     set read_at = now(), "read" = true
   where read_at is null
     and (user_id is null or user_id = (select auth.uid()));
end;
$$;

create or replace function public.archive_notification(p_id uuid)
returns void
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
  update public.notifications
     set archived_at = now(),
         read_at = coalesce(read_at, now()),
         "read" = true
   where id = p_id
     and (user_id is null or user_id = (select auth.uid()));
$$;

create or replace function public.archive_read_notifications(p_user_id uuid default null)
returns void
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
begin
  update public.notifications
     set archived_at = now()
   where archived_at is null
     and (read_at is not null or coalesce("read", false) = true)
     and (user_id is null or user_id = (select auth.uid()));
end;
$$;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.mark_all_notifications_read(uuid) from public, anon;
revoke execute on function public.archive_notification(uuid) from public, anon;
revoke execute on function public.archive_read_notifications(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated, service_role;
grant execute on function public.archive_notification(uuid) to authenticated, service_role;
grant execute on function public.archive_read_notifications(uuid) to authenticated, service_role;

-- Notification creation and automatic checks are trusted server-side operations only.
revoke execute on function public.create_notification(text, text, text, text, jsonb, uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.run_notification_checks()
  from public, anon, authenticated;
revoke execute on function public.run_operational_notification_checks()
  from public, anon, authenticated;

grant execute on function public.create_notification(text, text, text, text, jsonb, uuid, text, text)
  to service_role;
grant execute on function public.run_notification_checks()
  to service_role;
grant execute on function public.run_operational_notification_checks()
  to service_role;

notify pgrst, 'reload schema';

commit;
