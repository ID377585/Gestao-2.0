begin;

-- Low-risk hardening for helpers already used by order RLS policies.
-- This intentionally does not drop or replace live order policies.

create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path to 'public', 'auth', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.user_id = (select auth.uid())
      and em.is_active = true
      and em.role in (
        'admin'::public.app_role,
        'operacao'::public.app_role,
        'producao'::public.app_role,
        'estoque'::public.app_role,
        'fiscal'::public.app_role,
        'entrega'::public.app_role
      )
  );
$function$;

create or replace function public.my_role_in_establishment(p_establishment_id uuid)
returns public.app_role
language sql
stable
set search_path to 'public', 'auth', 'pg_temp'
as $function$
  select em.role
  from public.establishment_memberships em
  where em.establishment_id = p_establishment_id
    and em.user_id = (select auth.uid())
    and em.is_active = true
  limit 1;
$function$;

create or replace function public.order_belongs_to_user(_order_id uuid, _uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_col text;
  v_ok boolean;
  v_request_uid uuid;
  v_request_role text;
begin
  if _order_id is null or _uid is null then
    return false;
  end if;

  v_request_uid := (select auth.uid());
  v_request_role := (select auth.role());

  if coalesce(v_request_role, '') <> 'service_role'
    and (v_request_uid is null or _uid <> v_request_uid)
  then
    return false;
  end if;

  v_col := public.order_owner_column();

  execute format(
    'select exists (select 1 from public.orders o where o.id = $1 and o.%I = $2)',
    v_col
  )
  into v_ok
  using _order_id, _uid;

  return coalesce(v_ok, false);
end;
$function$;

revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

revoke all on function public.my_role_in_establishment(uuid) from public, anon;
grant execute on function public.my_role_in_establishment(uuid) to authenticated, service_role;

revoke all on function public.order_belongs_to_user(uuid, uuid) from public, anon;
grant execute on function public.order_belongs_to_user(uuid, uuid) to authenticated, service_role;

commit;
