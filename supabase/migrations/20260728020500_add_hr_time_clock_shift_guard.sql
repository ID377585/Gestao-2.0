begin;

create table if not exists public.hr_time_clock_shifts (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  status text not null default 'open',
  opened_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint hr_time_clock_shifts_status_check
    check (status in ('open', 'closed')),
  constraint hr_time_clock_shifts_closed_at_check
    check (
      (status = 'open' and closed_at is null)
      or (status = 'closed' and closed_at is not null)
    )
);

create unique index if not exists hr_time_clock_shifts_one_open_per_user_idx
  on public.hr_time_clock_shifts(establishment_id, user_id)
  where status = 'open';

create index if not exists hr_time_clock_shifts_user_date_idx
  on public.hr_time_clock_shifts(establishment_id, user_id, work_date desc);

alter table public.hr_time_clock_events
  drop constraint if exists hr_time_clock_events_shift_id_fkey;

alter table public.hr_time_clock_events
  add constraint hr_time_clock_events_shift_id_fkey
  foreign key (shift_id)
  references public.hr_time_clock_shifts(id)
  on delete restrict;

alter table public.hr_time_clock_shifts enable row level security;
alter table public.hr_time_clock_shifts force row level security;

revoke all privileges on table public.hr_time_clock_shifts from anon;
grant select on table public.hr_time_clock_shifts to authenticated;
grant all privileges on table public.hr_time_clock_shifts to service_role;

drop policy if exists "hr_time_clock_shifts_own_or_admin_select" on public.hr_time_clock_shifts;
create policy "hr_time_clock_shifts_own_or_admin_select"
on public.hr_time_clock_shifts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.gestify_has_establishment_role(establishment_id, array['admin']::text[]))
);

notify pgrst, 'reload schema';

commit;
