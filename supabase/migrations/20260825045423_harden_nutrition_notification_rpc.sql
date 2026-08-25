-- Version the hardened SECURITY DEFINER contract already observed in Production.
-- No tenant data is changed by this migration.

begin;

create or replace function public.enqueue_nutrition_notification(
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
security definer
set search_path = private, public, auth, pg_temp
as $function$
declare
  v_id uuid;
  v_uid uuid := (select auth.uid());
  v_request_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (select auth.role()),
    current_role
  );
  v_membership_role text;
  v_explicit_permission boolean;
  v_permission_found boolean := false;
  v_can_access boolean := false;
begin
  if p_establishment_id is null then
    raise exception 'establishment_id is required'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_type, '')), '') is null
     or length(p_type) > 100 then
    raise exception 'invalid notification type'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null
     or length(p_title) > 240 then
    raise exception 'invalid notification title'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_message, '')), '') is null
     or length(p_message) > 4000 then
    raise exception 'invalid notification message'
      using errcode = '22023';
  end if;

  if p_resource_type is not null and length(p_resource_type) > 100 then
    raise exception 'invalid resource type'
      using errcode = '22023';
  end if;

  if p_dedupe_key is not null and length(p_dedupe_key) > 240 then
    raise exception 'invalid dedupe key'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 32768 then
    raise exception 'invalid notification payload'
      using errcode = '22023';
  end if;

  if v_request_role <> 'service_role' then
    if v_uid is null then
      raise exception 'authenticated user required'
        using errcode = '42501';
    end if;

    select membership.role
      into v_membership_role
    from (
      select m.role::text as role, 1 as source_priority, m.created_at
      from public.memberships m
      where m.establishment_id = p_establishment_id
        and m.user_id = v_uid
        and coalesce(m.is_active, true) = true

      union all

      select em.role::text as role, 2 as source_priority, em.created_at
      from public.establishment_memberships em
      where em.establishment_id = p_establishment_id
        and em.user_id = v_uid
        and coalesce(em.is_active, true) = true
    ) membership
    order by membership.source_priority, membership.created_at desc
    limit 1;

    if v_membership_role is null then
      raise exception 'establishment access denied'
        using errcode = '42501';
    end if;

    select ump.can_access
      into v_explicit_permission
    from public.user_module_permissions ump
    where ump.establishment_id = p_establishment_id
      and ump.user_id = v_uid
      and ump.module_key = 'nutricao'
    limit 1;

    v_permission_found := found;
    v_can_access := case
      when v_permission_found then coalesce(v_explicit_permission, false)
      else v_membership_role = 'admin'
    end;

    if not v_can_access then
      raise exception 'nutrition module access denied'
        using errcode = '42501';
    end if;
  end if;

  if p_target_user_id is not null and not exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = p_target_user_id
      and coalesce(m.is_active, true) = true

    union all

    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = p_target_user_id
      and coalesce(em.is_active, true) = true
  ) then
    raise exception 'notification target is outside establishment'
      using errcode = '42501';
  end if;

  insert into public.nutrition_notifications (
    establishment_id,
    target_user_id,
    notification_type,
    priority,
    title,
    message,
    resource_type,
    resource_id,
    due_at,
    dedupe_key,
    payload,
    created_by
  )
  values (
    p_establishment_id,
    p_target_user_id,
    trim(p_type),
    case
      when p_priority in ('low', 'normal', 'high', 'critical') then p_priority
      else 'normal'
    end,
    trim(p_title),
    trim(p_message),
    nullif(trim(coalesce(p_resource_type, '')), ''),
    p_resource_id,
    p_due_at,
    nullif(trim(coalesce(p_dedupe_key, '')), ''),
    coalesce(p_payload, '{}'::jsonb),
    v_uid
  )
  on conflict (establishment_id, dedupe_key)
  where dedupe_key is not null
  do update set
    updated_at = now(),
    priority = excluded.priority,
    title = excluded.title,
    message = excluded.message,
    due_at = excluded.due_at,
    target_user_id = excluded.target_user_id,
    payload = public.nutrition_notifications.payload || excluded.payload
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all privileges on function public.enqueue_nutrition_notification(uuid,text,text,text,text,text,uuid,uuid,timestamptz,text,jsonb) from public;
revoke all privileges on function public.enqueue_nutrition_notification(uuid,text,text,text,text,text,uuid,uuid,timestamptz,text,jsonb) from anon;
grant execute on function public.enqueue_nutrition_notification(uuid,text,text,text,text,text,uuid,uuid,timestamptz,text,jsonb) to authenticated;
grant execute on function public.enqueue_nutrition_notification(uuid,text,text,text,text,text,uuid,uuid,timestamptz,text,jsonb) to service_role;

commit;
