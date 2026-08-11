begin;

-- The hosted database contains this operational audit table, but its original
-- creation was not captured in the replayable migration history. Reconstruct
-- the empty contract before the append-only hardening migration protects it.
create table if not exists public.stock_balance_audit (
  id uuid primary key default gen_random_uuid(),
  stock_balance_id uuid null,
  establishment_id uuid not null,
  product_id uuid not null,
  user_id uuid null,
  qty_delta numeric null,
  qty_before numeric null,
  qty_after numeric null,
  reason text null,
  created_at timestamptz null default now(),
  constraint stock_balance_audit_stock_balance_id_fkey
    foreign key (stock_balance_id)
    references public.stock_balances(id)
    on delete set null,
  constraint stock_balance_audit_establishment_id_fkey
    foreign key (establishment_id)
    references public.establishments(id)
    on delete restrict,
  constraint stock_balance_audit_product_id_fkey
    foreign key (product_id)
    references public.products(id)
    on delete restrict,
  constraint stock_balance_audit_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete set null
);

create index if not exists idx_stock_balance_audit_stock_balance_id
  on public.stock_balance_audit (stock_balance_id);
create index if not exists idx_stock_balance_audit_establishment_id
  on public.stock_balance_audit (establishment_id);
create index if not exists idx_stock_balance_audit_product_id
  on public.stock_balance_audit (product_id);
create index if not exists idx_stock_balance_audit_user_id
  on public.stock_balance_audit (user_id);

alter table public.stock_balance_audit enable row level security;
alter table public.stock_balance_audit force row level security;

revoke all privileges on table public.stock_balance_audit
  from public, anon, authenticated;

grant select, insert on table public.stock_balance_audit to service_role;

comment on table public.stock_balance_audit is
  'Append-only operational audit trail for stock balance mutations.';

commit;
