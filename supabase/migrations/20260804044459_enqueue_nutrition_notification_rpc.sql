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
set search_path = private, public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_establishment_id is null then
    raise exception 'establishment_id is required';
  end if;

  if (select auth.uid()) is null then
    raise exception 'authenticated user required';
  end if;

  if not (select private.gestify_is_establishment_member(p_establishment_id)) then
    raise exception 'establishment access denied';
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
    payload
  )
  values (
    p_establishment_id,
    p_target_user_id,
    p_type,
    case when p_priority in ('low', 'normal', 'high', 'critical') then p_priority else 'normal' end,
    p_title,
    p_message,
    p_resource_type,
    p_resource_id,
    p_due_at,
    p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (establishment_id, dedupe_key)
  where dedupe_key is not null
  do update set
    updated_at = now(),
    payload = public.nutrition_notifications.payload || excluded.payload
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.enqueue_nutrition_notification(
  uuid, text, text, text, text, text, uuid, uuid, timestamptz, text, jsonb
) from public, anon, authenticated;

grant execute on function public.enqueue_nutrition_notification(
  uuid, text, text, text, text, text, uuid, uuid, timestamptz, text, jsonb
) to authenticated, service_role;

notify pgrst, 'reload schema';
