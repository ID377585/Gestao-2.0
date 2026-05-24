begin;

create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  email text not null,
  role text not null default 'producao' check (
    role in ('admin', 'operacao', 'producao', 'estoque', 'fiscal', 'entrega')
  ),
  sector text,
  token_hash text not null unique,
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'revoked', 'expired')
  ),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_invitations_establishment_status_idx
  on public.tenant_invitations(establishment_id, status, created_at desc);

create index if not exists tenant_invitations_email_idx
  on public.tenant_invitations(email);

drop trigger if exists set_tenant_invitations_updated_at on public.tenant_invitations;
create trigger set_tenant_invitations_updated_at
before update on public.tenant_invitations
for each row
execute function public.update_updated_at_column();

alter table public.tenant_invitations enable row level security;

drop policy if exists tenant_invitations_staff_read on public.tenant_invitations;
create policy tenant_invitations_staff_read
  on public.tenant_invitations
  for select
  to authenticated
  using (
    private.gestify_has_establishment_role(
      establishment_id,
      array['admin', 'operacao']
    )
  );

drop policy if exists tenant_invitations_staff_insert on public.tenant_invitations;
create policy tenant_invitations_staff_insert
  on public.tenant_invitations
  for insert
  to authenticated
  with check (
    private.gestify_has_establishment_role(
      establishment_id,
      array['admin', 'operacao']
    )
  );

drop policy if exists tenant_invitations_staff_update on public.tenant_invitations;
create policy tenant_invitations_staff_update
  on public.tenant_invitations
  for update
  to authenticated
  using (
    private.gestify_has_establishment_role(
      establishment_id,
      array['admin', 'operacao']
    )
  )
  with check (
    private.gestify_has_establishment_role(
      establishment_id,
      array['admin', 'operacao']
    )
  );

grant select, insert, update on table public.tenant_invitations to authenticated;

create or replace function public.gestify_contract_check()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, information_schema, pg_temp
as $$
declare
  v_missing_tables jsonb;
  v_missing_columns jsonb;
  v_missing_functions jsonb;
  v_missing_order_statuses jsonb;
  v_missing_legacy_tables jsonb;
  v_missing_legacy_columns jsonb;
  v_legacy_rls_disabled jsonb;
  v_missing_legacy_policies jsonb;
  v_missing_saas_tables jsonb;
  v_missing_saas_columns jsonb;
  v_saas_rls_disabled jsonb;
  v_missing_tenant_invitation_policies jsonb;
begin
  with required_tables(table_name) as (
    values
      ('orders'),
      ('order_items'),
      ('order_line_items'),
      ('inventory_labels'),
      ('inventory_movements'),
      ('stock_balances'),
      ('losses'),
      ('order_items_labels'),
      ('order_billing_drafts'),
      ('shipping_carriers')
  )
  select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
    into v_missing_tables
  from required_tables
  where to_regclass(format('public.%I', table_name)) is null;

  with required_columns(table_name, column_name) as (
    values
      ('orders', 'id'),
      ('orders', 'establishment_id'),
      ('orders', 'status'),
      ('order_items', 'order_id'),
      ('order_items', 'unit'),
      ('order_line_items', 'order_id'),
      ('order_line_items', 'establishment_id'),
      ('order_line_items', 'unit_label'),
      ('inventory_labels', 'label_code'),
      ('inventory_labels', 'qty_balance'),
      ('inventory_labels', 'status'),
      ('inventory_movements', 'order_id'),
      ('inventory_movements', 'qty_delta'),
      ('stock_balances', 'establishment_id'),
      ('stock_balances', 'product_id'),
      ('stock_balances', 'unit_label'),
      ('stock_balances', 'quantity'),
      ('losses', 'establishment_id'),
      ('losses', 'product_id'),
      ('losses', 'label_id'),
      ('losses', 'qty'),
      ('losses', 'stock_before'),
      ('losses', 'stock_after'),
      ('order_items_labels', 'order_id'),
      ('order_billing_drafts', 'base_cost'),
      ('order_billing_drafts', 'items'),
      ('order_billing_drafts', 'total_value'),
      ('order_billing_drafts', 'created_by'),
      ('order_billing_drafts', 'carrier_id')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('table', rc.table_name, 'column', rc.column_name)
      order by rc.table_name, rc.column_name
    ),
    '[]'::jsonb
  )
    into v_missing_columns
  from required_columns rc
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = rc.table_name
      and c.column_name = rc.column_name
  );

  with required_functions(function_name) as (
    values
      ('accept_order'),
      ('advance_order_status'),
      ('separate_label_for_order'),
      ('cancel_order'),
      ('reopen_order'),
      ('create_order_with_items'),
      ('create_inventory_label'),
      ('fn_upsert_stock_balance'),
      ('register_loss'),
      ('gestify_legacy_tenant_null_counts'),
      ('gestify_backfill_legacy_tenant')
  )
  select coalesce(jsonb_agg(function_name order by function_name), '[]'::jsonb)
    into v_missing_functions
  from required_functions rf
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = rf.function_name
  );

  with required_statuses(status_name) as (
    values
      ('pedido_criado'),
      ('aceitou_pedido'),
      ('em_preparo'),
      ('em_separacao'),
      ('em_faturamento'),
      ('em_transporte'),
      ('entregue'),
      ('cancelado')
  )
  select coalesce(jsonb_agg(status_name order by status_name), '[]'::jsonb)
    into v_missing_order_statuses
  from required_statuses rs
  where not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_status'
      and e.enumlabel = rs.status_name
  );

  with legacy_tables(table_name) as (
    select unnest(private.gestify_legacy_table_names())
  )
  select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
    into v_missing_legacy_tables
  from legacy_tables
  where to_regclass(format('public.%I', table_name)) is null;

  with legacy_tables(table_name) as (
    select unnest(private.gestify_legacy_table_names())
  )
  select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
    into v_missing_legacy_columns
  from legacy_tables lt
  where to_regclass(format('public.%I', lt.table_name)) is not null
    and not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = lt.table_name
        and c.column_name = 'establishment_id'
    );

  with legacy_tables(table_name) as (
    select unnest(private.gestify_legacy_table_names())
  )
  select coalesce(jsonb_agg(lt.table_name order by lt.table_name), '[]'::jsonb)
    into v_legacy_rls_disabled
  from legacy_tables lt
  join pg_class c on c.oid = to_regclass(format('public.%I', lt.table_name))
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity = false;

  with legacy_tables(table_name) as (
    select unnest(private.gestify_legacy_table_names())
  ),
  required_policies(policy_name) as (
    values
      ('gestify_legacy_tenant_select'),
      ('gestify_legacy_tenant_insert'),
      ('gestify_legacy_tenant_update'),
      ('gestify_legacy_tenant_delete')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('table', lt.table_name, 'policy', rp.policy_name)
      order by lt.table_name, rp.policy_name
    ),
    '[]'::jsonb
  )
    into v_missing_legacy_policies
  from legacy_tables lt
  cross join required_policies rp
  where to_regclass(format('public.%I', lt.table_name)) is not null
    and not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = lt.table_name
        and p.policyname = rp.policy_name
    );

  with required_saas_tables(table_name) as (
    values
      ('subscription_plans'),
      ('company_subscriptions'),
      ('audit_logs'),
      ('user_module_permissions'),
      ('tenant_invitations')
  )
  select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
    into v_missing_saas_tables
  from required_saas_tables
  where to_regclass(format('public.%I', table_name)) is null;

  with required_saas_columns(table_name, column_name) as (
    values
      ('subscription_plans', 'slug'),
      ('subscription_plans', 'limits'),
      ('company_subscriptions', 'establishment_id'),
      ('company_subscriptions', 'plan_slug'),
      ('company_subscriptions', 'status'),
      ('audit_logs', 'establishment_id'),
      ('audit_logs', 'actor_user_id'),
      ('audit_logs', 'action'),
      ('audit_logs', 'entity_type'),
      ('audit_logs', 'details'),
      ('user_module_permissions', 'establishment_id'),
      ('user_module_permissions', 'user_id'),
      ('user_module_permissions', 'module_key'),
      ('user_module_permissions', 'can_access'),
      ('tenant_invitations', 'id'),
      ('tenant_invitations', 'establishment_id'),
      ('tenant_invitations', 'email'),
      ('tenant_invitations', 'role'),
      ('tenant_invitations', 'sector'),
      ('tenant_invitations', 'token_hash'),
      ('tenant_invitations', 'status'),
      ('tenant_invitations', 'invited_by'),
      ('tenant_invitations', 'accepted_by'),
      ('tenant_invitations', 'accepted_at'),
      ('tenant_invitations', 'expires_at'),
      ('tenant_invitations', 'created_at'),
      ('tenant_invitations', 'updated_at')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('table', rc.table_name, 'column', rc.column_name)
      order by rc.table_name, rc.column_name
    ),
    '[]'::jsonb
  )
    into v_missing_saas_columns
  from required_saas_columns rc
  where to_regclass(format('public.%I', rc.table_name)) is not null
    and not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = rc.table_name
        and c.column_name = rc.column_name
    );

  with required_saas_tables(table_name) as (
    values
      ('subscription_plans'),
      ('company_subscriptions'),
      ('audit_logs'),
      ('user_module_permissions'),
      ('tenant_invitations')
  )
  select coalesce(jsonb_agg(rst.table_name order by rst.table_name), '[]'::jsonb)
    into v_saas_rls_disabled
  from required_saas_tables rst
  join pg_class c on c.oid = to_regclass(format('public.%I', rst.table_name))
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity = false;

  with required_policies(policy_name) as (
    values
      ('tenant_invitations_staff_read'),
      ('tenant_invitations_staff_insert'),
      ('tenant_invitations_staff_update')
  )
  select coalesce(jsonb_agg(policy_name order by policy_name), '[]'::jsonb)
    into v_missing_tenant_invitation_policies
  from required_policies rp
  where to_regclass('public.tenant_invitations') is not null
    and not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'tenant_invitations'
        and p.policyname = rp.policy_name
    );

  return jsonb_build_object(
    'ok',
    jsonb_array_length(v_missing_tables) = 0
      and jsonb_array_length(v_missing_columns) = 0
      and jsonb_array_length(v_missing_functions) = 0
      and jsonb_array_length(v_missing_order_statuses) = 0
      and jsonb_array_length(v_missing_legacy_tables) = 0
      and jsonb_array_length(v_missing_legacy_columns) = 0
      and jsonb_array_length(v_legacy_rls_disabled) = 0
      and jsonb_array_length(v_missing_legacy_policies) = 0
      and jsonb_array_length(v_missing_saas_tables) = 0
      and jsonb_array_length(v_missing_saas_columns) = 0
      and jsonb_array_length(v_saas_rls_disabled) = 0
      and jsonb_array_length(v_missing_tenant_invitation_policies) = 0,
    'missing_tables',
    v_missing_tables,
    'missing_columns',
    v_missing_columns,
    'missing_functions',
    v_missing_functions,
    'missing_order_statuses',
    v_missing_order_statuses,
    'missing_legacy_tables',
    v_missing_legacy_tables,
    'missing_legacy_establishment_id_columns',
    v_missing_legacy_columns,
    'legacy_rls_disabled',
    v_legacy_rls_disabled,
    'missing_legacy_policies',
    v_missing_legacy_policies,
    'missing_saas_tables',
    v_missing_saas_tables,
    'missing_saas_columns',
    v_missing_saas_columns,
    'saas_rls_disabled',
    v_saas_rls_disabled,
    'missing_tenant_invitation_policies',
    v_missing_tenant_invitation_policies
  );
end;
$$;

revoke all on function public.gestify_contract_check() from public, anon, authenticated;
grant execute on function public.gestify_contract_check() to service_role;

commit;
