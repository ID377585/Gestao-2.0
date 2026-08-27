create index if not exists hr_time_clock_adjustments_target_user_id_idx
  on public.hr_time_clock_adjustments (target_user_id);

create index if not exists hr_time_clock_adjustments_actor_user_id_idx
  on public.hr_time_clock_adjustments (actor_user_id);
