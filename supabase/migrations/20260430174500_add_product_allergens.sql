alter table if exists public.products
  add column if not exists allergens text[] not null default '{}'::text[];

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'allergens'
  ) then
    comment on column public.products.allergens is
      'Alergênicos declarados no catálogo de produtos para uso em fichas técnicas e etiquetas.';
  end if;
end $$;
