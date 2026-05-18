begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.gestify_is_establishment_member(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = auth.uid()
      and em.is_active = true
  ) or exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = auth.uid()
      and coalesce(m.is_active, true) = true
  );
$$;

create or replace function private.gestify_has_establishment_role(p_establishment_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = auth.uid()
      and em.is_active = true
      and em.role::text = any(p_roles)
  ) or exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = auth.uid()
      and coalesce(m.is_active, true) = true
      and m.role = any(p_roles)
  );
$$;

revoke all on function private.gestify_is_establishment_member(uuid) from public, anon;
revoke all on function private.gestify_has_establishment_role(uuid, text[]) from public, anon;
grant execute on function private.gestify_is_establishment_member(uuid) to authenticated;
grant execute on function private.gestify_has_establishment_role(uuid, text[]) to authenticated;

-- Replace simple establishment_id table policies with private helper usage.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'stock_balances',
    'inventory_sessions',
    'stock_balance_audit',
    'carriers',
    'user_module_permissions',
    'current_stock_backup',
    'import_jobs',
    'invoice_entry_drafts'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists %I on public.%I', 'gestify_tenant_select', table_name);
      execute format('drop policy if exists %I on public.%I', 'gestify_tenant_insert_staff', table_name);
      execute format('drop policy if exists %I on public.%I', 'gestify_tenant_update_staff', table_name);
      execute format('drop policy if exists %I on public.%I', 'gestify_tenant_delete_admin', table_name);

      execute format('create policy %I on public.%I for select to authenticated using (private.gestify_is_establishment_member(establishment_id))', 'gestify_tenant_select', table_name);
      execute format('create policy %I on public.%I for insert to authenticated with check (private.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''estoque'', ''fiscal'']))', 'gestify_tenant_insert_staff', table_name);
      execute format('create policy %I on public.%I for update to authenticated using (private.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''estoque'', ''fiscal''])) with check (private.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''estoque'', ''fiscal'']))', 'gestify_tenant_update_staff', table_name);
      execute format('create policy %I on public.%I for delete to authenticated using (private.gestify_has_establishment_role(establishment_id, array[''admin'']))', 'gestify_tenant_delete_admin', table_name);
    end if;
  end loop;
end $$;

-- Fiscal/admin-scoped tables.
do $$
begin
  if to_regclass('public.fiscal_certificates') is not null then
    drop policy if exists fiscal_certificates_tenant_select on public.fiscal_certificates;
    drop policy if exists fiscal_certificates_fiscal_write on public.fiscal_certificates;
    create policy fiscal_certificates_tenant_select on public.fiscal_certificates for select to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']));
    create policy fiscal_certificates_fiscal_write on public.fiscal_certificates for all to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal'])) with check (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']));
  end if;

  if to_regclass('public.fiscal_nfe_inbox') is not null then
    drop policy if exists fiscal_nfe_inbox_tenant_select on public.fiscal_nfe_inbox;
    drop policy if exists fiscal_nfe_inbox_fiscal_write on public.fiscal_nfe_inbox;
    create policy fiscal_nfe_inbox_tenant_select on public.fiscal_nfe_inbox for select to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']));
    create policy fiscal_nfe_inbox_fiscal_write on public.fiscal_nfe_inbox for all to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal'])) with check (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']));
  end if;

  if to_regclass('public.fiscal_nsu_control') is not null then
    drop policy if exists fiscal_nsu_control_tenant_select on public.fiscal_nsu_control;
    drop policy if exists fiscal_nsu_control_fiscal_write on public.fiscal_nsu_control;
    create policy fiscal_nsu_control_tenant_select on public.fiscal_nsu_control for select to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']));
    create policy fiscal_nsu_control_fiscal_write on public.fiscal_nsu_control for all to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal'])) with check (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']));
  end if;

  if to_regclass('public.fiscal_company_profiles') is not null then
    drop policy if exists fiscal_company_profiles_tenant_select on public.fiscal_company_profiles;
    drop policy if exists fiscal_company_profiles_fiscal_write on public.fiscal_company_profiles;
    create policy fiscal_company_profiles_tenant_select on public.fiscal_company_profiles for select to authenticated using (private.gestify_is_establishment_member(establishment_id));
    create policy fiscal_company_profiles_fiscal_write on public.fiscal_company_profiles for all to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal'])) with check (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']));
  end if;

  if to_regclass('public.fiscal_product_mappings') is not null then
    drop policy if exists fiscal_product_mappings_tenant_select on public.fiscal_product_mappings;
    drop policy if exists fiscal_product_mappings_fiscal_write on public.fiscal_product_mappings;
    create policy fiscal_product_mappings_tenant_select on public.fiscal_product_mappings for select to authenticated using (private.gestify_is_establishment_member(establishment_id));
    create policy fiscal_product_mappings_fiscal_write on public.fiscal_product_mappings for all to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal'])) with check (private.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']));
  end if;
end $$;

-- Replace all child/parent policies that still referenced public helpers.
do $$
begin
  if to_regclass('public.inventory_items') is not null then
    drop policy if exists gestify_inventory_items_select on public.inventory_items;
    drop policy if exists gestify_inventory_items_write on public.inventory_items;
    create policy gestify_inventory_items_select on public.inventory_items
      for select to authenticated
      using (exists (select 1 from public.inventory_sessions s where s.id = inventory_items.session_id and private.gestify_is_establishment_member(s.establishment_id)));
    create policy gestify_inventory_items_write on public.inventory_items
      for all to authenticated
      using (exists (select 1 from public.inventory_sessions s where s.id = inventory_items.session_id and private.gestify_has_establishment_role(s.establishment_id, array['admin', 'estoque', 'operacao'])))
      with check (exists (select 1 from public.inventory_sessions s where s.id = inventory_items.session_id and private.gestify_has_establishment_role(s.establishment_id, array['admin', 'estoque', 'operacao'])));
  end if;

  if to_regclass('public.stock_transfer_items') is not null then
    drop policy if exists gestify_stock_transfer_items_select on public.stock_transfer_items;
    drop policy if exists gestify_stock_transfer_items_write on public.stock_transfer_items;
    create policy gestify_stock_transfer_items_select on public.stock_transfer_items
      for select to authenticated
      using (exists (select 1 from public.stock_transfers st where st.id = stock_transfer_items.transfer_id and (private.gestify_is_establishment_member(st.from_establishment_id) or private.gestify_is_establishment_member(st.to_establishment_id))));
    create policy gestify_stock_transfer_items_write on public.stock_transfer_items
      for all to authenticated
      using (exists (select 1 from public.stock_transfers st where st.id = stock_transfer_items.transfer_id and private.gestify_has_establishment_role(st.from_establishment_id, array['admin', 'estoque', 'operacao'])))
      with check (exists (select 1 from public.stock_transfers st where st.id = stock_transfer_items.transfer_id and private.gestify_has_establishment_role(st.from_establishment_id, array['admin', 'estoque', 'operacao'])));
  end if;

  if to_regclass('public.order_items_labels') is not null then
    drop policy if exists gestify_order_items_labels_select on public.order_items_labels;
    drop policy if exists gestify_order_items_labels_write on public.order_items_labels;
    create policy gestify_order_items_labels_select on public.order_items_labels
      for select to authenticated
      using (exists (select 1 from public.orders o where o.id = order_items_labels.order_id and private.gestify_is_establishment_member(o.establishment_id)));
    create policy gestify_order_items_labels_write on public.order_items_labels
      for all to authenticated
      using (exists (select 1 from public.orders o where o.id = order_items_labels.order_id and private.gestify_has_establishment_role(o.establishment_id, array['admin', 'operacao', 'estoque'])))
      with check (exists (select 1 from public.orders o where o.id = order_items_labels.order_id and private.gestify_has_establishment_role(o.establishment_id, array['admin', 'operacao', 'estoque'])));
  end if;

  if to_regclass('public.stock_transfers') is not null then
    drop policy if exists gestify_stock_transfers_select on public.stock_transfers;
    drop policy if exists gestify_stock_transfers_insert_staff on public.stock_transfers;
    drop policy if exists gestify_stock_transfers_update_staff on public.stock_transfers;
    drop policy if exists gestify_stock_transfers_delete_admin on public.stock_transfers;
    create policy gestify_stock_transfers_select on public.stock_transfers for select to authenticated using (private.gestify_is_establishment_member(from_establishment_id) or private.gestify_is_establishment_member(to_establishment_id));
    create policy gestify_stock_transfers_insert_staff on public.stock_transfers for insert to authenticated with check (private.gestify_has_establishment_role(from_establishment_id, array['admin', 'estoque', 'operacao']) and private.gestify_is_establishment_member(to_establishment_id));
    create policy gestify_stock_transfers_update_staff on public.stock_transfers for update to authenticated using (private.gestify_has_establishment_role(from_establishment_id, array['admin', 'estoque', 'operacao']) or private.gestify_has_establishment_role(to_establishment_id, array['admin', 'estoque', 'operacao'])) with check (private.gestify_has_establishment_role(from_establishment_id, array['admin', 'estoque', 'operacao']) or private.gestify_has_establishment_role(to_establishment_id, array['admin', 'estoque', 'operacao']));
    create policy gestify_stock_transfers_delete_admin on public.stock_transfers for delete to authenticated using (private.gestify_has_establishment_role(from_establishment_id, array['admin']));
  end if;
end $$;

-- New advisor no-policy tables.
do $$
begin
  if to_regclass('public.import_job_pages') is not null then
    drop policy if exists import_job_pages_tenant_select on public.import_job_pages;
    drop policy if exists import_job_pages_tenant_write on public.import_job_pages;
    create policy import_job_pages_tenant_select on public.import_job_pages for select to authenticated using (exists (select 1 from public.import_jobs j where j.id = import_job_pages.job_id and private.gestify_is_establishment_member(j.establishment_id)));
    create policy import_job_pages_tenant_write on public.import_job_pages for all to authenticated using (exists (select 1 from public.import_jobs j where j.id = import_job_pages.job_id and private.gestify_has_establishment_role(j.establishment_id, array['admin', 'operacao']))) with check (exists (select 1 from public.import_jobs j where j.id = import_job_pages.job_id and private.gestify_has_establishment_role(j.establishment_id, array['admin', 'operacao'])));
  end if;

  if to_regclass('public.technical_sheet_scales') is not null then
    drop policy if exists technical_sheet_scales_tenant_select on public.technical_sheet_scales;
    drop policy if exists technical_sheet_scales_tenant_write on public.technical_sheet_scales;
    create policy technical_sheet_scales_tenant_select on public.technical_sheet_scales for select to authenticated using (exists (select 1 from public.technical_sheets ts where ts.id = technical_sheet_scales.technical_sheet_id and private.gestify_is_establishment_member(ts.establishment_id)));
    create policy technical_sheet_scales_tenant_write on public.technical_sheet_scales for all to authenticated using (exists (select 1 from public.technical_sheets ts where ts.id = technical_sheet_scales.technical_sheet_id and private.gestify_has_establishment_role(ts.establishment_id, array['admin', 'operacao']))) with check (exists (select 1 from public.technical_sheets ts where ts.id = technical_sheet_scales.technical_sheet_id and private.gestify_has_establishment_role(ts.establishment_id, array['admin', 'operacao'])));
  end if;

  if to_regclass('public.technical_sheet_scale_ingredients') is not null then
    drop policy if exists technical_sheet_scale_ingredients_tenant_select on public.technical_sheet_scale_ingredients;
    drop policy if exists technical_sheet_scale_ingredients_tenant_write on public.technical_sheet_scale_ingredients;
    create policy technical_sheet_scale_ingredients_tenant_select on public.technical_sheet_scale_ingredients for select to authenticated using (exists (select 1 from public.technical_sheet_scales s join public.technical_sheets ts on ts.id = s.technical_sheet_id where s.id = technical_sheet_scale_ingredients.scale_id and private.gestify_is_establishment_member(ts.establishment_id)));
    create policy technical_sheet_scale_ingredients_tenant_write on public.technical_sheet_scale_ingredients for all to authenticated using (exists (select 1 from public.technical_sheet_scales s join public.technical_sheets ts on ts.id = s.technical_sheet_id where s.id = technical_sheet_scale_ingredients.scale_id and private.gestify_has_establishment_role(ts.establishment_id, array['admin', 'operacao']))) with check (exists (select 1 from public.technical_sheet_scales s join public.technical_sheets ts on ts.id = s.technical_sheet_id where s.id = technical_sheet_scale_ingredients.scale_id and private.gestify_has_establishment_role(ts.establishment_id, array['admin', 'operacao'])));
  end if;

  if to_regclass('public.production_productivity') is not null then
    drop policy if exists production_productivity_tenant_select on public.production_productivity;
    drop policy if exists production_productivity_tenant_write on public.production_productivity;
    create policy production_productivity_tenant_select on public.production_productivity for select to authenticated using (exists (select 1 from public.order_line_items oli where oli.id = production_productivity.order_item_id and private.gestify_is_establishment_member(oli.establishment_id)) or exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id where oi.id = production_productivity.order_item_id_alt and private.gestify_is_establishment_member(o.establishment_id)));
    create policy production_productivity_tenant_write on public.production_productivity for all to authenticated using (exists (select 1 from public.order_line_items oli where oli.id = production_productivity.order_item_id and private.gestify_has_establishment_role(oli.establishment_id, array['admin', 'operacao', 'producao'])) or exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id where oi.id = production_productivity.order_item_id_alt and private.gestify_has_establishment_role(o.establishment_id, array['admin', 'operacao', 'producao']))) with check (exists (select 1 from public.order_line_items oli where oli.id = production_productivity.order_item_id and private.gestify_has_establishment_role(oli.establishment_id, array['admin', 'operacao', 'producao'])) or exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id where oi.id = production_productivity.order_item_id_alt and private.gestify_has_establishment_role(o.establishment_id, array['admin', 'operacao', 'producao'])));
  end if;
end $$;

-- User-owned notifications.
do $$
begin
  if to_regclass('public.notifications') is not null then
    drop policy if exists notifications_own_select on public.notifications;
    drop policy if exists notifications_own_update on public.notifications;
    create policy notifications_own_select on public.notifications for select to authenticated using ("userId" = auth.uid()::text);
    create policy notifications_own_update on public.notifications for update to authenticated using ("userId" = auth.uid()::text) with check ("userId" = auth.uid()::text);
  end if;
end $$;

-- Explicit deny policies for internal/fail-closed tables to remove no-policy warnings.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['suppliers', 'gestify_security_migration_audit'] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists %I on public.%I', 'gestify_deny_direct_client_access', table_name);
      execute format('create policy %I on public.%I for all to authenticated using (false) with check (false)', 'gestify_deny_direct_client_access', table_name);
    end if;
  end loop;
end $$;

-- Drop exposed public helper functions after every dependent policy has been replaced.
drop function if exists public.gestify_is_establishment_member(uuid);
drop function if exists public.gestify_has_establishment_role(uuid, text[]);

-- Fix mutable search_path warnings.
do $$
declare
  routine record;
begin
  for routine in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'trg_stock_balances_fix_null_quantity','stock_balances_enforce_unit_uppercase','active_membership','run_inventory_report','set_updated_at_timestamp','consume_stock_from_order','can_transition','finalize_inventory_session','inventory_movements_fill_defaults','inventory_labels_after_insert','get_active_membership','fn_upsert_stock_balance_old','set_event_establishment_id','set_updated_at','order_status_label','register_loss','fill_qty_from_qty_delta','on_order_insert_create_event','on_order_status_change_create_event','fn_upsert_stock_balance','get_product_unit_label','separate_label_for_order','resolve_product_unit_label','touch_updated_at','inventory_movements_fill_unit_label','apply_production_and_update_stock','set_technical_sheets_updated_at','apply_inventory_movement_to_stock_balances','sql_run','fn_inventory_label_after_insert','stocks_view_io','set_order_status','advance_order','finalize_production'
      )
  loop
    execute format('alter function %I.%I(%s) set search_path = public, auth, pg_temp', routine.nspname, routine.proname, routine.args);
  end loop;
end $$;

insert into public.gestify_security_migration_audit (migration_name, notes)
values ('202605170002_gestify_security_hardening_followup_policies_v2', 'Added policies for RLS-enabled tables without policies, moved RLS helpers to private schema, removed exposed public helper RPCs, and fixed mutable function search_path warnings.')
on conflict (migration_name) do nothing;

commit;
