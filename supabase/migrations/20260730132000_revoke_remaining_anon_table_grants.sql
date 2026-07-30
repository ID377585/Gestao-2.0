begin;

-- Tighten the remaining legacy SQL grants for unauthenticated Data API access.
-- RLS is enabled on the public schema tables and there are no anon/public
-- policies for these relations, so this removes only the leftover role grants.
revoke all privileges on table public.accounts_payable from anon;
revoke all privileges on table public.accounts_receivable from anon;
revoke all privileges on table public.audit_logs from anon;
revoke all privileges on table public.bank_accounts from anon;
revoke all privileges on table public.bank_reconciliation_entries from anon;
revoke all privileges on table public.buyer_monthly_goals from anon;
revoke all privileges on table public.cost_centers from anon;
revoke all privileges on table public.current_stock from anon;
revoke all privileges on table public.current_stock_backup from anon;
revoke all privileges on table public.current_stock_view from anon;
revoke all privileges on table public.establishment_memberships from anon;
revoke all privileges on table public.establishments from anon;
revoke all privileges on table public.financial_categories from anon;
revoke all privileges on table public.financial_history from anon;
revoke all privileges on table public.fiscal_certificates from anon;
revoke all privileges on table public.fiscal_nfe_inbox from anon;
revoke all privileges on table public.fiscal_nsu_control from anon;
revoke all privileges on table public.gestify_security_migration_audit from anon;
revoke all privileges on table public.goods_receipt_items from anon;
revoke all privileges on table public.goods_receipts from anon;
revoke all privileges on table public.hr_employee_face_profiles from anon;
revoke all privileges on table public.import_job_pages from anon;
revoke all privileges on table public.import_jobs from anon;
revoke all privileges on table public.inventory_current from anon;
revoke all privileges on table public.inventory_current_stock from anon;
revoke all privileges on table public.inventory_current_stock__deprecated from anon;
revoke all privileges on table public.inventory_last_count_vs_current from anon;
revoke all privileges on table public.invoice_entries from anon;
revoke all privileges on table public.invoice_entry_drafts from anon;
revoke all privileges on table public.invoice_entry_items from anon;
revoke all privileges on table public.invoice_entry_pending_items from anon;
revoke all privileges on table public.invoice_items from anon;
revoke all privileges on table public.invoices from anon;
revoke all privileges on table public.kds_production_view from anon;
revoke all privileges on table public.memberships from anon;
revoke all privileges on table public.organizations from anon;
revoke all privileges on table public.purchase_action_queue from anon;
revoke all privileges on table public.purchase_history from anon;
revoke all privileges on table public.purchase_order_items from anon;
revoke all privileges on table public.purchase_orders from anon;
revoke all privileges on table public.purchase_request_items from anon;
revoke all privileges on table public.purchase_requests from anon;
revoke all privileges on table public.stocks from anon;
revoke all privileges on table public.supplier_action_plans from anon;
revoke all privileges on table public.supplier_contact_history from anon;
revoke all privileges on table public.supplier_score_reviews from anon;
revoke all privileges on table public.technical_sheet_scale_ingredients from anon;
revoke all privileges on table public.technical_sheet_scales from anon;
revoke all privileges on table public.units from anon;
revoke all privileges on table public.user_access_audit_logs from anon;

commit;
