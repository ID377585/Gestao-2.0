begin;

alter table if exists public.technical_sheet_scale_ingredients
  drop constraint if exists technical_sheet_scale_ingredients_technical_sheet_scale_id_fkey;

notify pgrst, 'reload schema';

commit;
