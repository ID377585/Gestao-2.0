begin;

-- Production can contain migration 20260902143000 in history without this helper
-- when the legacy public function was absent at the time that migration ran.
-- Reconcile the helper additively so later RLS policies have the same contract
-- in clean replay, staging and Production.
create or replace function private.current_user_can_manage_establishment_impl(
  target_establishment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = target_establishment_id
      and em.user_id = auth.uid()
      and em.is_active = true
      and em.role in ('admin', 'operacao')
  );
$$;

revoke all on function private.current_user_can_manage_establishment_impl(uuid) from public, anon;
grant execute on function private.current_user_can_manage_establishment_impl(uuid) to authenticated, service_role;

create or replace function public.current_user_can_manage_establishment(
  target_establishment_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, pg_temp
as $$
  select private.current_user_can_manage_establishment_impl(target_establishment_id);
$$;

revoke all on function public.current_user_can_manage_establishment(uuid) from public, anon;
grant execute on function public.current_user_can_manage_establishment(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
