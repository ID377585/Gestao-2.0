alter table public.nutrition_supplier_assessments
  add column if not exists supplier_document_path text null;

alter table public.nutrition_supplier_assessments
  add column if not exists document_file_name text null;

alter table public.nutrition_supplier_assessments
  add column if not exists document_mime_type text null;

alter table public.nutrition_supplier_assessments
  add column if not exists document_file_size_bytes bigint null;

alter table public.nutrition_supplier_assessments
  add column if not exists document_checksum text null;

alter table public.nutrition_supplier_assessments
  add column if not exists categories_summary text null;
