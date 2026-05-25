-- Operational notifications engine
-- Creates a standalone notification center for financial, stock, purchase and operational alerts.
-- Safe to run before the business tables exist: business-specific checks are dynamic and skipped when tables/columns are missing.

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz,
  user_id uuid,
  type text not null,
  priority text not null default 'normal' check (priority in ('critical', 'high', 'normal', 'info')),
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  action_url text,
  dedupe_key text
);

create unique index if not exists notifications_dedupe_key_idx
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
create index if not exists notifications_unread_idx on public.notifications (read_at) where read_at is null;
create index if not exists notifications_priority_idx on public.notifications (priority, created_at desc);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sound_enabled boolean not null default true,
  critical_sound_enabled boolean not null default true,
  browser_push_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.notification_thresholds (
  key text primary key,
  value numeric not null,
  description text not null,
  updated_at timestamptz not null default now()
);

insert into public.notification_thresholds (key, value, description) values
  ('stock_idle_days', 30, 'Dias sem movimentação para considerar produto parado'),
  ('purchase_above_average_percent', 15, 'Percentual acima do preço médio para alertar compra cara'),
  ('high_loss_value', 100, 'Valor absoluto de perda para alerta alto'),
  ('low_stock_quantity', 5, 'Quantidade mínima padrão para estoque baixo'),
  ('plan_due_days', 7, 'Dias antes do vencimento do plano para alertar')
on conflict (key) do nothing;

create or replace function public.create_notification(
  p_type text,
  p_priority text,
  p_title text,
  p_message text,
  p_payload jsonb default '{}'::jsonb,
  p_user_id uuid default null,
  p_action_url text default null,
  p_dedupe_key text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (
    type,
    priority,
    title,
    message,
    payload,
    user_id,
    action_url,
    dedupe_key
  ) values (
    p_type,
    coalesce(nullif(p_priority, ''), 'normal'),
    p_title,
    p_message,
    coalesce(p_payload, '{}'::jsonb),
    p_user_id,
    p_action_url,
    p_dedupe_key
  )
  on conflict (dedupe_key) where dedupe_key is not null do update set
    created_at = excluded.created_at,
    priority = excluded.priority,
    title = excluded.title,
    message = excluded.message,
    payload = excluded.payload,
    read_at = null,
    archived_at = null
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.mark_notification_read(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set read_at = now() where id = p_id;
$$;

create or replace function public.mark_all_notifications_read(p_user_id uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
     set read_at = now()
   where read_at is null
     and (p_user_id is null or user_id = p_user_id);
$$;

create or replace function public.run_notification_checks()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_idle_days numeric := coalesce((select value from public.notification_thresholds where key = 'stock_idle_days'), 30);
  v_purchase_percent numeric := coalesce((select value from public.notification_thresholds where key = 'purchase_above_average_percent'), 15);
  v_loss_value numeric := coalesce((select value from public.notification_thresholds where key = 'high_loss_value'), 100);
  v_low_stock numeric := coalesce((select value from public.notification_thresholds where key = 'low_stock_quantity'), 5);
  v_plan_due_days numeric := coalesce((select value from public.notification_thresholds where key = 'plan_due_days'), 7);
begin
  -- Produtos parados em estoque: expects inventory_items(id, name, quantity, last_movement_at, active).
  begin
    if to_regclass('public.inventory_items') is not null then
      execute format($sql$
        insert into public.notifications (type, priority, title, message, payload, dedupe_key)
        select
          'stock_idle',
          'high',
          'Produto parado em estoque',
          concat(coalesce(name, 'Produto'), ' sem movimentação há ', floor(extract(epoch from (now() - last_movement_at)) / 86400), ' dias.'),
          jsonb_build_object('item_id', id, 'product_name', name, 'quantity', quantity, 'last_movement_at', last_movement_at),
          concat('stock_idle:', id)
        from public.inventory_items
        where coalesce(active, true) = true
          and coalesce(quantity, 0) > 0
          and last_movement_at < now() - (%L || ' days')::interval
        on conflict (dedupe_key) where dedupe_key is not null do update set
          created_at = excluded.created_at,
          title = excluded.title,
          message = excluded.message,
          payload = excluded.payload,
          read_at = null
      $sql$, v_idle_days);
      v_result := v_result || jsonb_build_array('stock_idle checked');
    else
      v_result := v_result || jsonb_build_array('stock_idle skipped: inventory_items not found');
    end if;
  exception when others then
    v_result := v_result || jsonb_build_array('stock_idle skipped: ' || sqlerrm);
  end;

  -- Estoque baixo: expects inventory_items(id, name, quantity, active).
  begin
    if to_regclass('public.inventory_items') is not null then
      execute format($sql$
        insert into public.notifications (type, priority, title, message, payload, dedupe_key)
        select
          'low_stock',
          case when coalesce(quantity, 0) <= 0 then 'critical' else 'high' end,
          case when coalesce(quantity, 0) <= 0 then 'Estoque zerado ou negativo' else 'Estoque baixo' end,
          concat(coalesce(name, 'Produto'), ' com quantidade atual de ', coalesce(quantity, 0), '.'),
          jsonb_build_object('item_id', id, 'product_name', name, 'quantity', quantity),
          concat('low_stock:', id)
        from public.inventory_items
        where coalesce(active, true) = true
          and coalesce(quantity, 0) <= %L
        on conflict (dedupe_key) where dedupe_key is not null do update set
          created_at = excluded.created_at,
          priority = excluded.priority,
          title = excluded.title,
          message = excluded.message,
          payload = excluded.payload,
          read_at = null
      $sql$, v_low_stock);
      v_result := v_result || jsonb_build_array('low_stock checked');
    end if;
  exception when others then
    v_result := v_result || jsonb_build_array('low_stock skipped: ' || sqlerrm);
  end;

  -- Compra acima do preço médio: expects purchase_items(id, product_id, product_name, unit_price, average_unit_price, created_at).
  begin
    if to_regclass('public.purchase_items') is not null then
      execute format($sql$
        insert into public.notifications (type, priority, title, message, payload, dedupe_key)
        select
          'purchase_above_average',
          'high',
          'Produto comprado acima do preço médio',
          concat(coalesce(product_name, 'Produto'), ' comprado por ', unit_price, ', acima do preço médio ', average_unit_price, '.'),
          jsonb_build_object('purchase_item_id', id, 'product_id', product_id, 'product_name', product_name, 'unit_price', unit_price, 'average_unit_price', average_unit_price),
          concat('purchase_above_average:', id)
        from public.purchase_items
        where created_at >= now() - interval '7 days'
          and average_unit_price > 0
          and unit_price > average_unit_price * (1 + (%L / 100.0))
        on conflict (dedupe_key) where dedupe_key is not null do nothing
      $sql$, v_purchase_percent);
      v_result := v_result || jsonb_build_array('purchase_above_average checked');
    else
      v_result := v_result || jsonb_build_array('purchase_above_average skipped: purchase_items not found');
    end if;
  exception when others then
    v_result := v_result || jsonb_build_array('purchase_above_average skipped: ' || sqlerrm);
  end;

  -- Perdas altas: expects losses(id, product_name, quantity, total_value, created_at).
  begin
    if to_regclass('public.losses') is not null then
      execute format($sql$
        insert into public.notifications (type, priority, title, message, payload, dedupe_key)
        select
          'high_loss',
          'critical',
          'Perda alta registrada',
          concat('Perda de ', coalesce(product_name, 'produto'), ' no valor de ', total_value, '.'),
          jsonb_build_object('loss_id', id, 'product_name', product_name, 'quantity', quantity, 'total_value', total_value),
          concat('high_loss:', id)
        from public.losses
        where created_at >= now() - interval '7 days'
          and coalesce(total_value, 0) >= %L
        on conflict (dedupe_key) where dedupe_key is not null do nothing
      $sql$, v_loss_value);
      v_result := v_result || jsonb_build_array('high_loss checked');
    else
      v_result := v_result || jsonb_build_array('high_loss skipped: losses not found');
    end if;
  exception when others then
    v_result := v_result || jsonb_build_array('high_loss skipped: ' || sqlerrm);
  end;

  -- Planos vencendo: expects plans(id, customer_name, due_date, status).
  begin
    if to_regclass('public.plans') is not null then
      execute format($sql$
        insert into public.notifications (type, priority, title, message, payload, dedupe_key)
        select
          'plan_due',
          'high',
          'Plano próximo do vencimento',
          concat('Plano de ', coalesce(customer_name, 'cliente'), ' vence em ', due_date, '.'),
          jsonb_build_object('plan_id', id, 'customer_name', customer_name, 'due_date', due_date, 'status', status),
          concat('plan_due:', id)
        from public.plans
        where due_date between current_date and current_date + (%L || ' days')::interval
          and coalesce(status, 'active') in ('active', 'ativo')
        on conflict (dedupe_key) where dedupe_key is not null do update set
          created_at = excluded.created_at,
          message = excluded.message,
          payload = excluded.payload,
          read_at = null
      $sql$, v_plan_due_days);
      v_result := v_result || jsonb_build_array('plan_due checked');
    else
      v_result := v_result || jsonb_build_array('plan_due skipped: plans not found');
    end if;
  exception when others then
    v_result := v_result || jsonb_build_array('plan_due skipped: ' || sqlerrm);
  end;

  return v_result;
end;
$$;

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_thresholds enable row level security;

-- Policies are intentionally permissive for authenticated users. Tighten user_id rules if notifications must be private per employee.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'Authenticated users can read notifications') then
    create policy "Authenticated users can read notifications"
      on public.notifications for select
      to authenticated
      using (user_id is null or user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'Authenticated users can update notifications') then
    create policy "Authenticated users can update notifications"
      on public.notifications for update
      to authenticated
      using (user_id is null or user_id = auth.uid())
      with check (user_id is null or user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'Users manage own notification preferences') then
    create policy "Users manage own notification preferences"
      on public.notification_preferences for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_thresholds' and policyname = 'Authenticated users can read thresholds') then
    create policy "Authenticated users can read thresholds"
      on public.notification_thresholds for select
      to authenticated
      using (true);
  end if;
end $$;

-- Realtime setup: run this once after migration if your project publication does not already include the table.
-- alter publication supabase_realtime add table public.notifications;
