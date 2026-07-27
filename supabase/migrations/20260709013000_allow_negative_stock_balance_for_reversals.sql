begin;

-- Administrative invoice reversals can legitimately drive a product balance below
-- zero when the received stock was consumed before the invoice was cancelled.
-- Keep the balance auditable instead of blocking the reversal at the mirror table.
alter table public.stock_balances
  drop constraint if exists stock_balances_quantity_nonnegative;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260709013000_allow_negative_stock_balance_for_reversals',
  'Removed stock_balances nonnegative quantity constraint so authorized invoice reversals can reflect negative stock when received goods were already consumed.'
)
on conflict (migration_name) do nothing;

commit;
