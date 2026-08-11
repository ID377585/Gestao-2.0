begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- The hosted database already applies every inventory movement to the materialized
-- stock balance through this trigger. The function/trigger were missing from the
-- migration history, so a clean replay recorded the movement but left
-- public.stock_balances unchanged.
create or replace function public.apply_inventory_movement_to_stock_balances()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_location text;
begin
  v_location := coalesce(nullif(pg_catalog.btrim(new.location), ''), 'Estoque Principal');

  insert into public.stock_balances (
    establishment_id,
    product_id,
    unit_label,
    quantity,
    location,
    updated_at
  )
  values (
    new.establishment_id,
    new.product_id,
    new.unit_label,
    new.qty_delta,
    v_location,
    pg_catalog.now()
  )
  on conflict (establishment_id, product_id, unit_label)
  do update set
    quantity = public.stock_balances.quantity + excluded.quantity,
    location = coalesce(public.stock_balances.location, excluded.location),
    updated_at = pg_catalog.now();

  return new;
end;
$function$;

drop trigger if exists trg_inventory_movements_apply_balance
  on public.inventory_movements;

create trigger trg_inventory_movements_apply_balance
after insert on public.inventory_movements
for each row
execute function public.apply_inventory_movement_to_stock_balances();

comment on function public.apply_inventory_movement_to_stock_balances() is
  'Applies inventory_movements.qty_delta exactly once to the tenant-scoped stock balance.';

comment on trigger trg_inventory_movements_apply_balance
  on public.inventory_movements is
  'Canonical stock balance mutation path for inventory movements, including labeled losses.';

notify pgrst, 'reload schema';

commit;
