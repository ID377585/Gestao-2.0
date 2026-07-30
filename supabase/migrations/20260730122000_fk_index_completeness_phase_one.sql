-- Ensure foreign-key indexes are full indexes so the Supabase advisor and the
-- planner can use them consistently for joins, deletes and integrity checks.

drop index if exists public.hr_time_clock_settings_created_by_idx;
create index if not exists hr_time_clock_settings_created_by_idx
  on public.hr_time_clock_settings (created_by);

drop index if exists public.hr_time_clock_settings_updated_by_idx;
create index if not exists hr_time_clock_settings_updated_by_idx
  on public.hr_time_clock_settings (updated_by);

drop index if exists public.kitchen_checklist_run_items_checked_by_idx;
create index if not exists kitchen_checklist_run_items_checked_by_idx
  on public.kitchen_checklist_run_items (checked_by);

drop index if exists public.kitchen_checklist_runs_completed_by_idx;
create index if not exists kitchen_checklist_runs_completed_by_idx
  on public.kitchen_checklist_runs (completed_by);

drop index if exists public.kitchen_checklist_runs_opened_by_idx;
create index if not exists kitchen_checklist_runs_opened_by_idx
  on public.kitchen_checklist_runs (opened_by);

drop index if exists public.kitchen_checklist_templates_created_by_idx;
create index if not exists kitchen_checklist_templates_created_by_idx
  on public.kitchen_checklist_templates (created_by);

drop index if exists public.product_nutrition_facts_created_by_idx;
create index if not exists product_nutrition_facts_created_by_idx
  on public.product_nutrition_facts (created_by);

drop index if exists public.sales_price_benchmarks_created_by_idx;
create index if not exists sales_price_benchmarks_created_by_idx
  on public.sales_price_benchmarks (created_by);

drop index if exists public.technical_sheet_nutrition_snapshots_created_by_idx;
create index if not exists technical_sheet_nutrition_snapshots_created_by_idx
  on public.technical_sheet_nutrition_snapshots (created_by);

notify pgrst, 'reload schema';
