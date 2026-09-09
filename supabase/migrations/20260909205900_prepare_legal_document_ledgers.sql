begin;

-- Create the two legal registry tables ahead of the broader compliance foundation.
-- The legacy Terms ledger stores IP addresses as text; keeping the generic ledger
-- compatible avoids a lossy or migration-breaking cast during historical backfill.
create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  version_id text not null unique,
  version_label text not null,
  title text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  effective_at timestamptz,
  published_at timestamptz,
  requires_acceptance boolean not null default false,
  requires_reacceptance boolean not null default false,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  establishment_id uuid references public.establishments(id) on delete set null,
  document_type text not null,
  document_version_id text not null references public.legal_document_versions(version_id) on delete restrict,
  accepted_at timestamptz not null default now(),
  accepted_source text not null default 'web',
  accepted_from_path text,
  ip_address text,
  user_agent text,
  auth_session_id text,
  representative_authority boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

commit;
