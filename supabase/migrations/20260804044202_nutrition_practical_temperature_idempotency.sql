alter table public.nutrition_temperature_records
  add column if not exists idempotency_key text null;

alter table public.nutrition_temperature_records
  add column if not exists created_offline_at timestamptz null;

create unique index if not exists nutrition_temperature_records_idempotency_idx
  on public.nutrition_temperature_records(establishment_id, idempotency_key)
  where idempotency_key is not null;
