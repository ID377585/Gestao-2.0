begin;

-- Keep privileged implementations outside PostgREST's exposed public schema.
grant usage on schema private to authenticated, service_role;

-- Order status RPCs ---------------------------------------------------------
alter function public.advance_order_status(uuid, public.order_status, text) set schema private;
alter function private.advance_order_status(uuid, public.order_status, text) rename to advance_order_status_impl;

revoke all on function private.advance_order_status_impl(uuid, public.order_status, text) from public, anon;
grant execute on function private.advance_order_status_impl(uuid, public.order_status, text) to authenticated, service_role;

create function public.advance_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = public, private, auth, pg_temp
as $$
begin
  perform private.advance_order_status_impl(p_order_id, p_to_status, p_note);
end;
$$;

revoke all on function public.advance_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.advance_order_status(uuid, public.order_status, text) to authenticated, service_role;

alter function public.cancel_order(uuid, text) set schema private;
alter function private.cancel_order(uuid, text) rename to cancel_order_impl;

revoke all on function private.cancel_order_impl(uuid, text) from public, anon;
grant execute on function private.cancel_order_impl(uuid, text) to authenticated, service_role;

create function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = public, private, auth, pg_temp
as $$
begin
  perform private.cancel_order_impl(p_order_id, p_reason);
end;
$$;

revoke all on function public.cancel_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text) to authenticated, service_role;

alter function public.reopen_order(uuid, text) set schema private;
alter function private.reopen_order(uuid, text) rename to reopen_order_impl;

revoke all on function private.reopen_order_impl(uuid, text) from public, anon;
grant execute on function private.reopen_order_impl(uuid, text) to authenticated, service_role;

create function public.reopen_order(p_order_id uuid, p_note text default null)
returns void
language plpgsql
security invoker
set search_path = public, private, auth, pg_temp
as $$
begin
  perform private.reopen_order_impl(p_order_id, p_note);
end;
$$;

revoke all on function public.reopen_order(uuid, text) from public, anon;
grant execute on function public.reopen_order(uuid, text) to authenticated, service_role;

-- Stock initialization RPC --------------------------------------------------
alter function public.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text) set schema private;
alter function private.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text) rename to gestify_ensure_stock_balance_for_product_impl;

revoke all on function private.gestify_ensure_stock_balance_for_product_impl(uuid, uuid, text, text) from public, anon;
grant execute on function private.gestify_ensure_stock_balance_for_product_impl(uuid, uuid, text, text) to authenticated, service_role;

create function public.gestify_ensure_stock_balance_for_product(
  p_establishment_id uuid,
  p_product_id uuid,
  p_unit_label text default 'UN',
  p_default_location text default 'Estoque Principal'
)
returns public.stock_balances
language plpgsql
security invoker
set search_path = public, private, auth, pg_temp
as $$
begin
  return private.gestify_ensure_stock_balance_for_product_impl(
    p_establishment_id,
    p_product_id,
    p_unit_label,
    p_default_location
  );
end;
$$;

revoke all on function public.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text) from public, anon;
grant execute on function public.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text) to authenticated, service_role;

-- Nutrition notification RPC ----------------------------------------------
alter function public.enqueue_nutrition_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz, text, jsonb) set schema private;
alter function private.enqueue_nutrition_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz, text, jsonb) rename to enqueue_nutrition_notification_impl;

revoke all on function private.enqueue_nutrition_notification_impl(uuid, text, text, text, text, text, uuid, uuid, timestamptz, text, jsonb) from public, anon;
grant execute on function private.enqueue_nutrition_notification_impl(uuid, text, text, text, text, text, uuid, uuid, timestamptz, text, jsonb) to authenticated, service_role;

create function public.enqueue_nutrition_notification(
  p_establishment_id uuid,
  p_type text,
  p_priority text,
  p_title text,
  p_message text,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_target_user_id uuid default null,
  p_due_at timestamptz default null,
  p_dedupe_key text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, private, auth, pg_temp
as $$
begin
  return private.enqueue_nutrition_notification_impl(
    p_establishment_id,
    p_type,
    p_priority,
    p_title,
    p_message,
    p_resource_type,
    p_resource_id,
    p_target_user_id,
    p_due_at,
    p_dedupe_key,
    p_payload
  );
end;
$$;

revoke all on function public.enqueue_nutrition_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz, text, jsonb) from public, anon;
grant execute on function public.enqueue_nutrition_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz, text, jsonb) to authenticated, service_role;

-- RLS authorization helper. It exists in clean replay/staging but may be absent
-- in older Production states, so keep the migration additive across both.
do $migration$
begin
  if to_regprocedure('public.current_user_can_manage_establishment(uuid)') is not null then
    execute 'alter function public.current_user_can_manage_establishment(uuid) set schema private';
    execute 'alter function private.current_user_can_manage_establishment(uuid) rename to current_user_can_manage_establishment_impl';
    execute 'revoke all on function private.current_user_can_manage_establishment_impl(uuid) from public, anon';
    execute 'grant execute on function private.current_user_can_manage_establishment_impl(uuid) to authenticated, service_role';

    execute $sql$
      create function public.current_user_can_manage_establishment(target_establishment_id uuid)
      returns boolean
      language sql
      stable
      security invoker
      set search_path = public, private, auth, pg_temp
      as 'select private.current_user_can_manage_establishment_impl(target_establishment_id)'
    $sql$;

    execute 'revoke all on function public.current_user_can_manage_establishment(uuid) from public, anon';
    execute 'grant execute on function public.current_user_can_manage_establishment(uuid) to authenticated, service_role';
  end if;
end
$migration$;

-- Legacy ownership helper: keep the callable contract service-role only.
alter function public.order_belongs_to_user(uuid, uuid) set schema private;
alter function private.order_belongs_to_user(uuid, uuid) rename to order_belongs_to_user_impl;

revoke all on function private.order_belongs_to_user_impl(uuid, uuid) from public, anon, authenticated;
grant execute on function private.order_belongs_to_user_impl(uuid, uuid) to service_role;

create function public.order_belongs_to_user(_order_id uuid, _uid uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, pg_temp
as $$
  select private.order_belongs_to_user_impl(_order_id, _uid);
$$;

revoke all on function public.order_belongs_to_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.order_belongs_to_user(uuid, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
