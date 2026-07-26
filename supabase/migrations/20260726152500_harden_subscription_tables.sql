begin;

revoke all privileges on table public.company_subscriptions from anon;
revoke all privileges on table public.company_subscriptions from authenticated;
grant select on table public.company_subscriptions to authenticated;

revoke all privileges on table public.subscription_plans from anon;
revoke all privileges on table public.subscription_plans from authenticated;
grant select on table public.subscription_plans to authenticated;

drop policy if exists "Members can read own company subscriptions"
  on public.company_subscriptions;

create policy "Members can read own company subscriptions"
on public.company_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.establishment_id = company_subscriptions.establishment_id
      and m.user_id = (select auth.uid())
      and m.is_active = true
  )
);

notify pgrst, 'reload schema';

commit;
