begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- These HR tables are created after the earlier anonymous-grant cleanup. Keep
-- the replayed schema aligned with the hosted project: authenticated access is
-- controlled by RLS, while anon and PUBLIC receive no table privileges.
revoke all privileges on table public.hr_bank_hours
  from public, anon;
revoke all privileges on table public.hr_employee_schedules
  from public, anon;
revoke all privileges on table public.hr_holidays
  from public, anon;
revoke all privileges on table public.hr_time_clock_adjustments
  from public, anon;
revoke all privileges on table public.hr_time_clock_events
  from public, anon;
revoke all privileges on table public.hr_time_clock_settings
  from public, anon;
revoke all privileges on table public.hr_time_clock_shifts
  from public, anon;

-- The hosted database has RLS enabled on these core tables, but the historical
-- replay did not consistently preserve that state. Re-enable it without FORCE
-- so the replay matches the live contract and existing owner-side maintenance.
alter table if exists public.establishment_memberships
  enable row level security;
alter table if exists public.establishments
  enable row level security;
alter table if exists public.inventory_labels
  enable row level security;
alter table if exists public.inventory_movements
  enable row level security;
alter table if exists public.memberships
  enable row level security;
alter table if exists public.order_invoice_items
  enable row level security;
alter table if exists public.order_invoices
  enable row level security;
alter table if exists public.order_items
  enable row level security;
alter table if exists public.order_line_items
  enable row level security;
alter table if exists public.products
  enable row level security;
alter table if exists public.profiles
  enable row level security;
alter table if exists public.technical_sheets
  enable row level security;
alter table if exists public.user_notification_preferences
  enable row level security;

-- This legacy SECURITY DEFINER helper may still be referenced by historical
-- policies in a clean replay. Preserve authenticated policy execution, but do
-- not expose it to anonymous or implicit PUBLIC callers.
do $block$
begin
  if pg_catalog.to_regprocedure(
    'public.current_user_can_manage_establishment(uuid)'
  ) is not null then
    revoke all on function public.current_user_can_manage_establishment(uuid)
      from public, anon;
    grant execute on function public.current_user_can_manage_establishment(uuid)
      to authenticated, service_role;
  end if;
end;
$block$;

notify pgrst, 'reload schema';

commit;
