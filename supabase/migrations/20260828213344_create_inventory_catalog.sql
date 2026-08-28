begin;

create table if not exists public.inventory_catalog_items (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null
    references public.establishments(id) on delete cascade,
  name text not null,
  brand text null,
  model text null,
  category text not null default 'Utensílios',
  quantity integer not null default 1,
  unit_label text not null default 'un.',
  item_condition text not null default 'Bom',
  location text null,
  description text null,
  photo_path text null,
  photo_file_name text null,
  photo_mime_type text null,
  photo_size_bytes bigint null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_catalog_items_name_check
    check (char_length(btrim(name)) between 1 and 180),
  constraint inventory_catalog_items_brand_check
    check (brand is null or char_length(brand) <= 120),
  constraint inventory_catalog_items_model_check
    check (model is null or char_length(model) <= 120),
  constraint inventory_catalog_items_category_check
    check (char_length(btrim(category)) between 1 and 80),
  constraint inventory_catalog_items_quantity_check
    check (quantity >= 0 and quantity <= 1000000),
  constraint inventory_catalog_items_unit_label_check
    check (char_length(btrim(unit_label)) between 1 and 30),
  constraint inventory_catalog_items_condition_check
    check (char_length(btrim(item_condition)) between 1 and 40),
  constraint inventory_catalog_items_location_check
    check (location is null or char_length(location) <= 160),
  constraint inventory_catalog_items_description_check
    check (description is null or char_length(description) <= 2000),
  constraint inventory_catalog_items_photo_size_check
    check (photo_size_bytes is null or photo_size_bytes between 1 and 5242880)
);

create index if not exists inventory_catalog_items_establishment_name_idx
  on public.inventory_catalog_items (establishment_id, lower(name));

create index if not exists inventory_catalog_items_establishment_category_idx
  on public.inventory_catalog_items (establishment_id, category);

create index if not exists inventory_catalog_items_establishment_updated_idx
  on public.inventory_catalog_items (establishment_id, updated_at desc);

drop trigger if exists inventory_catalog_items_set_updated_at
  on public.inventory_catalog_items;

create trigger inventory_catalog_items_set_updated_at
before update on public.inventory_catalog_items
for each row execute function public.set_updated_at();

alter table public.inventory_catalog_items enable row level security;
alter table public.inventory_catalog_items force row level security;

revoke all on table public.inventory_catalog_items from anon, authenticated;
grant select, insert, update, delete
  on table public.inventory_catalog_items to authenticated;
grant all on table public.inventory_catalog_items to service_role;

drop policy if exists inventory_catalog_items_member_select
  on public.inventory_catalog_items;
create policy inventory_catalog_items_member_select
on public.inventory_catalog_items
for select
to authenticated
using (
  (select private.gestify_is_establishment_member(
    inventory_catalog_items.establishment_id
  ))
);

drop policy if exists inventory_catalog_items_member_insert
  on public.inventory_catalog_items;
create policy inventory_catalog_items_member_insert
on public.inventory_catalog_items
for insert
to authenticated
with check (
  (select private.gestify_is_establishment_member(
    inventory_catalog_items.establishment_id
  ))
);

drop policy if exists inventory_catalog_items_member_update
  on public.inventory_catalog_items;
create policy inventory_catalog_items_member_update
on public.inventory_catalog_items
for update
to authenticated
using (
  (select private.gestify_is_establishment_member(
    inventory_catalog_items.establishment_id
  ))
)
with check (
  (select private.gestify_is_establishment_member(
    inventory_catalog_items.establishment_id
  ))
);

drop policy if exists inventory_catalog_items_member_delete
  on public.inventory_catalog_items;
create policy inventory_catalog_items_member_delete
on public.inventory_catalog_items
for delete
to authenticated
using (
  (select private.gestify_is_establishment_member(
    inventory_catalog_items.establishment_id
  ))
);

comment on table public.inventory_catalog_items is
  'Catálogo visual multiempresa de utensílios, louças, talheres, equipamentos e bens operacionais.';
comment on column public.inventory_catalog_items.photo_path is
  'Caminho privado da foto no bucket inventory-catalog-photos.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'inventory-catalog-photos',
  'inventory-catalog-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
