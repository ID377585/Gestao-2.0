begin;

alter table public.technical_sheets
  add column if not exists active boolean not null default true;

comment on column public.technical_sheets.active is
  'Indica se a ficha tecnica esta ativa para consultas operacionais. Criada para alinhar o contrato usado pelo frontend/API.';

notify pgrst, 'reload schema';

commit;
