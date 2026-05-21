begin;

create schema if not exists private;

create or replace function private.gestify_is_establishment_member(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = auth.uid()
      and em.is_active = true
  )
  or exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = auth.uid()
      and coalesce(m.is_active, true) = true
  );
$$;

do $$
declare
  table_name text;
  legacy_tables text[] := array[
    'suppliers',
    'purchase_requests',
    'purchase_request_items',
    'purchase_orders',
    'purchase_order_items',
    'goods_receipts',
    'goods_receipt_items',
    'supplier_action_plans',
    'supplier_contact_history',
    'supplier_score_reviews',
    'purchase_action_queue',
    'buyer_monthly_goals',
    'purchase_history',
    'financial_categories',
    'cost_centers',
    'bank_accounts',
    'accounts_payable',
    'accounts_receivable',
    'financial_history',
    'bank_reconciliation_entries'
  ];
begin
  foreach table_name in array legacy_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'alter table public.%I add column if not exists establishment_id uuid references public.establishments(id) on delete cascade',
        table_name
      );

      execute format(
        'create index if not exists %I on public.%I (establishment_id, created_at desc)',
        table_name || '_establishment_created_idx',
        table_name
      );

      execute format('alter table public.%I enable row level security', table_name);

      execute format('drop policy if exists gestify_legacy_tenant_select on public.%I', table_name);
      execute format('drop policy if exists gestify_legacy_tenant_insert on public.%I', table_name);
      execute format('drop policy if exists gestify_legacy_tenant_update on public.%I', table_name);
      execute format('drop policy if exists gestify_legacy_tenant_delete on public.%I', table_name);

      execute format(
        'create policy gestify_legacy_tenant_select on public.%I for select to authenticated using (establishment_id is not null and private.gestify_is_establishment_member(establishment_id))',
        table_name
      );
      execute format(
        'create policy gestify_legacy_tenant_insert on public.%I for insert to authenticated with check (establishment_id is not null and private.gestify_is_establishment_member(establishment_id))',
        table_name
      );
      execute format(
        'create policy gestify_legacy_tenant_update on public.%I for update to authenticated using (establishment_id is not null and private.gestify_is_establishment_member(establishment_id)) with check (establishment_id is not null and private.gestify_is_establishment_member(establishment_id))',
        table_name
      );
      execute format(
        'create policy gestify_legacy_tenant_delete on public.%I for delete to authenticated using (establishment_id is not null and private.gestify_is_establishment_member(establishment_id))',
        table_name
      );

      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    end if;
  end loop;
end $$;

alter table if exists public.buyer_monthly_goals
  drop constraint if exists buyer_monthly_goals_buyer_reference_month_key;

do $$
begin
  if to_regclass('public.buyer_monthly_goals') is not null then
    drop index if exists public.buyer_monthly_goals_buyer_reference_month_establishment_idx;
    create unique index if not exists buyer_monthly_goals_establishment_buyer_reference_month_idx
      on public.buyer_monthly_goals (establishment_id, buyer, reference_month);
  end if;
end $$;

alter table if exists public.purchase_action_queue
  drop constraint if exists purchase_action_queue_alert_id_key;

do $$
begin
  if to_regclass('public.purchase_action_queue') is not null then
    drop index if exists public.purchase_action_queue_alert_id_establishment_idx;
    create unique index if not exists purchase_action_queue_establishment_alert_id_idx
      on public.purchase_action_queue (establishment_id, alert_id);
  end if;
end $$;

do $$
begin
  if to_regclass('public.suppliers') is not null then
    comment on column public.suppliers.establishment_id is
      'Tenant scope for the legacy purchasing supplier catalog. Null legacy rows are intentionally not visible through authenticated RLS until backfilled.';
  end if;
end $$;

commit;
