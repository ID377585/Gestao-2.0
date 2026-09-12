-- Serialize capacity-increasing writes so concurrent requests cannot both pass
-- the same entitlement count. No existing tenant row is deleted.
begin;
create table if not exists private.contract_capacity_locks (
  establishment_id uuid primary key,
  revision bigint not null default 0
);
revoke all on private.contract_capacity_locks from public, anon, authenticated;

create or replace function private.enforce_contract_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  target_id uuid := new.establishment_id;
  entitlement public.establishment_entitlements%rowtype;
  capacity integer;
  used_count bigint;
  is_existing boolean;
begin
  if target_id is null then return new; end if;
  if tg_table_name = 'memberships' and new.is_active is not true then return new; end if;
  if tg_op = 'UPDATE' and new.establishment_id is not distinct from old.establishment_id then
    if tg_table_name <> 'memberships' then return new; end if;
    if old.is_active is true then return new; end if;
  end if;

  select * into entitlement from public.establishment_entitlements
  where establishment_id = target_id and effective_at <= now()
    and (expires_at is null or expires_at > now());
  if not found then return new; end if;

  capacity := case tg_table_name
    when 'products' then entitlement.max_products
    when 'technical_sheets' then entitlement.max_technical_sheets
    when 'memberships' then entitlement.max_users
    else null end;
  if capacity is null then return new; end if;

  insert into private.contract_capacity_locks as locks (establishment_id, revision)
  values (target_id, 1)
  on conflict (establishment_id) do update set revision = locks.revision + 1;

  if tg_table_name = 'memberships' then
    select exists(select 1 from public.memberships
      where id = new.id and establishment_id = target_id and is_active is true)
    into is_existing;
    if is_existing then return new; end if;
    select count(*) into used_count from public.memberships
      where establishment_id = target_id and is_active is true;
  else
    execute format('select exists(select 1 from public.%I where id=$1 and establishment_id=$2)', tg_table_name)
      into is_existing using new.id, target_id;
    if is_existing then return new; end if;
    execute format('select count(*) from public.%I where establishment_id=$1', tg_table_name)
      into used_count using target_id;
  end if;

  if used_count >= capacity then
    raise exception using errcode = '23514',
      message = format('Limite contratual de %s atingido (%s/%s).', tg_table_name, used_count, capacity);
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_contract_capacity() from public, anon, authenticated;

create or replace trigger enforce_product_contract_capacity
before insert or update on public.products
for each row execute function private.enforce_contract_capacity();
create or replace trigger enforce_sheet_contract_capacity
before insert or update on public.technical_sheets
for each row execute function private.enforce_contract_capacity();
create or replace trigger enforce_member_contract_capacity
before insert or update on public.memberships
for each row execute function private.enforce_contract_capacity();
commit;
