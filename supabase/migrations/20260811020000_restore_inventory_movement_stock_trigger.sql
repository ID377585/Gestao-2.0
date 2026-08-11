begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- The hosted project already contains this trigger, but it was never captured
-- by the migration history. A clean replay therefore persisted labeled
-- inventory movements without applying qty_delta to stock_balances.
do $$
begin
  if to_regclass('public.inventory_movements') is null then
    raise exception 'Required table public.inventory_movements is missing.';
  end if;

  if to_regclass('public.stock_balances') is null then
    raise exception 'Required table public.stock_balances is missing.';
  end if;

  if not exists (
    select 1
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'stock_balances'
      and i.indisunique
      and i.indpred is null
      and (
        select array_agg(a.attname order by key_columns.ordinality)
        from unnest(i.indkey) with ordinality as key_columns(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = i.indrelid
         and a.attnum = key_columns.attnum
      ) = array['establishment_id', 'product_id', 'unit_label']::text[]
  ) then
    raise exception 'stock_balances requires a unique key on (establishment_id, product_id, unit_label).';
  end if;
end $$;

create or replace function public.apply_inventory_movement_to_stock_balances()
returns trigger
language plpgsql
set search_path = public, auth, pg_temp
as $function$
declare
  v_location text;
begin
  v_location := coalesce(nullif(btrim(new.location), ''), 'Estoque Principal');

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
    upper(coalesce(nullif(btrim(new.unit_label), ''), 'UN')),
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

revoke all on function public.apply_inventory_movement_to_stock_balances()
  from public, anon, authenticated;

drop trigger if exists trg_inventory_movements_apply_balance
  on public.inventory_movements;

create trigger trg_inventory_movements_apply_balance
after insert on public.inventory_movements
for each row
execute function public.apply_inventory_movement_to_stock_balances();

comment on function public.apply_inventory_movement_to_stock_balances() is
  'Canonical inventory_movements to stock_balances projection. Applies qty_delta exactly once through an AFTER INSERT trigger.';

comment on trigger trg_inventory_movements_apply_balance
  on public.inventory_movements is
  'Applies each immutable inventory movement to the tenant/product/unit stock balance.';

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260811020000_restore_inventory_movement_stock_trigger',
  'Restored the hosted inventory_movements AFTER INSERT stock balance projection in migration history and fail-closed validation of its unique conflict key.'
)
on conflict (migration_name) do nothing;

notify pgrst, 'reload schema';

commit;
