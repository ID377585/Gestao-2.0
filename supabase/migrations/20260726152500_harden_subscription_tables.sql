begin;

revoke all privileges on table public.company_subscriptions from anon;
revoke all privileges on table public.company_subscriptions from authenticated;
grant select on table public.company_subscriptions to authenticated;

revoke all privileges on table public.subscription_plans from anon;
revoke all privileges on table public.subscription_plans from authenticated;
grant select on table public.subscription_plans to authenticated;

drop policy if exists "Members can read own company subscriptions"
  on public.company_subscriptions;

create or replace function private.gestify_can_read_company_subscription(
  p_establishment_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_can_read boolean := false;
begin
  if p_establishment_id is null or (select auth.uid()) is null then
    return false;
  end if;

  if to_regclass('public.memberships') is not null then
    execute $sql$
      select exists (
        select 1
        from public.memberships m
        where m.establishment_id = $1
          and m.user_id = auth.uid()
          and coalesce(m.is_active, true) = true
      )
    $sql$
    using p_establishment_id
    into v_can_read;

    if v_can_read then
      return true;
    end if;
  end if;

  if to_regclass('public.establishment_memberships') is not null then
    select exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = p_establishment_id
        and em.user_id = (select auth.uid())
        and em.is_active = true
    )
    into v_can_read;

    return v_can_read;
  end if;

  return false;
end;
$$;

revoke all on function private.gestify_can_read_company_subscription(uuid)
  from public, anon;
grant execute on function private.gestify_can_read_company_subscription(uuid)
  to authenticated, service_role;

create policy "Members can read own company subscriptions"
on public.company_subscriptions
for select
to authenticated
using ((select private.gestify_can_read_company_subscription(establishment_id)));

notify pgrst, 'reload schema';

commit;
