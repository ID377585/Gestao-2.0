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
      and t.relname = 'technical_sheets'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%sector%'
  loop
    execute format(
      'alter table public.technical_sheets drop constraint if exists %I',
      constraint_to_drop
    );
  end loop;
end $$;

alter table if exists public.technical_sheets
  add constraint technical_sheets_sector_check
  check (
    sector is null
    or sector in (
      'Produção',
      'Massaria',
      'Confeitaria',
      'Burrataria',
      'Padaria',
      'Peixaria',
      'Bar',
      'Cozinha',
      'Boqueta',
      'Praça Quente',
      'Chapa',
      'Garde',
      'Garde Manger',
      'Fritadeira',
      'Praça Fria'
    )
  )
  not valid;
