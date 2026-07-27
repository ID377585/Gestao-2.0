begin;

-- Restore stock dashboard reads without changing stock data.
-- Table-level SELECT is required before RLS policies can evaluate.
-- Existing RLS policies continue filtering rows by establishment membership.

do $$
begin
  if to_regclass('public.stock_balances') is not null then
    execute 'revoke all on table public.stock_balances from anon';
    execute 'grant select on table public.stock_balances to authenticated';

    if to_regclass('public.gestify_security_migration_audit') is not null then
      insert into public.gestify_security_migration_audit (migration_name, notes)
      values (
        '202605170006_gestify_restore_stock_balances_read',
        'Restored SELECT privilege on stock_balances for authenticated users so existing RLS policies can allow tenant-scoped stock dashboard reads; no stock rows were changed or deleted.'
      )
      on conflict (migration_name) do nothing;
    end if;
  end if;
end $$;

commit;
