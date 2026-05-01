alter table if exists public.products
  drop constraint if exists products_sector_category_check;

alter table if exists public.products
  add constraint products_sector_category_check
  check (
    sector_category is null
    or sector_category in (
      'Confeitaria',
      'Padaria',
      'Açougue',
      'Produção',
      'Massaria',
      'Burrataria',
      'Secos',
      'Embalagens',
      'Hortifruti',
      'Produto de Limpeza',
      'Descartáveis',
      'Bebidas',
      'Laticínios',
      'Frutos do Mar',
      'Peixaria',
      'Pescados',
      'Carnes'
    )
  );
