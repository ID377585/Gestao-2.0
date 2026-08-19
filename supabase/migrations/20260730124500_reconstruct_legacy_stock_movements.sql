begin;

-- Legacy Production had stock_movements before the tracked migration history.
-- Reconstruct the current contract so a new staging/restore environment can be
-- created solely from migrations before the RLS consolidation that follows.
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit_label text not null,
  qty_delta numeric not null,
  reason text not null default 'adjustment',
  source text not null default 'api',
  created_at timestamptz not null default now(),
  created_by uuid null
);

create index if not exists idx_stock_movements_establishment_id
  on public.stock_movements(establishment_id);
create index if not exists idx_stock_movements_product_id
  on public.stock_movements(product_id);

alter table public.stock_movements enable row level security;
alter table public.stock_movements force row level security;

revoke all privileges on table public.stock_movements from anon, authenticated;
grant select, insert, update, delete on table public.stock_movements to authenticated;
grant all privileges on table public.stock_movements to service_role;

commit;
