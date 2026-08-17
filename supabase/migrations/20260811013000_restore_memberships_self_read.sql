begin;

-- The hosted database already has this policy, but it was missing from the
-- migration history. Without it, a fresh replay authenticates the user yet
-- returns no active tenant because RLS hides their own public.memberships row.
alter table public.memberships enable row level security;

grant select on table public.memberships to authenticated;

drop policy if exists memberships_read_own on public.memberships;
create policy memberships_read_own
on public.memberships
for select
to authenticated
using (user_id = (select auth.uid()));

comment on policy memberships_read_own on public.memberships is
  'Allows an authenticated user to resolve only their own active tenant memberships.';

notify pgrst, 'reload schema';

commit;
