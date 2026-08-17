begin;

-- Production historically contained public.losses before this migration chain was
-- made replayable. Reconstruct the pre-photo contract on fresh environments so
-- staging and disaster-recovery restores can be created entirely from migrations.
create table if not exists public.losses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  establishment_id uuid not null,
  user_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  sku text not null,
  unit_label text not null,
  qty numeric not null check (qty > 0),
  lot text,
  reason text not null,
  reason_detail text,
  qrcode text,
  label_id uuid,
  stock_before numeric,
  stock_after numeric,
  label_code text
);

-- Match the current production referential contract without validating historical
-- rows during reconstruction. On a fresh database these constraints start empty.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'losses_establishment_id_fkey' and conrelid = 'public.losses'::regclass) then
    alter table public.losses
      add constraint losses_establishment_id_fkey
      foreign key (establishment_id) references public.establishments(id)
      on delete restrict not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'losses_user_id_fkey' and conrelid = 'public.losses'::regclass) then
    alter table public.losses
      add constraint losses_user_id_fkey
      foreign key (user_id) references auth.users(id)
      on delete restrict not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'losses_product_id_fkey' and conrelid = 'public.losses'::regclass) then
    alter table public.losses
      add constraint losses_product_id_fkey
      foreign key (product_id) references public.products(id)
      on delete restrict not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'losses_label_id_fkey' and conrelid = 'public.losses'::regclass) then
    alter table public.losses
      add constraint losses_label_id_fkey
      foreign key (label_id) references public.inventory_labels(id)
      on delete set null not valid;
  end if;
end $$;

create index if not exists losses_establishment_idx
  on public.losses(establishment_id, created_at desc);
create index if not exists idx_losses_user_id
  on public.losses(user_id);
create index if not exists idx_losses_product_id
  on public.losses(product_id);
create index if not exists idx_losses_label_id
  on public.losses(label_id);

alter table public.losses enable row level security;
alter table public.losses force row level security;

-- New Supabase projects may not auto-grant public-schema Data API access. Make the
-- intended contract explicit and least-privileged: signed-in members can read and
-- insert rows inside their tenant; mutations remain server/RPC controlled.
revoke all on table public.losses from anon, authenticated;
grant select, insert on table public.losses to authenticated;
grant all on table public.losses to service_role;

drop policy if exists losses_member_select on public.losses;
create policy losses_member_select
on public.losses
for select
to authenticated
using ((select private.gestify_is_establishment_member(losses.establishment_id)));

drop policy if exists losses_member_insert on public.losses;
create policy losses_member_insert
on public.losses
for insert
to authenticated
with check ((select private.gestify_is_establishment_member(losses.establishment_id)));

alter table public.losses
  add column if not exists photo_path text,
  add column if not exists photo_file_name text,
  add column if not exists photo_mime_type text;

comment on column public.losses.photo_path is
  'Private Supabase Storage path for the loss evidence photo.';
comment on column public.losses.photo_file_name is
  'Original file name for the loss evidence photo.';
comment on column public.losses.photo_mime_type is
  'MIME type for the loss evidence photo.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'loss-photos',
  'loss-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
