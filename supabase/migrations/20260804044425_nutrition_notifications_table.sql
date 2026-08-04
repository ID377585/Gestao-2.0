create table if not exists public.nutrition_notifications (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  target_user_id uuid null references auth.users(id) on delete set null,
  notification_type text not null,
  priority text not null default 'normal',
  title text not null,
  message text not null,
  resource_type text null,
  resource_id uuid null,
  status text not null default 'pending',
  due_at timestamptz null,
  escalated_at timestamptz null,
  dedupe_key text null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_notifications_type_check check (char_length(btrim(notification_type)) > 0),
  constraint nutrition_notifications_title_check check (char_length(btrim(title)) > 0),
  constraint nutrition_notifications_message_check check (char_length(btrim(message)) > 0),
  constraint nutrition_notifications_priority_check check (
    priority in ('low', 'normal', 'high', 'critical')
  ),
  constraint nutrition_notifications_status_check check (
    status in ('pending', 'sent', 'read', 'dismissed', 'failed')
  )
);

create unique index if not exists nutrition_notifications_dedupe_idx
  on public.nutrition_notifications(establishment_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists nutrition_notifications_tenant_status_idx
  on public.nutrition_notifications(establishment_id, status, created_at desc);

create index if not exists nutrition_notifications_due_idx
  on public.nutrition_notifications(establishment_id, due_at)
  where status = 'pending' and due_at is not null;

alter table public.nutrition_notifications enable row level security;

grant select, update on table public.nutrition_notifications to authenticated;
grant select, insert, update, delete on table public.nutrition_notifications to service_role;
