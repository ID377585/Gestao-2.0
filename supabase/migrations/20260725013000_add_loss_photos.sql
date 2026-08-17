begin;

-- The hosted database contained public.losses before the migration history was
-- complete. Define the full baseline here so clean staging environments do not
-- depend on an out-of-band dashboard-created table.
create table if not exists public.losses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  establishment_id uuid not null,
  user_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  sku text not null,
  unit_label text not null,
  qty numeric not null,
  lot text,
  reason text not null,
  reason_detail text,
  qrcode text,
  label_id uuid,
  stock_before numeric,
  stock_after numeric,
  label_code text,
  photo_path text,
  photo_file_name text,
  photo_mime_type text,
  constraint losses_qty_check check (qty > 0::numeric)
);

alter table public.losses
  add column if not exists photo_path text,
  add column if not exists photo_file_name text,
  add column if not exists photo_mime_type text;

-- Match the existing hosted contract while keeping bootstrap failures explicit.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.losses'::regclass
      and conname = 'losses_establishment_id_fkey'
  ) then
    alter table public.losses
      add constraint losses_establishment_id_fkey
      foreign key (establishment_id)
      references public.establishments(id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.losses'::regclass
      and conname = 'losses_user_id_fkey'
  ) then
    alter table public.losses
      add constraint losses_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.losses'::regclass
      and conname = 'losses_product_id_fkey'
  ) then
    alter table public.losses
      add constraint losses_product_id_fkey
      foreign key (product_id)
      references public.products(id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.losses'::regclass
      and conname = 'losses_label_id_fkey'
  ) then
    alter table public.losses
      add constraint losses_label_id_fkey
      foreign key (label_id)
      references public.inventory_labels(id)
      on delete set null
      not valid;
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

-- Keep this migration fail-closed. The later core policy consolidation creates
-- the canonical member SELECT/INSERT policies after every tenant helper exists.
revoke all privileges on table public.losses from anon, authenticated, public;
grant select, insert on table public.losses to authenticated;
grant all privileges on table public.losses to service_role;

comment on table public.losses is
  'Tenant-scoped immutable loss records created through the reviewed loss registration flow.';
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
