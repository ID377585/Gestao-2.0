-- Permite atrelar uma ficha tecnica a um produto do catalogo.
-- Isso possibilita que fichas novas e antigas sejam sincronizadas com Produtos e Estoque.

create table if not exists public.technical_sheets (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  name text not null default '',
  category text not null default 'Geral',
  sector text,
  yield_portions numeric not null default 1,
  yield_label text,
  portion_weight numeric not null default 0,
  portion_weight_unit text,
  total_cost numeric not null default 0,
  cost_per_portion numeric not null default 0,
  sale_price numeric not null default 0,
  profit_margin_percent numeric not null default 0,
  prep_time_minutes integer not null default 0,
  cooking_time_minutes integer,
  preparation_method text,
  allergens text,
  difficulty_level text,
  storage_instructions text,
  shelf_life_room_temp text,
  shelf_life_refrigerated text,
  shelf_life_frozen text,
  temperature_celsius numeric,
  correction_factor_grams numeric,
  cooking_factor_grams numeric,
  image_url text,
  image_path text,
  video_url text,
  source_file_name text,
  source_page_number integer,
  source_updated_at timestamptz,
  import_origin text,
  linked_product_id uuid,
  is_linked_to_product boolean not null default false,
  current_revision_number integer not null default 1,
  current_approval_status text not null default 'draft',
  last_approved_revision_number integer,
  last_approved_at timestamptz,
  last_approved_by uuid,
  created_by uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.technical_sheets
  add column if not exists establishment_id uuid,
  add column if not exists name text default '',
  add column if not exists category text default 'Geral',
  add column if not exists sector text,
  add column if not exists yield_portions numeric default 1,
  add column if not exists yield_label text,
  add column if not exists portion_weight numeric default 0,
  add column if not exists portion_weight_unit text,
  add column if not exists total_cost numeric default 0,
  add column if not exists cost_per_portion numeric default 0,
  add column if not exists sale_price numeric default 0,
  add column if not exists profit_margin_percent numeric default 0,
  add column if not exists prep_time_minutes integer default 0,
  add column if not exists cooking_time_minutes integer,
  add column if not exists preparation_method text,
  add column if not exists allergens text,
  add column if not exists difficulty_level text,
  add column if not exists storage_instructions text,
  add column if not exists shelf_life_room_temp text,
  add column if not exists shelf_life_refrigerated text,
  add column if not exists shelf_life_frozen text,
  add column if not exists temperature_celsius numeric,
  add column if not exists correction_factor_grams numeric,
  add column if not exists cooking_factor_grams numeric,
  add column if not exists image_url text,
  add column if not exists image_path text,
  add column if not exists video_url text,
  add column if not exists source_file_name text,
  add column if not exists source_page_number integer,
  add column if not exists source_updated_at timestamptz,
  add column if not exists import_origin text,
  add column if not exists current_revision_number integer default 1,
  add column if not exists current_approval_status text default 'draft',
  add column if not exists last_approved_revision_number integer,
  add column if not exists last_approved_at timestamptz,
  add column if not exists last_approved_by uuid,
  add column if not exists created_by uuid,
  add column if not exists active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.technical_sheets
  add column if not exists linked_product_id uuid;

alter table public.technical_sheets
  add column if not exists is_linked_to_product boolean not null default false;

create index if not exists technical_sheets_linked_product_idx
  on public.technical_sheets(linked_product_id);

create index if not exists technical_sheets_establishment_linked_idx
  on public.technical_sheets(establishment_id, is_linked_to_product);
