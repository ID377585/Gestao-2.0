-- Core FK indexes phase one.
-- Additive only: no data, constraint, RLS, grant, or policy changes.

create index if not exists idx_company_subscriptions_plan_slug
  on public.company_subscriptions (plan_slug);

create index if not exists idx_hr_bank_hours_user_id
  on public.hr_bank_hours (user_id);

create index if not exists idx_hr_employee_schedules_user_id
  on public.hr_employee_schedules (user_id);

create index if not exists idx_hr_time_clock_adjustments_event_id
  on public.hr_time_clock_adjustments (event_id);

create index if not exists idx_music_player_settings_default_station_id
  on public.music_player_settings (default_station_id);

create index if not exists idx_tenant_invitations_accepted_by
  on public.tenant_invitations (accepted_by);

create index if not exists idx_tenant_invitations_invited_by
  on public.tenant_invitations (invited_by);

create index if not exists idx_user_module_permissions_updated_by
  on public.user_module_permissions (updated_by);
