begin;

-- The foundation migration defines this signature as `returns setof stock_balances`.
-- PostgreSQL cannot change a function return type with CREATE OR REPLACE, so a
-- fresh migration replay must drop the old signature before recreating it.
drop function if exists public.fn_upsert_stock_balance(uuid, uuid, numeric, text);

create or replace function public.fn_upsert_stock_balance(
  p_establishment_id uuid,
  p_product_id uuid,
  p_qty_delta numeric,
  p_unit_label text
)
returns table(id uuid, quantity numeric)
language plpgsql
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_unit text := coalesce(upper(trim(p_unit_label)), 'UN');
  v_id uuid;
  v_qty numeric;
begin
  update public.stock_balances sb
  set
    quantity = sb.quantity + p_qty_delta,
    unit_label = coalesce(upper(trim(sb.unit_label)), 'UN'),
    updated_at = now()
  where sb.product_id = p_product_id
    and sb.establishment_id = p_establishment_id
    and coalesce(upper(trim(sb.unit_label)), 'UN') = v_unit
  returning sb.id, sb.quantity into v_id, v_qty;

  if found then
    return query select v_id, v_qty;
    return;
  end if;

  if p_qty_delta < 0 then
    raise exception 'Operação inválida: tentativa de reduzir saldo em % sem registro existente.', p_qty_delta;
  end if;

  insert into public.stock_balances (
    establishment_id,
    product_id,
    unit_label,
    quantity,
    min_qty,
    med_qty,
    max_qty,
    location,
    created_at,
    updated_at
  )
  values (
    p_establishment_id,
    p_product_id,
    v_unit,
    p_qty_delta,
    0,
    0,
    0,
    'Estoque Principal',
    now(),
    now()
  )
  returning stock_balances.id, stock_balances.quantity into v_id, v_qty;

  return query select v_id, v_qty;
end;
$function$;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260709014000_allow_negative_stock_balance_rpc',
  'Updated fn_upsert_stock_balance to allow existing stock balance rows to become negative, enabling authorized invoice reversals after stock consumption.'
)
on conflict (migration_name) do nothing;

commit;
