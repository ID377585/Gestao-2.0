-- Public demo lead capture is written only by trusted server code.
-- The table has no direct API policies for anon/authenticated clients.

create table if not exists public.demo_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  email text not null check (char_length(trim(email)) between 3 and 254),
  whatsapp text not null check (char_length(trim(whatsapp)) between 8 and 32),
  establishment_name text not null check (char_length(trim(establishment_name)) between 2 and 180),
  business_type text not null check (char_length(trim(business_type)) between 2 and 80),
  need text not null check (char_length(trim(need)) between 2 and 120),
  message text check (message is null or char_length(message) <= 2000),
  source text not null default 'site_publico',
  contact_preference text not null default 'whatsapp'
    check (contact_preference in ('whatsapp', 'email')),
  consent_terms boolean not null default false check (consent_terms is true),
  consent_marketing boolean not null default false,
  user_agent text,
  ip_hash text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_leads_created_at_idx
  on public.demo_leads (created_at desc);

create index if not exists demo_leads_email_created_at_idx
  on public.demo_leads (lower(email), created_at desc);

create index if not exists demo_leads_status_created_at_idx
  on public.demo_leads (status, created_at desc);

drop trigger if exists set_demo_leads_updated_at on public.demo_leads;
create trigger set_demo_leads_updated_at
before update on public.demo_leads
for each row
execute function public.update_updated_at_column();

alter table public.demo_leads enable row level security;

revoke all on table public.demo_leads from anon, authenticated;
grant select, insert, update, delete on table public.demo_leads to service_role;

comment on table public.demo_leads is
  'Public website demonstration leads. Direct browser access is denied by grants and RLS.';
comment on column public.demo_leads.ip_hash is
  'One-way hash of request IP for abuse investigation without storing raw IP.';

do $$
begin
  if to_regprocedure('public.advance_order_status(uuid, public.order_status, text)') is not null then
    execute 'revoke all on function public.advance_order_status(uuid, public.order_status, text) from public, anon';
    execute 'grant execute on function public.advance_order_status(uuid, public.order_status, text) to authenticated, service_role';
  end if;

  if to_regprocedure('public.cancel_order(uuid, text)') is not null then
    execute 'revoke all on function public.cancel_order(uuid, text) from public, anon';
    execute 'grant execute on function public.cancel_order(uuid, text) to authenticated, service_role';
  end if;

  if to_regprocedure('public.reopen_order(uuid, text)') is not null then
    execute 'revoke all on function public.reopen_order(uuid, text) from public, anon';
    execute 'grant execute on function public.reopen_order(uuid, text) to authenticated, service_role';
  end if;

  if to_regprocedure('public.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text)') is not null then
    execute 'revoke all on function public.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text) from public, anon';
    execute 'grant execute on function public.gestify_ensure_stock_balance_for_product(uuid, uuid, text, text) to authenticated, service_role';
  end if;
end $$;
