-- Complete FK indexes for the new RH/player module tables.

drop index if exists public.hr_employee_face_profiles_created_by_idx;
create index if not exists hr_employee_face_profiles_created_by_idx
  on public.hr_employee_face_profiles (created_by);

drop index if exists public.hr_employee_face_profiles_updated_by_idx;
create index if not exists hr_employee_face_profiles_updated_by_idx
  on public.hr_employee_face_profiles (updated_by);

drop index if exists public.hr_time_clock_events_created_by_idx;
create index if not exists hr_time_clock_events_created_by_idx
  on public.hr_time_clock_events (created_by);

drop index if exists public.hr_time_clock_events_face_match_user_id_idx;
create index if not exists hr_time_clock_events_face_match_user_id_idx
  on public.hr_time_clock_events (face_match_user_id);

drop index if exists public.music_player_settings_created_by_idx;
create index if not exists music_player_settings_created_by_idx
  on public.music_player_settings (created_by);

drop index if exists public.music_player_settings_updated_by_idx;
create index if not exists music_player_settings_updated_by_idx
  on public.music_player_settings (updated_by);

create index if not exists music_radio_stations_establishment_id_idx
  on public.music_radio_stations (establishment_id);

notify pgrst, 'reload schema';
