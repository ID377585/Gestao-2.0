begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

revoke all on table public.nutrition_audit_events from authenticated;
grant select, insert on table public.nutrition_audit_events to authenticated;
drop policy if exists nutrition_audit_events_staff_update on public.nutrition_audit_events;

notify pgrst, 'reload schema';

commit;
