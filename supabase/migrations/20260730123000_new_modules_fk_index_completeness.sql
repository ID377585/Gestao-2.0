-- Complete FK indexes for the new RH/player module tables.
-- Keep the migration compatible with both the clean schema and older hosted
-- contracts by creating each index only when its referenced column exists.

do $$
declare
  index_contract record;
begin
  for index_contract in
    select *
    from (
      values
        ('hr_employee_face_profiles', 'created_by', 'hr_employee_face_profiles_created_by_idx'),
        ('hr_employee_face_profiles', 'updated_by', 'hr_employee_face_profiles_updated_by_idx'),
        ('hr_time_clock_events', 'created_by', 'hr_time_clock_events_created_by_idx'),
        ('hr_time_clock_events', 'face_match_user_id', 'hr_time_clock_events_face_match_user_id_idx'),
        ('music_player_settings', 'created_by', 'music_player_settings_created_by_idx'),
        ('music_player_settings', 'updated_by', 'music_player_settings_updated_by_idx'),
        ('music_radio_stations', 'establishment_id', 'music_radio_stations_establishment_id_idx')
    ) as contracts(table_name, column_name, index_name)
  loop
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = index_contract.table_name
        and c.column_name = index_contract.column_name
    ) then
      execute format('drop index if exists public.%I', index_contract.index_name);
      execute format(
        'create index if not exists %I on public.%I (%I)',
        index_contract.index_name,
        index_contract.table_name,
        index_contract.column_name
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
