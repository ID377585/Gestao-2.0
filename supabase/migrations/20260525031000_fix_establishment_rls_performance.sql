begin;

create or replace function public.is_admin_in_establishment(est uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = est
      and em.user_id = auth.uid()
      and em.is_active = true
      and em.role = 'admin'::public.app_role
  );
$$;

drop policy if exists "establishments_select_member" on public.establishments;

create index if not exists idx_establishment_memberships_user_active_establishment
  on public.establishment_memberships (user_id, is_active, establishment_id);

create index if not exists idx_establishment_memberships_establishment_user_active_role
  on public.establishment_memberships (establishment_id, user_id, is_active, role);

create index if not exists idx_memberships_user_active_establishment_created
  on public.memberships (user_id, is_active, establishment_id, created_at desc);

analyze public.establishment_memberships;
analyze public.memberships;
analyze public.establishments;
analyze public.fiscal_company_profiles;

commit;
