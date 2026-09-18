begin;

-- Keep the privileged Auth lookup unavailable to ordinary client roles.
revoke all on function public.gestify_admin_staging_user_profile(uuid) from public, anon, authenticated;
grant execute on function public.gestify_admin_staging_user_profile(uuid) to service_role;

-- The secret verifier is intentionally invoker-security and exposes only a
-- boolean decision; it never returns credential material.
alter function public.gestify_admin_staging_secret_ok()
  set search_path to 'public', 'extensions';

alter function public.gestify_admin_staging_user_profile(uuid)
  set search_path to 'public', 'auth';

commit;
