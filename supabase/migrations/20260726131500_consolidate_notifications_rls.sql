begin;

-- Preserve compatibility with both the current user_id UUID column and the
-- legacy userId text column while avoiding multiple permissive policies.
drop policy if exists "Authenticated users can insert own notifications" on public.notifications;
drop policy if exists "Authenticated users can read notifications" on public.notifications;
drop policy if exists "Authenticated users can update notifications" on public.notifications;
drop policy if exists "notifications_own_select" on public.notifications;
drop policy if exists "notifications_own_update" on public.notifications;

create policy "notifications_authenticated_select"
on public.notifications
for select
to authenticated
using (
  archived_at is null
  and (
    user_id = (select auth.uid())
    or "userId" = (select auth.uid())::text
    or (user_id is null and nullif("userId", '') is null)
  )
);

create policy "notifications_authenticated_insert"
on public.notifications
for insert
to authenticated
with check (
  (
    user_id = (select auth.uid())
    and (nullif("userId", '') is null or "userId" = (select auth.uid())::text)
  )
  or (
    user_id is null
    and "userId" = (select auth.uid())::text
  )
);

create policy "notifications_authenticated_update"
on public.notifications
for update
to authenticated
using (
  user_id = (select auth.uid())
  or "userId" = (select auth.uid())::text
  or (user_id is null and nullif("userId", '') is null)
)
with check (
  user_id = (select auth.uid())
  or "userId" = (select auth.uid())::text
  or (user_id is null and nullif("userId", '') is null)
);

create or replace function public.mark_notification_read(p_id uuid)
returns void
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
  update public.notifications
     set read_at = now(), "read" = true
   where id = p_id
     and (
       user_id = (select auth.uid())
       or "userId" = (select auth.uid())::text
       or (user_id is null and nullif("userId", '') is null)
     );
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
     and (
       user_id = (select auth.uid())
       or "userId" = (select auth.uid())::text
       or (user_id is null and nullif("userId", '') is null)
     );
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
     and (
       user_id = (select auth.uid())
       or "userId" = (select auth.uid())::text
       or (user_id is null and nullif("userId", '') is null)
     );
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
     and (
       user_id = (select auth.uid())
       or "userId" = (select auth.uid())::text
       or (user_id is null and nullif("userId", '') is null)
     );
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

notify pgrst, 'reload schema';

commit;
