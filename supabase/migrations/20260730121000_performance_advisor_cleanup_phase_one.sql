begin;

-- Historical environments do not all expose the same optional audit columns.
-- Create advisor indexes only when the referenced table column exists so a
-- clean bootstrap remains deterministic without inventing schema fields.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hr_time_clock_settings'
      and column_name = 'created_by'
  ) then
    create index if not exists hr_time_clock_settings_created_by_idx
      on public.hr_time_clock_settings (created_by)
      where created_by is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hr_time_clock_settings'
      and column_name = 'updated_by'
  ) then
    create index if not exists hr_time_clock_settings_updated_by_idx
      on public.hr_time_clock_settings (updated_by)
      where updated_by is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kitchen_checklist_runs'
      and column_name = 'template_id'
  ) then
    create index if not exists kitchen_checklist_runs_template_id_idx
      on public.kitchen_checklist_runs (template_id);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kitchen_checklist_runs'
      and column_name = 'opened_by'
  ) then
    create index if not exists kitchen_checklist_runs_opened_by_idx
      on public.kitchen_checklist_runs (opened_by)
      where opened_by is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kitchen_checklist_runs'
      and column_name = 'completed_by'
  ) then
    create index if not exists kitchen_checklist_runs_completed_by_idx
      on public.kitchen_checklist_runs (completed_by)
      where completed_by is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kitchen_checklist_run_items'
      and column_name = 'template_item_id'
  ) then
    create index if not exists kitchen_checklist_run_items_template_item_id_idx
      on public.kitchen_checklist_run_items (template_item_id);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kitchen_checklist_run_items'
      and column_name = 'checked_by'
  ) then
    create index if not exists kitchen_checklist_run_items_checked_by_idx
      on public.kitchen_checklist_run_items (checked_by)
      where checked_by is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kitchen_checklist_templates'
      and column_name = 'created_by'
  ) then
    create index if not exists kitchen_checklist_templates_created_by_idx
      on public.kitchen_checklist_templates (created_by)
      where created_by is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_nutrition_facts'
      and column_name = 'created_by'
  ) then
    create index if not exists product_nutrition_facts_created_by_idx
      on public.product_nutrition_facts (created_by)
      where created_by is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales_price_benchmarks'
      and column_name = 'created_by'
  ) then
    create index if not exists sales_price_benchmarks_created_by_idx
      on public.sales_price_benchmarks (created_by)
      where created_by is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'technical_sheet_nutrition_snapshots'
      and column_name = 'created_by'
  ) then
    create index if not exists technical_sheet_nutrition_snapshots_created_by_idx
      on public.technical_sheet_nutrition_snapshots (created_by)
      where created_by is not null;
  end if;
end $$;

drop index if exists public.idx_membership_establishment;
drop index if exists public.idx_membership_user;
drop index if exists public.establishment_memberships_establishment_user_unique;
drop index if exists public.idx_order_transition;
drop index if exists public.products_sku_idx;
drop index if exists public.stock_balances_ux_est_prod_unit;
drop index if exists public.idx_technical_sheet_scale_ingredients_scale;

notify pgrst, 'reload schema';

commit;
