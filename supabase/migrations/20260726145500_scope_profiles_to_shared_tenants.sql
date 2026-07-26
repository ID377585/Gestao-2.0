begin;

revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;

create or replace function private.gestify_shares_active_establishment(
  p_target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select
    exists (
      select 1
      from public.memberships mine
      join public.memberships target
        on target.establishment_id = mine.establishment_id
      where mine.user_id = (select auth.uid())
        and coalesce(mine.is_active, true) = true
        and target.user_id = p_target_user_id
        and coalesce(target.is_active, true) = true
    )
    or exists (
      select 1
      from public.establishment_memberships mine
      join public.establishment_memberships target
        on target.establishment_id = mine.establishment_id
      where mine.user_id = (select auth.uid())
        and mine.is_active = true
        and target.user_id = p_target_user_id
        and target.is_active = true
    );
$$;

revoke all on function private.gestify_shares_active_establishment(uuid)
  from public, anon;
grant execute on function private.gestify_shares_active_establishment(uuid)
  to authenticated, service_role;

drop policy if exists "select_profiles_basic" on public.profiles;
drop policy if exists "profiles_select_same_establishment" on public.profiles;

create policy "profiles_select_same_establishment"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.gestify_shares_active_establishment(id))
);

notify pgrst, 'reload schema';

commit;
