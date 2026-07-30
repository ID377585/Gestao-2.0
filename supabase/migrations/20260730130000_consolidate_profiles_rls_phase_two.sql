begin;

drop policy if exists "profiles_select_admin_same_establishment" on public.profiles;
drop policy if exists "profiles_select_same_establishment" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_update_admin_same_establishment" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;

create policy "profiles_select_self_or_same_establishment"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.gestify_shares_active_establishment(profiles.id))
);

create policy "profiles_update_self_or_admin_same_establishment"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
  or (
    (select private.gestify_shares_active_establishment(profiles.id))
    and exists (
      select 1
      from public.establishment_memberships em
      where em.user_id = (select auth.uid())
        and em.is_active = true
        and em.role = 'admin'::public.app_role
    )
  )
)
with check (
  id = (select auth.uid())
  or (
    (select private.gestify_shares_active_establishment(profiles.id))
    and exists (
      select 1
      from public.establishment_memberships em
      where em.user_id = (select auth.uid())
        and em.is_active = true
        and em.role = 'admin'::public.app_role
    )
  )
);

notify pgrst, 'reload schema';

commit;
