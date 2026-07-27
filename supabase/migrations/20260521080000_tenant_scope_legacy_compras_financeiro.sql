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

create or replace function private.gestify_legacy_table_names()
returns text[]
language sql
stable
as $$
  select array[
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
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array private.gestify_legacy_table_names() loop
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
    end if;
  end loop;
end $$;

do $$
declare
  v_default_establishment_id uuid;
  v_establishment_count integer;
  table_name text;
begin
  select count(*)
    into v_establishment_count
  from public.establishments;

  select id
    into v_default_establishment_id
  from public.establishments
  order by id
  limit 1;

  if v_establishment_count = 1 and v_default_establishment_id is not null then
    foreach table_name in array private.gestify_legacy_table_names() loop
      if to_regclass(format('public.%I', table_name)) is not null then
        execute format(
          'update public.%I set establishment_id = $1 where establishment_id is null',
          table_name
        )
        using v_default_establishment_id;
      end if;
    end loop;
  end if;
end $$;

update public.purchase_request_items i
set establishment_id = r.establishment_id
from public.purchase_requests r
where i.establishment_id is null
  and r.establishment_id is not null
  and i.request_id = r.id;

update public.purchase_orders o
set establishment_id = r.establishment_id
from public.purchase_requests r
where o.establishment_id is null
  and r.establishment_id is not null
  and o.request_id = r.id;

update public.purchase_order_items i
set establishment_id = o.establishment_id
from public.purchase_orders o
where i.establishment_id is null
  and o.establishment_id is not null
  and i.purchase_order_id = o.id;

update public.goods_receipts gr
set establishment_id = o.establishment_id
from public.purchase_orders o
where gr.establishment_id is null
  and o.establishment_id is not null
  and gr.purchase_order_id = o.id;

update public.goods_receipt_items i
set establishment_id = gr.establishment_id
from public.goods_receipts gr
where i.establishment_id is null
  and gr.establishment_id is not null
  and i.receipt_id = gr.id;

update public.supplier_action_plans sap
set establishment_id = s.establishment_id
from public.suppliers s
where sap.establishment_id is null
  and s.establishment_id is not null
  and sap.supplier_id = s.id;

update public.supplier_contact_history sch
set establishment_id = s.establishment_id
from public.suppliers s
where sch.establishment_id is null
  and s.establishment_id is not null
  and sch.supplier_id = s.id;

update public.supplier_score_reviews ssr
set establishment_id = s.establishment_id
from public.suppliers s
where ssr.establishment_id is null
  and s.establishment_id is not null
  and ssr.supplier_id = s.id;

update public.purchase_history h
set establishment_id = r.establishment_id
from public.purchase_requests r
where h.establishment_id is null
  and r.establishment_id is not null
  and h.entity_type = 'solicitacao'
  and h.entity_id = r.id;

update public.purchase_history h
set establishment_id = o.establishment_id
from public.purchase_orders o
where h.establishment_id is null
  and o.establishment_id is not null
  and h.entity_type = 'pedido'
  and h.entity_id = o.id;

update public.purchase_history h
set establishment_id = gr.establishment_id
from public.goods_receipts gr
where h.establishment_id is null
  and gr.establishment_id is not null
  and h.entity_type = 'recebimento'
  and h.entity_id = gr.id;

update public.accounts_payable ap
set establishment_id = gr.establishment_id
from public.goods_receipts gr
where ap.establishment_id is null
  and gr.establishment_id is not null
  and ap.origem = 'recebimento'
  and ap.origem_id = gr.id;

update public.financial_history h
set establishment_id = ap.establishment_id
from public.accounts_payable ap
where h.establishment_id is null
  and ap.establishment_id is not null
  and h.finance_type = 'pagar'
  and h.finance_id = ap.id;

update public.financial_history h
set establishment_id = ar.establishment_id
from public.accounts_receivable ar
where h.establishment_id is null
  and ar.establishment_id is not null
  and h.finance_type = 'receber'
  and h.finance_id = ar.id;

update public.bank_reconciliation_entries bre
set establishment_id = ba.establishment_id
from public.bank_accounts ba
where bre.establishment_id is null
  and ba.establishment_id is not null
  and bre.bank_account_id = ba.id;

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
declare
  table_name text;
begin
  foreach table_name in array private.gestify_legacy_table_names() loop
    if to_regclass(format('public.%I', table_name)) is not null then
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

create or replace function public.gestify_legacy_tenant_null_counts()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  table_name text;
  v_count bigint;
  v_counts jsonb := '[]'::jsonb;
begin
  foreach table_name in array private.gestify_legacy_table_names() loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'select count(*) from public.%I where establishment_id is null',
        table_name
      )
      into v_count;

      v_counts := v_counts || jsonb_build_array(
        jsonb_build_object(
          'table',
          table_name,
          'null_establishment_rows',
          v_count
        )
      );
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'tables', v_counts);
end;
$$;

create or replace function public.gestify_backfill_legacy_tenant(
  p_establishment_id uuid,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  table_name text;
  v_missing_rows bigint;
  v_updated_rows bigint;
  v_results jsonb := '[]'::jsonb;
begin
  if p_establishment_id is null then
    raise exception 'p_establishment_id is required';
  end if;

  if not exists (select 1 from public.establishments e where e.id = p_establishment_id) then
    raise exception 'establishment % not found', p_establishment_id;
  end if;

  foreach table_name in array private.gestify_legacy_table_names() loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'select count(*) from public.%I where establishment_id is null',
        table_name
      )
      into v_missing_rows;

      if p_dry_run then
        v_updated_rows := 0;
      else
        execute format(
          'update public.%I set establishment_id = $1 where establishment_id is null',
          table_name
        )
        using p_establishment_id;
        get diagnostics v_updated_rows = row_count;
      end if;

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'table',
          table_name,
          'missing_before',
          v_missing_rows,
          'updated',
          v_updated_rows
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'ok',
    true,
    'dry_run',
    p_dry_run,
    'establishment_id',
    p_establishment_id,
    'tables',
    v_results
  );
end;
$$;

revoke all on function public.gestify_legacy_tenant_null_counts() from public, anon, authenticated;
grant execute on function public.gestify_legacy_tenant_null_counts() to service_role;

revoke all on function public.gestify_backfill_legacy_tenant(uuid, boolean) from public, anon, authenticated;
grant execute on function public.gestify_backfill_legacy_tenant(uuid, boolean) to service_role;

comment on column public.suppliers.establishment_id is
  'Tenant scope for the legacy purchasing supplier catalog. Null legacy rows are intentionally not visible through authenticated RLS until backfilled.';

commit;
