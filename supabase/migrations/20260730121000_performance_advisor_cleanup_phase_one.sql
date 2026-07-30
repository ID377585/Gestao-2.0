begin;

do $$
begin
  if to_regclass('public.hr_time_clock_settings') is not null then
    create index if not exists hr_time_clock_settings_created_by_idx
      on public.hr_time_clock_settings (created_by)
      where created_by is not null;
    create index if not exists hr_time_clock_settings_updated_by_idx
      on public.hr_time_clock_settings (updated_by)
      where updated_by is not null;
  end if;

  if to_regclass('public.kitchen_checklist_runs') is not null then
    create index if not exists kitchen_checklist_runs_template_id_idx
      on public.kitchen_checklist_runs (template_id);
    create index if not exists kitchen_checklist_runs_opened_by_idx
      on public.kitchen_checklist_runs (opened_by)
      where opened_by is not null;
    create index if not exists kitchen_checklist_runs_completed_by_idx
      on public.kitchen_checklist_runs (completed_by)
      where completed_by is not null;
  end if;

  if to_regclass('public.kitchen_checklist_run_items') is not null then
    create index if not exists kitchen_checklist_run_items_template_item_id_idx
      on public.kitchen_checklist_run_items (template_item_id);
    create index if not exists kitchen_checklist_run_items_checked_by_idx
      on public.kitchen_checklist_run_items (checked_by)
      where checked_by is not null;
  end if;

  if to_regclass('public.kitchen_checklist_templates') is not null then
    create index if not exists kitchen_checklist_templates_created_by_idx
      on public.kitchen_checklist_templates (created_by)
      where created_by is not null;
  end if;

  if to_regclass('public.product_nutrition_facts') is not null then
    create index if not exists product_nutrition_facts_created_by_idx
      on public.product_nutrition_facts (created_by)
      where created_by is not null;
  end if;

  if to_regclass('public.sales_price_benchmarks') is not null then
    create index if not exists sales_price_benchmarks_created_by_idx
      on public.sales_price_benchmarks (created_by)
      where created_by is not null;
  end if;

  if to_regclass('public.technical_sheet_nutrition_snapshots') is not null then
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
