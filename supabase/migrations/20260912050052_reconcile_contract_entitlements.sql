-- Reconcile the entitlement shape without rewriting individualized module access.
-- Commercial limits are contract data; menu/module authorization remains under
-- user_module_permissions/role when modules = {}.
begin;
alter table public.establishment_entitlements
  add column if not exists billing_policy text not null default 'paid',
  add column if not exists automatic_billing_allowed boolean not null default true,
  add column if not exists plan_reference text,
  add column if not exists contract_type text,
  add column if not exists max_orders integer,
  add column if not exists modules jsonb not null default '{}'::jsonb,
  add column if not exists effective_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz,
  add column if not exists source_ref text;

update public.establishment_entitlements
set billing_policy = 'complimentary',
    automatic_billing_allowed = false,
    plan_reference = 'growth',
    contract_type = 'special_free_license',
    max_establishments = 1,
    max_users = 20,
    max_products = 5000,
    max_technical_sheets = 1000,
    modules = '{}'::jsonb,
    updated_at = now()
where establishment_id = 'fde0f0be-7a6d-4648-bd25-fb964022565d'::uuid;

alter table public.establishment_entitlements enable row level security;
revoke all on public.establishment_entitlements from public, anon, authenticated;
grant select, insert, update, delete on public.establishment_entitlements to service_role;
notify pgrst, 'reload schema';
commit;
