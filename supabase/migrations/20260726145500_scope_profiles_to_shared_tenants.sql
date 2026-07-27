begin;

revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;

create or replace function private.gestify_shares_active_establishment(
  p_target_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_shares_establishment boolean := false;
begin
  if p_target_user_id is null or (select auth.uid()) is null then
    return false;
  end if;

  if to_regclass('public.memberships') is not null then
    execute $sql$
      select exists (
        select 1
        from public.memberships mine
        join public.memberships target
          on target.establishment_id = mine.establishment_id
        where mine.user_id = auth.uid()
          and coalesce(mine.is_active, true) = true
          and target.user_id = $1
          and coalesce(target.is_active, true) = true
      )
    $sql$
    using p_target_user_id
    into v_shares_establishment;

    if v_shares_establishment then
      return true;
    end if;
  end if;

  if to_regclass('public.establishment_memberships') is not null then
    select exists (
      select 1
      from public.establishment_memberships mine
      join public.establishment_memberships target
        on target.establishment_id = mine.establishment_id
      where mine.user_id = (select auth.uid())
        and mine.is_active = true
        and target.user_id = p_target_user_id
        and target.is_active = true
    )
    into v_shares_establishment;

    return v_shares_establishment;
  end if;

  return false;
end;
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
