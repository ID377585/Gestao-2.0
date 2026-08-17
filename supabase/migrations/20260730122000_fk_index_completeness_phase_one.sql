-- Ensure foreign-key indexes are full indexes so the Supabase advisor and the
-- planner can use them consistently for joins, deletes and integrity checks.
-- Historical databases can have optional audit columns that are absent from a
-- clean bootstrap. Only replace an index when its exact table/column contract
-- exists; do not invent columns to satisfy an advisor-only optimization.

do $$
declare
  index_contract record;
begin
  for index_contract in
    select *
    from (
      values
        ('hr_time_clock_settings', 'created_by', 'hr_time_clock_settings_created_by_idx'),
        ('hr_time_clock_settings', 'updated_by', 'hr_time_clock_settings_updated_by_idx'),
        ('kitchen_checklist_run_items', 'checked_by', 'kitchen_checklist_run_items_checked_by_idx'),
        ('kitchen_checklist_runs', 'completed_by', 'kitchen_checklist_runs_completed_by_idx'),
        ('kitchen_checklist_runs', 'opened_by', 'kitchen_checklist_runs_opened_by_idx'),
        ('kitchen_checklist_templates', 'created_by', 'kitchen_checklist_templates_created_by_idx'),
        ('product_nutrition_facts', 'created_by', 'product_nutrition_facts_created_by_idx'),
        ('sales_price_benchmarks', 'created_by', 'sales_price_benchmarks_created_by_idx'),
        ('technical_sheet_nutrition_snapshots', 'created_by', 'technical_sheet_nutrition_snapshots_created_by_idx')
    ) as contracts(table_name, column_name, index_name)
  loop
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = index_contract.table_name
        and c.column_name = index_contract.column_name
    ) then
      execute format('drop index if exists public.%I', index_contract.index_name);
      execute format(
        'create index if not exists %I on public.%I (%I)',
        index_contract.index_name,
        index_contract.table_name,
        index_contract.column_name
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
