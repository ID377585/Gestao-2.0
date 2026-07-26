begin;

revoke all privileges on table public.suppliers from anon;
revoke all privileges on table public.suppliers from authenticated;
grant select, insert, update, delete on table public.suppliers to authenticated;

notify pgrst, 'reload schema';

commit;
