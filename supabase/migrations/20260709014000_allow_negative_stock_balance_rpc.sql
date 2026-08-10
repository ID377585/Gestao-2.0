begin;

-- The earlier migration creates this exact signature returning
-- SETOF public.stock_balances. PostgreSQL cannot change a function return type
-- with CREATE OR REPLACE, so a clean bootstrap must replace the signature
-- explicitly. No CASCADE is used: unexpected dependencies fail closed.
drop function if exists public.fn_upsert_stock_balance(
  uuid,
  uuid,
  numeric,
  text
);

create function public.fn_upsert_stock_balance(
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

-- Functions are executable by PUBLIC by default. Stock mutations must never be
-- callable by anonymous sessions, while authenticated application flows and
-- service maintenance retain explicit access.
revoke all on function public.fn_upsert_stock_balance(
  uuid,
  uuid,
  numeric,
  text
) from public, anon, authenticated;

grant execute on function public.fn_upsert_stock_balance(
  uuid,
  uuid,
  numeric,
  text
) to authenticated, service_role;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260709014000_allow_negative_stock_balance_rpc',
  'Recreated fn_upsert_stock_balance with its new table return type, allowed existing stock balance rows to become negative for authorized reversals, and removed anonymous execution.'
)
on conflict (migration_name) do nothing;

commit;
