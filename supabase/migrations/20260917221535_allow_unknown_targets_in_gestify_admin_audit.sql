begin;

-- Administrative probes of an unknown UUID must still be auditable. A foreign
-- key on the audit target prevented recording the denied/not-found request.
alter table public.gestify_admin_request_log
  drop constraint if exists gestify_admin_request_log_target_establishment_id_fkey;

comment on column public.gestify_admin_request_log.target_establishment_id is
  'Requested administrative target UUID. May be unknown/nonexistent so denied and not-found probes remain auditable.';

commit;
