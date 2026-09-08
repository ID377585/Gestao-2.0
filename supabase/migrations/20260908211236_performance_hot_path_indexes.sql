-- Performance hot-path indexes validated first in staging.
-- Targets the dominant product catalog query and technical-sheet listing order.

create index if not exists products_establishment_active_name_idx
  on public.products (establishment_id, is_active, name);

create index if not exists products_establishment_active_type_name_idx
  on public.products (establishment_id, is_active, product_type, name);

create index if not exists technical_sheets_establishment_name_created_idx
  on public.technical_sheets (establishment_id, name, created_at desc);
