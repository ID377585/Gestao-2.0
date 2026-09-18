begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_subscriptions_establishment_id_fkey'
      and conrelid = 'public.company_subscriptions'::regclass
  ) then
    alter table public.company_subscriptions
      add constraint company_subscriptions_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete cascade;
  end if;
end $$;

commit;
