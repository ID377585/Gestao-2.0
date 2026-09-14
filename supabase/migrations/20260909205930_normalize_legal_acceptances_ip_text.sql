begin;

-- Compatibility bridge for environments where legal_acceptances was created earlier
-- with ip_address as inet. The legacy Terms ledger stores the same evidence as text.
-- Keeping the generic ledger as text makes the historical backfill lossless and avoids
-- rejecting future telemetry solely because a proxy forwarded a non-canonical value.
do $$
declare
  current_type text;
begin
  select c.data_type
    into current_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'legal_acceptances'
    and c.column_name = 'ip_address';

  if current_type is not null and current_type <> 'text' then
    alter table public.legal_acceptances
      alter column ip_address type text
      using ip_address::text;
  end if;
end $$;

commit;
