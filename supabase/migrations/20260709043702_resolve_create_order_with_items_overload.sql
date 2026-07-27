begin;

-- Supabase/PostgREST cannot reliably expose overloaded RPCs with the same name.
-- Keep only the secure server-side signature that receives the validated user id.
drop function if exists public.create_order_with_items(uuid, text, jsonb);

revoke all on function public.create_order_with_items(uuid, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.create_order_with_items(uuid, text, jsonb, uuid)
  to service_role;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '20260709043702_resolve_create_order_with_items_overload',
  'Dropped legacy 3-argument create_order_with_items RPC to remove PostgREST overload ambiguity; creation now uses the service-role-only 4-argument RPC with p_user_id.'
)
on conflict (migration_name) do nothing;

commit;
