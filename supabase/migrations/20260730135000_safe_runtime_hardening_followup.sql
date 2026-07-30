begin;

-- Keep schema drift harmless across environments.
alter table if exists public.technical_sheets
  add column if not exists active boolean not null default true;

-- This helper is not used by the current canonical order policies and should not
-- be directly callable from client sessions.
do $$
begin
  if to_regprocedure('public.order_belongs_to_user(uuid, uuid)') is not null then
    revoke all on function public.order_belongs_to_user(uuid, uuid)
      from public, anon, authenticated;
    grant execute on function public.order_belongs_to_user(uuid, uuid)
      to service_role;
  end if;
end $$;

-- Remove a duplicated mutable event policy while leaving the stricter admin
-- policy in place.
drop policy if exists "order_status_events_delete_staff"
  on public.order_status_events;

-- Reinforce production grants required by server-side modules without opening
-- backup or sensitive internal tables.
grant select on table public.user_module_permissions to authenticated;
grant select, insert, update, delete on table public.stock_balances to authenticated;
grant select, insert, update, delete on table public.inventory_sessions to authenticated;

do $$
begin
  if to_regclass('public.products_cost_backup_20260527') is not null then
    revoke all privileges on table public.products_cost_backup_20260527
      from public, anon, authenticated;
  end if;
end $$;

create or replace function public.gestify_ensure_stock_balance_for_product(
  p_establishment_id uuid,
  p_product_id uuid,
  p_unit_label text default 'UN',
  p_default_location text default 'Estoque Principal'
)
returns public.stock_balances
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_balance public.stock_balances%rowtype;
  v_product_unit text;
  v_request_role text;
  v_unit_label text;
  v_location text;
begin
  if p_establishment_id is null or p_product_id is null then
    raise exception 'establishment_id e product_id são obrigatórios'
      using errcode = '22023';
  end if;

  v_request_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (select auth.role()),
    current_role
  );

  if v_request_role <> 'service_role'
    and not (select private.gestify_is_establishment_member(p_establishment_id))
  then
    raise exception 'sem permissão para este estabelecimento'
      using errcode = '42501';
  end if;

  select upper(nullif(trim(p.default_unit_label), ''))
    into v_product_unit
  from public.products p
  where p.id = p_product_id
    and p.establishment_id = p_establishment_id;

  if not found then
    raise exception 'produto inválido para o estabelecimento ativo'
      using errcode = '42501';
  end if;

  v_unit_label := upper(coalesce(nullif(trim(p_unit_label), ''), v_product_unit, 'UN'));
  if v_unit_label not in ('UN', 'KG', 'G', 'L', 'ML') then
    v_unit_label := coalesce(v_product_unit, 'UN');
  end if;

  v_location := coalesce(nullif(trim(p_default_location), ''), 'Estoque Principal');

  perform pg_advisory_xact_lock(
    hashtextextended(p_establishment_id::text || ':' || p_product_id::text, 0)
  );

  select sb.*
    into v_balance
  from public.stock_balances sb
  where sb.establishment_id = p_establishment_id
    and sb.product_id = p_product_id
  order by sb.created_at asc, sb.id asc
  limit 1;

  if found then
    return v_balance;
  end if;

  insert into public.stock_balances (
    establishment_id,
    product_id,
    quantity,
    unit_label,
    min_qty,
    med_qty,
    max_qty,
    location
  )
  values (
    p_establishment_id,
    p_product_id,
    0,
    v_unit_label,
    0,
    0,
    0,
    v_location
  )
  on conflict (establishment_id, product_id, unit_label) do nothing
  returning *
  into v_balance;

  if v_balance.id is not null then
    return v_balance;
  end if;

  select sb.*
    into v_balance
  from public.stock_balances sb
  where sb.establishment_id = p_establishment_id
    and sb.product_id = p_product_id
  order by sb.created_at asc, sb.id asc
  limit 1;

  if v_balance.id is null then
    raise exception 'não foi possível garantir saldo de estoque'
      using errcode = 'P0001';
  end if;

  return v_balance;
end;
$function$;

revoke all on function public.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
