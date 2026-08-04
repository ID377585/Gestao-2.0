alter table public.nutrition_training_attendees
  add column if not exists idempotency_key text null;

create unique index if not exists nutrition_training_attendees_idempotency_idx
  on public.nutrition_training_attendees(establishment_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists nutrition_training_attendees_session_status_idx
  on public.nutrition_training_attendees(establishment_id, session_id, attendance_status);
