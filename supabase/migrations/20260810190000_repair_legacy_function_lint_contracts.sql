begin;

-- Restore the compatibility helper referenced by the legacy order ownership
-- function. It remains service-role only and is not part of the canonical RLS
-- path used by current order policies.
create or replace function public.order_owner_column()
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_col text;
begin
  select c.column_name
    into v_col
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and c.column_name in (
      'created_by',
      'customer_user_id',
      'customer_id',
      'user_id',
      'owner_id',
      'profile_user_id',
      'profile_id'
    )
  order by case c.column_name
    when 'created_by' then 1
    when 'customer_user_id' then 2
    when 'customer_id' then 3
    when 'user_id' then 4
    when 'owner_id' then 5
    when 'profile_user_id' then 6
    when 'profile_id' then 7
    else 999
  end
  limit 1;

  if v_col is null then
    raise exception 'No order ownership column found in public.orders'
      using errcode = '42703';
  end if;

  return v_col;
end;
$function$;

revoke all on function public.order_owner_column()
  from public, anon, authenticated;
grant execute on function public.order_owner_column()
  to service_role;

-- Recreate the legacy tenant inspection helpers with an unambiguous row loop.
-- The earlier FOREACH/function-call form is valid at runtime but is interpreted
-- incorrectly by the static PL/pgSQL checker used by `supabase db lint`.
create or replace function public.gestify_legacy_tenant_null_counts()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  table_name text;
  v_count bigint;
  v_counts jsonb := '[]'::jsonb;
begin
  for table_name in
    select unnest(private.gestify_legacy_table_names())
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'select count(*) from public.%I where establishment_id is null',
        table_name
      )
      into v_count;

      v_counts := v_counts || jsonb_build_array(
        jsonb_build_object(
          'table', table_name,
          'null_establishment_rows', v_count
        )
      );
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'tables', v_counts);
end;
$function$;

create or replace function public.gestify_backfill_legacy_tenant(
  p_establishment_id uuid,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  table_name text;
  v_missing_rows bigint;
  v_updated_rows bigint;
  v_results jsonb := '[]'::jsonb;
begin
  if p_establishment_id is null then
    raise exception 'p_establishment_id is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.establishments e
    where e.id = p_establishment_id
  ) then
    raise exception 'establishment % not found', p_establishment_id
      using errcode = 'P0002';
  end if;

  for table_name in
    select unnest(private.gestify_legacy_table_names())
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'select count(*) from public.%I where establishment_id is null',
        table_name
      )
      into v_missing_rows;

      if p_dry_run then
        v_updated_rows := 0;
      else
        execute format(
          'update public.%I set establishment_id = $1 where establishment_id is null',
          table_name
        )
        using p_establishment_id;
        get diagnostics v_updated_rows = row_count;
      end if;

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'table', table_name,
          'missing_before', v_missing_rows,
          'updated', v_updated_rows
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'dry_run', p_dry_run,
    'establishment_id', p_establishment_id,
    'tables', v_results
  );
end;
$function$;

revoke all on function public.gestify_legacy_tenant_null_counts()
  from public, anon, authenticated;
grant execute on function public.gestify_legacy_tenant_null_counts()
  to service_role;

revoke all on function public.gestify_backfill_legacy_tenant(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.gestify_backfill_legacy_tenant(uuid, boolean)
  to service_role;

-- Reconstruct the canonical order transition matrix used by the hardened
-- advance_order_status RPC. The hosted database contains this contract, but
-- its creation was not represented in the replayable migration chain.
create table if not exists public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  enabled boolean not null default true,
  constraint order_status_transitions_pkey
    primary key (from_status, to_status)
);

insert into public.order_status_transitions (
  from_status,
  to_status,
  enabled
)
values
  ('pedido_criado', 'aceitou_pedido', true),
  ('aceitou_pedido', 'em_preparo', true),
  ('em_preparo', 'em_separacao', true),
  ('em_separacao', 'em_faturamento', true),
  ('em_faturamento', 'em_transporte', true),
  ('em_transporte', 'entregue', true)
on conflict (from_status, to_status) do update
set enabled = excluded.enabled;

alter table public.order_status_transitions enable row level security;
alter table public.order_status_transitions force row level security;

revoke all privileges on table public.order_status_transitions
  from public, anon, authenticated;
grant select, insert, update, delete on table public.order_status_transitions
  to service_role;

drop policy if exists "gestify_order_status_transitions_read"
  on public.order_status_transitions;
create policy "gestify_order_status_transitions_read"
on public.order_status_transitions
for select
to authenticated
using (true);

comment on table public.order_status_transitions is
  'Canonical enabled transitions used by the tenant-safe order status RPC.';

notify pgrst, 'reload schema';

commit;
