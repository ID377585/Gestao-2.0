-- Normaliza relacionamentos que apareciam soltos no Schema Visualizer.
-- A migration e idempotente: limpa apenas o vinculo quebrado conhecido
-- de fichas tecnicas -> produtos e cria FKs ausentes sem apagar dados.

begin;

-- 1) Corrige fichas tecnicas que apontam para produtos removidos.
-- Isso evita o erro 23503 ao adicionar/validar a FK technical_sheets.linked_product_id.
update public.technical_sheets ts
set
  linked_product_id = null,
  is_linked_to_product = false,
  updated_at = now()
where ts.linked_product_id is not null
  and not exists (
    select 1
    from public.products p
    where p.id = ts.linked_product_id
  );

-- 2) Garante a FK entre ficha tecnica e produto.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'technical_sheets_linked_product_id_fkey'
      and conrelid = 'public.technical_sheets'::regclass
  ) then
    alter table public.technical_sheets
      add constraint technical_sheets_linked_product_id_fkey
      foreign key (linked_product_id)
      references public.products(id)
      on delete set null;
  end if;
end $$;

-- 3) Garante FKs operacionais que estavam ausentes/soltas no visualizador.
-- NOT VALID evita falha por dado historico legado; novos inserts/updates ja passam
-- a ser protegidos pela FK. A validacao completa pode ser feita depois da auditoria.
do $$
begin
  if to_regclass('public.carriers') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'carriers_establishment_id_fkey'
      and conrelid = 'public.carriers'::regclass
  ) then
    alter table public.carriers
      add constraint carriers_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.stock_balance_audit') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'stock_balance_audit_stock_balance_id_fkey'
      and conrelid = 'public.stock_balance_audit'::regclass
  ) then
    alter table public.stock_balance_audit
      add constraint stock_balance_audit_stock_balance_id_fkey
      foreign key (stock_balance_id)
      references public.stock_balances(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.stock_balance_audit') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'stock_balance_audit_establishment_id_fkey'
      and conrelid = 'public.stock_balance_audit'::regclass
  ) then
    alter table public.stock_balance_audit
      add constraint stock_balance_audit_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.stock_balance_audit') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'stock_balance_audit_product_id_fkey'
      and conrelid = 'public.stock_balance_audit'::regclass
  ) then
    alter table public.stock_balance_audit
      add constraint stock_balance_audit_product_id_fkey
      foreign key (product_id)
      references public.products(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.stock_balance_audit') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'stock_balance_audit_user_id_fkey'
      and conrelid = 'public.stock_balance_audit'::regclass
  ) then
    alter table public.stock_balance_audit
      add constraint stock_balance_audit_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.losses') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'losses_establishment_id_fkey'
      and conrelid = 'public.losses'::regclass
  ) then
    alter table public.losses
      add constraint losses_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.losses') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'losses_user_id_fkey'
      and conrelid = 'public.losses'::regclass
  ) then
    alter table public.losses
      add constraint losses_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.losses') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'losses_product_id_fkey'
      and conrelid = 'public.losses'::regclass
  ) then
    alter table public.losses
      add constraint losses_product_id_fkey
      foreign key (product_id)
      references public.products(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.losses') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'losses_label_id_fkey'
      and conrelid = 'public.losses'::regclass
  ) then
    alter table public.losses
      add constraint losses_label_id_fkey
      foreign key (label_id)
      references public.inventory_labels(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.fiscal_certificates') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_certificates_establishment_id_fkey'
      and conrelid = 'public.fiscal_certificates'::regclass
  ) then
    alter table public.fiscal_certificates
      add constraint fiscal_certificates_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.fiscal_company_profiles') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_company_profiles_establishment_id_fkey'
      and conrelid = 'public.fiscal_company_profiles'::regclass
  ) then
    alter table public.fiscal_company_profiles
      add constraint fiscal_company_profiles_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.fiscal_nsu_control') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_nsu_control_establishment_id_fkey'
      and conrelid = 'public.fiscal_nsu_control'::regclass
  ) then
    alter table public.fiscal_nsu_control
      add constraint fiscal_nsu_control_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.fiscal_nfe_inbox') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_nfe_inbox_establishment_id_fkey'
      and conrelid = 'public.fiscal_nfe_inbox'::regclass
  ) then
    alter table public.fiscal_nfe_inbox
      add constraint fiscal_nfe_inbox_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.fiscal_nfe_inbox') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_nfe_inbox_imported_entry_id_fkey'
      and conrelid = 'public.fiscal_nfe_inbox'::regclass
  ) then
    alter table public.fiscal_nfe_inbox
      add constraint fiscal_nfe_inbox_imported_entry_id_fkey
      foreign key (imported_entry_id)
      references public.invoice_entries(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.invoice_entry_drafts') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'invoice_entry_drafts_establishment_id_fkey'
      and conrelid = 'public.invoice_entry_drafts'::regclass
  ) then
    alter table public.invoice_entry_drafts
      add constraint invoice_entry_drafts_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.invoice_entry_drafts') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'invoice_entry_drafts_created_by_fkey'
      and conrelid = 'public.invoice_entry_drafts'::regclass
  ) then
    alter table public.invoice_entry_drafts
      add constraint invoice_entry_drafts_created_by_fkey
      foreign key (created_by)
      references auth.users(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.import_jobs') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'import_jobs_establishment_id_fkey'
      and conrelid = 'public.import_jobs'::regclass
  ) then
    alter table public.import_jobs
      add constraint import_jobs_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.import_job_pages') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'import_job_pages_technical_sheet_id_fkey'
      and conrelid = 'public.import_job_pages'::regclass
  ) then
    alter table public.import_job_pages
      add constraint import_job_pages_technical_sheet_id_fkey
      foreign key (technical_sheet_id)
      references public.technical_sheets(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.stock_transfer_items') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'stock_transfer_items_product_id_fkey'
      and conrelid = 'public.stock_transfer_items'::regclass
  ) then
    alter table public.stock_transfer_items
      add constraint stock_transfer_items_product_id_fkey
      foreign key (product_id)
      references public.products(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.stock_transfers') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'stock_transfers_from_establishment_id_fkey'
      and conrelid = 'public.stock_transfers'::regclass
  ) then
    alter table public.stock_transfers
      add constraint stock_transfers_from_establishment_id_fkey
      foreign key (from_establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.stock_transfers') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'stock_transfers_to_establishment_id_fkey'
      and conrelid = 'public.stock_transfers'::regclass
  ) then
    alter table public.stock_transfers
      add constraint stock_transfers_to_establishment_id_fkey
      foreign key (to_establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;
end $$;

commit;
