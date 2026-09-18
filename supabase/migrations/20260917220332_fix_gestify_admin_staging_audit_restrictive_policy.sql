begin;

-- The earlier restrictive deny-all policy would override the staging bridge's
-- permissive audit policies. Keep the table closed unless the scoped staging
-- credential is present.
drop policy if exists gestify_admin_request_log_no_client_access
  on public.gestify_admin_request_log;

create policy gestify_admin_request_log_no_client_access
  on public.gestify_admin_request_log
  as restrictive
  for all
  to anon, authenticated
  using (public.gestify_admin_staging_secret_ok())
  with check (public.gestify_admin_staging_secret_ok());

commit;
