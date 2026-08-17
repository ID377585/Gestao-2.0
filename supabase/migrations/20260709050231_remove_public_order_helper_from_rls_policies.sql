begin;

-- Fresh environments did not yet have public.is_staff() when these policies
-- were rewritten. Define the same invoker helper used by the current contract
-- before referencing it; the later hardening migration may safely replace it.
create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path to 'public', 'auth', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.user_id = (select auth.uid())
      and em.is_active = true
      and em.role in (
        'admin'::public.app_role,
        'operacao'::public.app_role,
        'producao'::public.app_role,
        'estoque'::public.app_role,
        'fiscal'::public.app_role,
        'entrega'::public.app_role
      )
  );
$function$;

revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

-- These policy names existed in the historical production database but are not
-- guaranteed to exist in a clean bootstrap. Alter only policies that are present;
-- later migrations create the canonical scoped invoice policies.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_status_events'
      and policyname = 'select_timeline_events'
  ) then
    execute $policy$
      alter policy select_timeline_events
        on public.order_status_events
        to authenticated
        using (
          public.is_staff()
          or exists (
            select 1
            from public.orders o
            where o.id = order_status_events.order_id
              and (
                o.created_by = (select auth.uid())
                or o.customer_user_id = (select auth.uid())
              )
          )
        )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pre_invoices'
      and policyname = 'pre_invoices_select'
  ) then
    execute $policy$
      alter policy pre_invoices_select
        on public.pre_invoices
        to authenticated
        using (
          public.is_staff()
          or public.can_faturar()
          or exists (
            select 1
            from public.orders o
            where o.id = pre_invoices.order_id
              and (
                o.created_by = (select auth.uid())
                or o.customer_user_id = (select auth.uid())
              )
          )
        )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pre_invoice_items'
      and policyname = 'pre_invoice_items_select'
  ) then
    execute $policy$
      alter policy pre_invoice_items_select
        on public.pre_invoice_items
        to authenticated
        using (
          exists (
            select 1
            from public.pre_invoices pi
            left join public.orders o on o.id = pi.order_id
            where pi.id = pre_invoice_items.pre_invoice_id
              and (
                public.is_staff()
                or public.can_faturar()
                or o.created_by = (select auth.uid())
                or o.customer_user_id = (select auth.uid())
              )
          )
        )
    $policy$;
  end if;
end $$;

-- This helper only checks the current auth.uid() and receives no caller-provided
-- identifiers. Guard the ACL change so clean environments without the historical
-- helper still replay successfully.
do $$
begin
  if to_regprocedure('public.can_faturar()') is not null then
    revoke all on function public.can_faturar() from public, anon;
    grant execute on function public.can_faturar() to authenticated;
  end if;
end $$;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260709050231_remove_public_order_helper_from_rls_policies',
  'Removed order_belongs_to_user from historical public RLS policies when present and kept clean bootstrap compatibility; later migrations install canonical scoped policies.'
)
on conflict (migration_name) do nothing;

commit;
