-- Gestify SaaS security hardening foundation
-- Generated from the May 17 2026 Supabase/GitHub/Vercel audit.
--
-- Apply in staging first. This migration intentionally favors fail-closed
-- behavior. Tables that cannot be safely tenant-scoped yet will be blocked from
-- anon/authenticated direct access until code paths are moved behind audited
-- server-side APIs or tenant columns/policies are added.

begin;

-- ---------------------------------------------------------------------------
-- 1. Freeze risky public direct access on tables flagged by Supabase Advisors.
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'order_status_transitions',
    'stock_balances',
    'inventory_sessions',
    'inventory_items',
    'production_productivity',
    'order_items_labels',
    'stock_transfers',
    'stock_transfer_items',
    'stock_balance_audit',
    'carriers',
    'suppliers',
    'user_module_permissions'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('alter table public.%I force row level security', table_name);
      execute format('revoke all on table public.%I from anon', table_name);
      execute format('revoke all on table public.%I from authenticated', table_name);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Safe tenant membership helpers for RLS policies.
-- ---------------------------------------------------------------------------

create or replace function public.gestify_is_establishment_member(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = auth.uid()
      and em.is_active = true
  ) or exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = auth.uid()
      and coalesce(m.is_active, true) = true
  );
$$;

create or replace function public.gestify_has_establishment_role(
  p_establishment_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.establishment_memberships em
    where em.establishment_id = p_establishment_id
      and em.user_id = auth.uid()
      and em.is_active = true
      and em.role::text = any(p_roles)
  ) or exists (
    select 1
    from public.memberships m
    where m.establishment_id = p_establishment_id
      and m.user_id = auth.uid()
      and coalesce(m.is_active, true) = true
      and m.role = any(p_roles)
  );
$$;

revoke all on function public.gestify_is_establishment_member(uuid) from public, anon, authenticated;
revoke all on function public.gestify_has_establishment_role(uuid, text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tenant-scoped policies for tables that have establishment_id.
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'stock_balances',
    'inventory_sessions',
    'stock_transfers',
    'stock_balance_audit',
    'carriers',
    'user_module_permissions'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists %I on public.%I', 'gestify_tenant_select', table_name);
      execute format('drop policy if exists %I on public.%I', 'gestify_tenant_insert_staff', table_name);
      execute format('drop policy if exists %I on public.%I', 'gestify_tenant_update_staff', table_name);
      execute format('drop policy if exists %I on public.%I', 'gestify_tenant_delete_admin', table_name);

      execute format(
        'create policy %I on public.%I for select to authenticated using (public.gestify_is_establishment_member(establishment_id))',
        'gestify_tenant_select', table_name
      );
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''estoque'', ''fiscal'']))',
        'gestify_tenant_insert_staff', table_name
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (public.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''estoque'', ''fiscal''])) with check (public.gestify_has_establishment_role(establishment_id, array[''admin'', ''operacao'', ''estoque'', ''fiscal'']))',
        'gestify_tenant_update_staff', table_name
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (public.gestify_has_establishment_role(establishment_id, array[''admin'']))',
        'gestify_tenant_delete_admin', table_name
      );
    end if;
  end loop;
end $$;

-- Child tables without direct establishment_id; scope through their parents.

do $$
begin
  if to_regclass('public.inventory_items') is not null then
    drop policy if exists gestify_inventory_items_select on public.inventory_items;
    drop policy if exists gestify_inventory_items_write on public.inventory_items;
    create policy gestify_inventory_items_select on public.inventory_items
      for select to authenticated
      using (
        exists (
          select 1
          from public.inventory_sessions s
          where s.id = inventory_items.session_id
            and public.gestify_is_establishment_member(s.establishment_id)
        )
      );
    create policy gestify_inventory_items_write on public.inventory_items
      for all to authenticated
      using (
        exists (
          select 1
          from public.inventory_sessions s
          where s.id = inventory_items.session_id
            and public.gestify_has_establishment_role(s.establishment_id, array['admin', 'estoque', 'operacao'])
        )
      )
      with check (
        exists (
          select 1
          from public.inventory_sessions s
          where s.id = inventory_items.session_id
            and public.gestify_has_establishment_role(s.establishment_id, array['admin', 'estoque', 'operacao'])
        )
      );
  end if;

  if to_regclass('public.stock_transfer_items') is not null then
    drop policy if exists gestify_stock_transfer_items_select on public.stock_transfer_items;
    drop policy if exists gestify_stock_transfer_items_write on public.stock_transfer_items;
    create policy gestify_stock_transfer_items_select on public.stock_transfer_items
      for select to authenticated
      using (
        exists (
          select 1
          from public.stock_transfers st
          where st.id = stock_transfer_items.transfer_id
            and (
              public.gestify_is_establishment_member(st.from_establishment_id)
              or public.gestify_is_establishment_member(st.to_establishment_id)
            )
        )
      );
    create policy gestify_stock_transfer_items_write on public.stock_transfer_items
      for all to authenticated
      using (
        exists (
          select 1
          from public.stock_transfers st
          where st.id = stock_transfer_items.transfer_id
            and public.gestify_has_establishment_role(st.from_establishment_id, array['admin', 'estoque', 'operacao'])
        )
      )
      with check (
        exists (
          select 1
          from public.stock_transfers st
          where st.id = stock_transfer_items.transfer_id
            and public.gestify_has_establishment_role(st.from_establishment_id, array['admin', 'estoque', 'operacao'])
        )
      );
  end if;

  if to_regclass('public.order_items_labels') is not null then
    drop policy if exists gestify_order_items_labels_select on public.order_items_labels;
    drop policy if exists gestify_order_items_labels_write on public.order_items_labels;
    create policy gestify_order_items_labels_select on public.order_items_labels
      for select to authenticated
      using (
        exists (
          select 1
          from public.orders o
          where o.id = order_items_labels.order_id
            and public.gestify_is_establishment_member(o.establishment_id)
        )
      );
    create policy gestify_order_items_labels_write on public.order_items_labels
      for all to authenticated
      using (
        exists (
          select 1
          from public.orders o
          where o.id = order_items_labels.order_id
            and public.gestify_has_establishment_role(o.establishment_id, array['admin', 'operacao', 'estoque'])
        )
      )
      with check (
        exists (
          select 1
          from public.orders o
          where o.id = order_items_labels.order_id
            and public.gestify_has_establishment_role(o.establishment_id, array['admin', 'operacao', 'estoque'])
        )
      );
  end if;
end $$;

-- Reference table: read-only to signed-in users, writes through migrations only.
do $$
begin
  if to_regclass('public.order_status_transitions') is not null then
    drop policy if exists gestify_order_status_transitions_read on public.order_status_transitions;
    create policy gestify_order_status_transitions_read on public.order_status_transitions
      for select to authenticated
      using (true);
  end if;
end $$;

-- Tables without tenant columns remain fail-closed until schema is corrected.
comment on table public.suppliers is 'RLS enabled fail-closed by Gestify hardening migration. Add establishment_id/org_id and tenant-scoped policies before direct client access.';
comment on table public.production_productivity is 'RLS enabled fail-closed by Gestify hardening migration. Add establishment_id or parent-based policy before direct client access.';

-- ---------------------------------------------------------------------------
-- 4. Remove overly permissive policies detected by Supabase Advisors.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.fiscal_company_profiles') is not null then
    drop policy if exists "Authenticated users can delete fiscal company profiles" on public.fiscal_company_profiles;
    drop policy if exists "Authenticated users can insert fiscal company profiles" on public.fiscal_company_profiles;
    drop policy if exists "Authenticated users can update fiscal company profiles" on public.fiscal_company_profiles;

    create policy fiscal_company_profiles_tenant_select on public.fiscal_company_profiles
      for select to authenticated
      using (public.gestify_is_establishment_member(establishment_id));
    create policy fiscal_company_profiles_fiscal_write on public.fiscal_company_profiles
      for all to authenticated
      using (public.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']))
      with check (public.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']));
  end if;

  if to_regclass('public.fiscal_product_mappings') is not null then
    drop policy if exists "Authenticated users can delete fiscal product mappings" on public.fiscal_product_mappings;
    drop policy if exists "Authenticated users can insert fiscal product mappings" on public.fiscal_product_mappings;
    drop policy if exists "Authenticated users can update fiscal product mappings" on public.fiscal_product_mappings;

    create policy fiscal_product_mappings_tenant_select on public.fiscal_product_mappings
      for select to authenticated
      using (public.gestify_is_establishment_member(establishment_id));
    create policy fiscal_product_mappings_fiscal_write on public.fiscal_product_mappings
      for all to authenticated
      using (public.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']))
      with check (public.gestify_has_establishment_role(establishment_id, array['admin', 'fiscal']));
  end if;

  if to_regclass('public.technical_sheet_revision_logs') is not null then
    drop policy if exists insert_logs_authenticated on public.technical_sheet_revision_logs;
  end if;

  if to_regclass('public.technical_sheet_versions') is not null then
    drop policy if exists insert_versions_authenticated on public.technical_sheet_versions;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. SECURITY DEFINER views should execute as invoker where supported.
-- ---------------------------------------------------------------------------

do $$
declare
  view_name text;
begin
  foreach view_name in array array[
    'current_stock',
    'current_stock_view',
    'inventory_current',
    'stocks',
    'kds_production_view',
    'inventory_current_stock__deprecated',
    'inventory_last_count_vs_current',
    'inventory_current_stock'
  ] loop
    if to_regclass(format('public.%I', view_name)) is not null then
      execute format('alter view public.%I set (security_invoker = true)', view_name);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Revoke direct RPC execution for SECURITY DEFINER routines from API roles.
-- ---------------------------------------------------------------------------

do $$
declare
  routine record;
begin
  for routine in
    select
      n.nspname as schema_name,
      p.proname as routine_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from anon',
      routine.schema_name,
      routine.routine_name,
      routine.identity_args
    );
    execute format(
      'revoke execute on function %I.%I(%s) from authenticated',
      routine.schema_name,
      routine.routine_name,
      routine.identity_args
    );
    execute format(
      'revoke execute on function %I.%I(%s) from public',
      routine.schema_name,
      routine.routine_name,
      routine.identity_args
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Lock down public storage object listing for sensitive buckets.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from storage.buckets where id = 'invoice-entry-files') then
    update storage.buckets
    set public = false
    where id = 'invoice-entry-files';
  end if;

  if exists (select 1 from storage.buckets where id = 'technical-sheet-images') then
    update storage.buckets
    set public = false
    where id = 'technical-sheet-images';
  end if;

  drop policy if exists "invoice entry files public read" on storage.objects;
  drop policy if exists "technical sheet images public read" on storage.objects;
  drop policy if exists technical_sheet_images_public_read on storage.objects;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Migration audit marker.
-- ---------------------------------------------------------------------------

create table if not exists public.gestify_security_migration_audit (
  id uuid primary key default gen_random_uuid(),
  migration_name text not null unique,
  applied_at timestamptz not null default now(),
  notes text not null
);

alter table public.gestify_security_migration_audit enable row level security;
alter table public.gestify_security_migration_audit force row level security;

insert into public.gestify_security_migration_audit (migration_name, notes)
values (
  '202605170001_gestify_security_hardening_foundation',
  'Enabled RLS on advisor-flagged tables, revoked public SECURITY DEFINER RPC execution, switched flagged views to security_invoker, removed broad storage listing policies, and removed permissive fiscal policies.'
)
on conflict (migration_name) do nothing;

commit;
