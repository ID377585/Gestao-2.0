begin;

-- These policies existed in the original hosted database before the migration
-- history became complete. A clean Supabase bootstrap cannot ALTER a policy
-- that was never created, so this migration now owns the full policy contract.
alter table public.order_status_events enable row level security;
alter table public.pre_invoices enable row level security;
alter table public.pre_invoice_items enable row level security;

-- Replace global role helpers with tenant-scoped authorization. A boolean such
-- as is_staff() that ignores the row establishment would allow staff from one
-- tenant to satisfy policies for another tenant.
drop policy if exists select_timeline_events
  on public.order_status_events;
create policy select_timeline_events
  on public.order_status_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_status_events.order_id
        and (
          order_status_events.establishment_id is null
          or order_status_events.establishment_id = o.establishment_id
        )
        and (
          (select private.gestify_has_establishment_role(
            o.establishment_id,
            array[
              'admin',
              'operacao',
              'producao',
              'estoque',
              'fiscal',
              'entrega'
            ]::text[]
          ))
          or (
            coalesce(order_status_events.visible_to_client, false) = true
            and (
              o.created_by = (select auth.uid())
              or o.customer_user_id = (select auth.uid())
            )
          )
        )
    )
  );

drop policy if exists pre_invoices_select
  on public.pre_invoices;
create policy pre_invoices_select
  on public.pre_invoices
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = pre_invoices.order_id
        and (
          (select private.gestify_has_establishment_role(
            o.establishment_id,
            array['admin', 'operacao', 'estoque', 'fiscal']::text[]
          ))
          or o.created_by = (select auth.uid())
          or o.customer_user_id = (select auth.uid())
        )
    )
  );

drop policy if exists pre_invoice_items_select
  on public.pre_invoice_items;
create policy pre_invoice_items_select
  on public.pre_invoice_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pre_invoices pi
      join public.orders o on o.id = pi.order_id
      where pi.id = pre_invoice_items.pre_invoice_id
        and (
          (select private.gestify_has_establishment_role(
            o.establishment_id,
            array['admin', 'operacao', 'estoque', 'fiscal']::text[]
          ))
          or o.created_by = (select auth.uid())
          or o.customer_user_id = (select auth.uid())
        )
    )
  );

-- Legacy installations may contain this global billing helper even though it
-- is absent from a clean migration bootstrap. It is no longer needed by RLS;
-- restrict it to trusted server maintenance when present.
do $$
begin
  if to_regprocedure('public.can_faturar()') is not null then
    execute 'revoke all on function public.can_faturar() from public, anon, authenticated';
    execute 'grant execute on function public.can_faturar() to service_role';
  end if;
end $$;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260709050231_remove_public_order_helper_from_rls_policies',
  'Created bootstrap-safe tenant-scoped SELECT policies for order timeline and pre-invoices, enforced visible_to_client for customers, and restricted the optional legacy billing helper to service_role.'
)
on conflict (migration_name) do nothing;

commit;
