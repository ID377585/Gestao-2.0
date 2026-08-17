begin;

-- Tighten the remaining legacy SQL grants for unauthenticated Data API access.
-- Some of these relations exist only in legacy Production; a clean staging/DR
-- replay must still succeed while revoking every relation that is actually present.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'accounts_payable',
    'accounts_receivable',
    'audit_logs',
    'bank_accounts',
    'bank_reconciliation_entries',
    'buyer_monthly_goals',
    'cost_centers',
    'current_stock',
    'current_stock_backup',
    'current_stock_view',
    'establishment_memberships',
    'establishments',
    'financial_categories',
    'financial_history',
    'fiscal_certificates',
    'fiscal_nfe_inbox',
    'fiscal_nsu_control',
    'gestify_security_migration_audit',
    'goods_receipt_items',
    'goods_receipts',
    'hr_employee_face_profiles',
    'import_job_pages',
    'import_jobs',
    'inventory_current',
    'inventory_current_stock',
    'inventory_current_stock__deprecated',
    'inventory_last_count_vs_current',
    'invoice_entries',
    'invoice_entry_drafts',
    'invoice_entry_items',
    'invoice_entry_pending_items',
    'invoice_items',
    'invoices',
    'kds_production_view',
    'memberships',
    'organizations',
    'purchase_action_queue',
    'purchase_history',
    'purchase_order_items',
    'purchase_orders',
    'purchase_request_items',
    'purchase_requests',
    'stocks',
    'supplier_action_plans',
    'supplier_contact_history',
    'supplier_score_reviews',
    'technical_sheet_scale_ingredients',
    'technical_sheet_scales',
    'units',
    'user_access_audit_logs'
  ]
  loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format('revoke all privileges on table public.%I from anon', relation_name);
    end if;
  end loop;
end $$;

commit;
