begin;

-- A staging credential must never become valid against another Supabase
-- project if this migration history is replayed elsewhere.
create or replace function public.gestify_admin_staging_secret_ok()
returns boolean
language plpgsql
stable
set search_path to 'public', 'extensions'
as $function$
declare
  headers jsonb;
  supplied text;
  request_host text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return false;
  end;

  request_host := lower(coalesce(headers ->> 'host', headers ->> 'x-forwarded-host', ''));
  if request_host <> 'tuncavkhjazruijujatb.supabase.co' then
    return false;
  end if;

  supplied := coalesce(headers ->> 'x-gestify-admin-staging-secret', '');
  if supplied = '' then
    return false;
  end if;

  return encode(extensions.digest(supplied, 'sha256'), 'hex')
    = '3117cc43e389e695525d8a59861834d0d61fead5e0888a6148cec3f0c601cba4';
end;
$function$;

comment on function public.gestify_admin_staging_secret_ok() is
  'Fail-closed M2 staging bridge verifier. Requires both the exact Gestify staging Supabase host and the staging-only shared secret.';

commit;
