do $$
declare
  constraint_to_drop text;
begin
  for constraint_to_drop in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'products'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%sector_category%'
  loop
    execute format(
      'alter table public.products drop constraint if exists %I',
      constraint_to_drop
    );
  end loop;
end $$;

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
