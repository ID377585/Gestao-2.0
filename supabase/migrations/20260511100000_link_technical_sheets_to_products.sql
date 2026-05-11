-- Permite atrelar uma ficha tecnica a um produto do catalogo.
-- Isso possibilita que fichas novas e antigas sejam sincronizadas com Produtos e Estoque.

alter table public.technical_sheets
  add column if not exists linked_product_id uuid;

alter table public.technical_sheets
  add column if not exists is_linked_to_product boolean not null default false;

create index if not exists technical_sheets_linked_product_idx
  on public.technical_sheets(linked_product_id);

create index if not exists technical_sheets_establishment_linked_idx
  on public.technical_sheets(establishment_id, is_linked_to_product);
