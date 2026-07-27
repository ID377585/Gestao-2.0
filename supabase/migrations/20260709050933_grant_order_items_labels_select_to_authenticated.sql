begin;

-- RLS policies already restrict rows by order/establishment membership, but the
-- authenticated role also needs table-level SELECT to read collected order items.
grant select on table public.order_items_labels to authenticated;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260709050933_grant_order_items_labels_select_to_authenticated',
  'Granted SELECT on order_items_labels to authenticated so order detail pages can load collected items under existing RLS policies.'
)
on conflict (migration_name) do nothing;

commit;
