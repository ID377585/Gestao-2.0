begin;

create table if not exists public.product_nutrition_facts (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  serving_basis text not null default '100g',
  calories_kcal numeric not null default 0,
  carbohydrates_g numeric not null default 0,
  total_sugars_g numeric not null default 0,
  added_sugars_g numeric not null default 0,
  proteins_g numeric not null default 0,
  total_fat_g numeric not null default 0,
  saturated_fat_g numeric not null default 0,
  trans_fat_g numeric not null default 0,
  dietary_fiber_g numeric not null default 0,
  sodium_mg numeric not null default 0,
  source text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_nutrition_facts_unique_product unique (establishment_id, product_id),
  constraint product_nutrition_facts_non_negative check (
    calories_kcal >= 0 and
    carbohydrates_g >= 0 and
    total_sugars_g >= 0 and
    added_sugars_g >= 0 and
    proteins_g >= 0 and
    total_fat_g >= 0 and
    saturated_fat_g >= 0 and
    trans_fat_g >= 0 and
    dietary_fiber_g >= 0 and
    sodium_mg >= 0
  )
);

create index if not exists product_nutrition_facts_establishment_idx
  on public.product_nutrition_facts(establishment_id);

create index if not exists product_nutrition_facts_product_idx
  on public.product_nutrition_facts(product_id);

alter table public.product_nutrition_facts enable row level security;

drop policy if exists "product_nutrition_facts_select_members" on public.product_nutrition_facts;
drop policy if exists "product_nutrition_facts_insert_members" on public.product_nutrition_facts;
drop policy if exists "product_nutrition_facts_update_members" on public.product_nutrition_facts;
drop policy if exists "product_nutrition_facts_delete_members" on public.product_nutrition_facts;

create policy "product_nutrition_facts_select_members"
  on public.product_nutrition_facts
  for select
  using (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = product_nutrition_facts.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  );

create policy "product_nutrition_facts_insert_members"
  on public.product_nutrition_facts
  for insert
  with check (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = product_nutrition_facts.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  );

create policy "product_nutrition_facts_update_members"
  on public.product_nutrition_facts
  for update
  using (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = product_nutrition_facts.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = product_nutrition_facts.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  );

create policy "product_nutrition_facts_delete_members"
  on public.product_nutrition_facts
  for delete
  using (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = product_nutrition_facts.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  );

create table if not exists public.technical_sheet_nutrition_snapshots (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  technical_sheet_id uuid not null references public.technical_sheets(id) on delete cascade,
  serving_weight_g numeric not null default 0,
  household_measure text,
  total_recipe_weight_g numeric not null default 0,
  portions numeric not null default 1,
  per_serving jsonb not null default '{}'::jsonb,
  per_100g jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('complete', 'partial', 'pending')),
  missing_items jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists technical_sheet_nutrition_snapshots_establishment_idx
  on public.technical_sheet_nutrition_snapshots(establishment_id);

create index if not exists technical_sheet_nutrition_snapshots_sheet_idx
  on public.technical_sheet_nutrition_snapshots(technical_sheet_id, created_at desc);

alter table public.technical_sheet_nutrition_snapshots enable row level security;

drop policy if exists "technical_sheet_nutrition_snapshots_select_members" on public.technical_sheet_nutrition_snapshots;
drop policy if exists "technical_sheet_nutrition_snapshots_insert_members" on public.technical_sheet_nutrition_snapshots;

create policy "technical_sheet_nutrition_snapshots_select_members"
  on public.technical_sheet_nutrition_snapshots
  for select
  using (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = technical_sheet_nutrition_snapshots.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  );

create policy "technical_sheet_nutrition_snapshots_insert_members"
  on public.technical_sheet_nutrition_snapshots
  for insert
  with check (
    exists (
      select 1
      from public.establishment_memberships em
      where em.establishment_id = technical_sheet_nutrition_snapshots.establishment_id
        and em.user_id = auth.uid()
        and em.is_active = true
    )
  );

commit;
