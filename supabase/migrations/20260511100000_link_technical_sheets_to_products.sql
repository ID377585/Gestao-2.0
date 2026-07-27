-- Permite atrelar uma ficha tecnica a um produto do catalogo.
-- Isso possibilita que fichas novas e antigas sejam sincronizadas com Produtos e Estoque.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  name text not null,
  sku text,
  category text,
  product_type text not null default 'insumo',
  price numeric not null default 0,
  standard_cost numeric,
  default_unit_label text not null default 'UN',
  conversion_factor numeric,
  package_qty numeric,
  qty_per_package text,
  brand text,
  sector_category text,
  shelf_life_days integer,
  abc_curve text,
  aliases text[],
  alternate_names text[],
  allergens text[],
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.products
  add column if not exists establishment_id uuid,
  add column if not exists name text,
  add column if not exists sku text,
  add column if not exists category text,
  add column if not exists product_type text default 'insumo',
  add column if not exists price numeric default 0,
  add column if not exists standard_cost numeric,
  add column if not exists default_unit_label text default 'UN',
  add column if not exists conversion_factor numeric,
  add column if not exists package_qty numeric,
  add column if not exists qty_per_package text,
  add column if not exists brand text,
  add column if not exists sector_category text,
  add column if not exists shelf_life_days integer,
  add column if not exists abc_curve text,
  add column if not exists aliases text[],
  add column if not exists alternate_names text[],
  add column if not exists allergens text[],
  add column if not exists is_active boolean default true,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz;

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

create table if not exists public.technical_sheet_versions (
  id uuid primary key default gen_random_uuid(),
  technical_sheet_id uuid not null,
  establishment_id uuid not null,
  revision_number integer not null,
  snapshot_type text not null default 'manual',
  snapshot_payload_json jsonb not null default '{}'::jsonb,
  change_summary text,
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

alter table public.technical_sheet_versions
  add column if not exists technical_sheet_id uuid,
  add column if not exists establishment_id uuid,
  add column if not exists revision_number integer,
  add column if not exists snapshot_type text default 'manual',
  add column if not exists snapshot_payload_json jsonb default '{}'::jsonb,
  add column if not exists change_summary text,
  add column if not exists approved boolean default false,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now();

create index if not exists technical_sheet_versions_sheet_idx
  on public.technical_sheet_versions(technical_sheet_id, revision_number desc);

create index if not exists technical_sheet_versions_establishment_idx
  on public.technical_sheet_versions(establishment_id);

create table if not exists public.technical_sheet_revision_logs (
  id uuid primary key default gen_random_uuid(),
  technical_sheet_id uuid not null,
  revision_number integer not null,
  field_name text not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  reason text,
  performed_by uuid not null,
  performed_at timestamptz not null default now()
);

alter table public.technical_sheet_revision_logs
  add column if not exists technical_sheet_id uuid,
  add column if not exists revision_number integer,
  add column if not exists field_name text,
  add column if not exists action text,
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb,
  add column if not exists reason text,
  add column if not exists performed_by uuid,
  add column if not exists performed_at timestamptz default now();

create index if not exists technical_sheet_revision_logs_sheet_idx
  on public.technical_sheet_revision_logs(technical_sheet_id, performed_at desc);

alter table public.technical_sheet_versions enable row level security;
alter table public.technical_sheet_revision_logs enable row level security;
