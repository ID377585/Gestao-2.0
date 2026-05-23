begin;

-- Corrige a duplicidade de relacionamento entre technical_sheet_scale_ingredients e
-- technical_sheet_scales. A tabela já usa scale_id como relacionamento canônico.
-- O FK redundante fazia o PostgREST/Supabase não saber qual relacionamento usar no
-- embed `ingredients:technical_sheet_scale_ingredients`, quebrando a ação de duplicar
-- ficha técnica em produção.
alter table if exists public.technical_sheet_scale_ingredients
  drop constraint if exists technical_sheet_scale_ingredients_technical_sheet_scale_id_fkey;

-- Força o PostgREST a recarregar o cache de schema após a migração.
notify pgrst, 'reload schema';

commit;
