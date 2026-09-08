begin;

revoke all on table public.user_terms_acceptances from anon, authenticated, service_role;
revoke all on table public.user_access_logs from anon, authenticated, service_role;

grant select, insert on table public.user_terms_acceptances to service_role;
grant select, insert on table public.user_access_logs to service_role;

commit;
