begin;

-- Keep order identity stable even if operational metadata is updated later.
create or replace function public.gestify_prevent_order_identity_change()
returns trigger
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.id is distinct from old.id
    or new.establishment_id is distinct from old.establishment_id
    or new.created_by is distinct from old.created_by
    or new.customer_user_id is distinct from old.customer_user_id
    or new.order_number is distinct from old.order_number
  then
    raise exception 'Campos de identidade do pedido não podem ser alterados'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists gestify_prevent_order_identity_change
  on public.orders;

create trigger gestify_prevent_order_identity_change
before update on public.orders
for each row
execute function public.gestify_prevent_order_identity_change();

-- Hosted environments may already contain these RPCs, while a clean replay
-- creates their canonical, tenant-safe definitions in a later migration.
-- Harden grants only for signatures that exist at this point in history.
do $$
begin
  if to_regprocedure('public.advance_order_status(uuid, public.order_status, text)') is not null then
    execute 'revoke all on function public.advance_order_status(uuid, public.order_status, text) from public, anon';
    execute 'grant execute on function public.advance_order_status(uuid, public.order_status, text) to authenticated, service_role';
  end if;

  if to_regprocedure('public.cancel_order(uuid, text)') is not null then
    execute 'revoke all on function public.cancel_order(uuid, text) from public, anon';
    execute 'grant execute on function public.cancel_order(uuid, text) to authenticated, service_role';
  end if;

  if to_regprocedure('public.reopen_order(uuid, text)') is not null then
    execute 'revoke all on function public.reopen_order(uuid, text) from public, anon';
    execute 'grant execute on function public.reopen_order(uuid, text) to authenticated, service_role';
  end if;
end $$;

-- Remove only the broadest legacy policies. This does not replace the whole
-- orders/timeline RLS matrix during active production use.
drop policy if exists "orders_insert_authenticated" on public.orders;
drop policy if exists "update_orders" on public.orders;
drop policy if exists "order_status_events_update_staff" on public.order_status_events;

do $$
begin
  if to_regclass('public.products_cost_backup_20260527') is not null then
    revoke all privileges on table public.products_cost_backup_20260527
      from public, anon, authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
