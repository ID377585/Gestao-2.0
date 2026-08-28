begin;

create index if not exists inventory_catalog_items_created_by_idx
  on public.inventory_catalog_items (created_by)
  where created_by is not null;

create index if not exists inventory_catalog_items_updated_by_idx
  on public.inventory_catalog_items (updated_by)
  where updated_by is not null;

commit;
