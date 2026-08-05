begin;

-- Add tenant scope to notifications without deleting or hiding historical rows.
-- RLS tightening is intentionally left for a later controlled step after this
-- backfill is validated in production.
alter table public.notifications
  add column if not exists establishment_id uuid
  references public.establishments(id)
  on delete set null;

create index if not exists notifications_establishment_created_at_idx
  on public.notifications (establishment_id, created_at desc)
  where establishment_id is not null;

create index if not exists notifications_user_establishment_created_at_idx
  on public.notifications (user_id, establishment_id, created_at desc)
  where user_id is not null;

with payload_scoped_notifications as (
  select
    id,
    (payload ->> 'establishment_id')::uuid as establishment_id
  from public.notifications
  where establishment_id is null
    and payload ? 'establishment_id'
    and (payload ->> 'establishment_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
)
update public.notifications n
   set establishment_id = psn.establishment_id,
       user_id = coalesce(
         n.user_id,
         case
           when nullif(n."userId", '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
             then nullif(n."userId", '')::uuid
           else null
         end
       )
  from payload_scoped_notifications psn
 where n.id = psn.id
   and exists (
     select 1
     from public.establishments e
     where e.id = psn.establishment_id
   );

with active_memberships as (
  select user_id, establishment_id
  from public.memberships
  where user_id is not null
    and establishment_id is not null
    and coalesce(is_active, true) = true

  union

  select user_id, establishment_id
  from public.establishment_memberships
  where user_id is not null
    and establishment_id is not null
    and coalesce(is_active, true) = true
),
single_establishment_users as (
  select
    user_id,
    min(establishment_id::text)::uuid as establishment_id
  from active_memberships
  group by user_id
  having count(distinct establishment_id) = 1
)
update public.notifications n
   set establishment_id = seu.establishment_id,
       user_id = coalesce(n.user_id, nullif(n."userId", '')::uuid)
  from single_establishment_users seu
 where n.establishment_id is null
   and nullif(n."userId", '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   and nullif(n."userId", '')::uuid = seu.user_id;

notify pgrst, 'reload schema';

commit;
