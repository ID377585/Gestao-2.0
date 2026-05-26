begin;

create table if not exists public.sales_price_benchmarks (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  dish_type text not null default 'Prato Principal' check (dish_type in ('Entrada', 'Prato Principal', 'Sobremesa')),
  manual_sale_price numeric,
  restaurant_1_price numeric,
  restaurant_2_price numeric,
  restaurant_3_price numeric,
  restaurant_4_price numeric,
  restaurant_5_price numeric,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_price_benchmarks_unique_product unique (establishment_id, product_id),
  constraint sales_price_benchmarks_non_negative check (
    coalesce(manual_sale_price, 0) >= 0 and
    coalesce(restaurant_1_price, 0) >= 0 and
    coalesce(restaurant_2_price, 0) >= 0 and
    coalesce(restaurant_3_price, 0) >= 0 and
    coalesce(restaurant_4_price, 0) >= 0 and
    coalesce(restaurant_5_price, 0) >= 0
  )
);

create index if not exists sales_price_benchmarks_establishment_idx
  on public.sales_price_benchmarks(establishment_id);

create index if not exists sales_price_benchmarks_product_idx
  on public.sales_price_benchmarks(product_id);

alter table public.sales_price_benchmarks enable row level security;

drop policy if exists "sales_price_benchmarks_select_members" on public.sales_price_benchmarks;
drop policy if exists "sales_price_benchmarks_insert_members" on public.sales_price_benchmarks;
drop policy if exists "sales_price_benchmarks_update_members" on public.sales_price_benchmarks;
drop policy if exists "sales_price_benchmarks_delete_members" on public.sales_price_benchmarks;

create policy "sales_price_benchmarks_select_members"
  on public.sales_price_benchmarks
  for select
  using (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = sales_price_benchmarks.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  );

create policy "sales_price_benchmarks_insert_members"
  on public.sales_price_benchmarks
  for insert
  with check (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = sales_price_benchmarks.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  );

create policy "sales_price_benchmarks_update_members"
  on public.sales_price_benchmarks
  for update
  using (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = sales_price_benchmarks.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = sales_price_benchmarks.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  );

create policy "sales_price_benchmarks_delete_members"
  on public.sales_price_benchmarks
  for delete
  using (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = sales_price_benchmarks.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  );

commit;
