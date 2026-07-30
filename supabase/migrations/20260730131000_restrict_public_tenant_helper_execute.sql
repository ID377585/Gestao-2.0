begin;

revoke all on function public.is_establishment_member(uuid) from public, anon, authenticated;
grant execute on function public.is_establishment_member(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
