-- Security hardening phase 1.
-- Objetivo: reduzir exposicao publica imediata sem reestruturar o dominio.
-- Validar em ambiente de preview/staging antes de aplicar em producao.

begin;

-- Helpers locais para policies multi-tenant.
create or replace function public.is_establishment_member(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.establishment_id = p_establishment_id
      and m.is_active = true
  )
  or exists (
    select 1
    from public.establishment_memberships em
    where em.user_id = auth.uid()
      and em.establishment_id = p_establishment_id
      and em.is_active = true
  );
$$;

create or replace function public.is_establishment_admin(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.establishment_id = p_establishment_id
      and m.is_active = true
      and m.role = 'admin'
  )
  or exists (
    select 1
    from public.establishment_memberships em
    where em.user_id = auth.uid()
      and em.establishment_id = p_establishment_id
      and em.is_active = true
      and em.role = 'admin'
  );
$$;

revoke all on function public.is_establishment_member(uuid) from anon;
revoke all on function public.is_establishment_admin(uuid) from anon;
grant execute on function public.is_establishment_member(uuid) to authenticated;
grant execute on function public.is_establishment_admin(uuid) to authenticated;

-- Bloqueia execucao anonima de RPCs SECURITY DEFINER expostas pelo PostgREST.
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- Garante que as views respeitem RLS/permissoes do usuario invocador.
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
    if to_regclass('public.' || view_name) is not null then
      execute format('alter view public.%I set (security_invoker = true)', view_name);
    end if;
  end loop;
end $$;

-- RLS em tabelas que estavam publicas.
alter table if exists public.order_status_transitions enable row level security;
alter table if exists public.stock_balances enable row level security;
alter table if exists public.inventory_sessions enable row level security;
alter table if exists public.inventory_items enable row level security;
alter table if exists public.production_productivity enable row level security;
alter table if exists public.order_items_labels enable row level security;
alter table if exists public.stock_transfers enable row level security;
alter table if exists public.stock_transfer_items enable row level security;
alter table if exists public.stock_balance_audit enable row level security;
alter table if exists public.carriers enable row level security;
alter table if exists public.suppliers enable row level security;
alter table if exists public.user_module_permissions enable row level security;

-- Tabela de transicoes: referencia operacional, leitura autenticada, escrita somente via service_role/migrations.
drop policy if exists order_status_transitions_authenticated_read on public.order_status_transitions;
create policy order_status_transitions_authenticated_read
  on public.order_status_transitions
  for select
  to authenticated
  using (true);

-- Stock balances por estabelecimento.
drop policy if exists stock_balances_member_select on public.stock_balances;
create policy stock_balances_member_select
  on public.stock_balances
  for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

drop policy if exists stock_balances_member_insert on public.stock_balances;
create policy stock_balances_member_insert
  on public.stock_balances
  for insert
  to authenticated
  with check (public.is_establishment_member(establishment_id));

drop policy if exists stock_balances_member_update on public.stock_balances;
create policy stock_balances_member_update
  on public.stock_balances
  for update
  to authenticated
  using (public.is_establishment_member(establishment_id))
  with check (public.is_establishment_member(establishment_id));

-- Inventario.
drop policy if exists inventory_sessions_member_select on public.inventory_sessions;
create policy inventory_sessions_member_select
  on public.inventory_sessions
  for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

drop policy if exists inventory_sessions_member_insert on public.inventory_sessions;
create policy inventory_sessions_member_insert
  on public.inventory_sessions
  for insert
  to authenticated
  with check (
    public.is_establishment_member(establishment_id)
    and created_by = auth.uid()
  );

drop policy if exists inventory_sessions_member_update on public.inventory_sessions;
create policy inventory_sessions_member_update
  on public.inventory_sessions
  for update
  to authenticated
  using (public.is_establishment_member(establishment_id))
  with check (public.is_establishment_member(establishment_id));

drop policy if exists inventory_items_member_select on public.inventory_items;
create policy inventory_items_member_select
  on public.inventory_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.inventory_sessions s
      where s.id = inventory_items.session_id
        and public.is_establishment_member(s.establishment_id)
    )
  );

drop policy if exists inventory_items_member_insert on public.inventory_items;
create policy inventory_items_member_insert
  on public.inventory_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.inventory_sessions s
      where s.id = inventory_items.session_id
        and public.is_establishment_member(s.establishment_id)
    )
  );

drop policy if exists inventory_items_member_update on public.inventory_items;
create policy inventory_items_member_update
  on public.inventory_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.inventory_sessions s
      where s.id = inventory_items.session_id
        and public.is_establishment_member(s.establishment_id)
    )
  )
  with check (
    exists (
      select 1
      from public.inventory_sessions s
      where s.id = inventory_items.session_id
        and public.is_establishment_member(s.establishment_id)
    )
  );

-- Produtividade por pedido/item.
drop policy if exists production_productivity_member_select on public.production_productivity;
create policy production_productivity_member_select
  on public.production_productivity
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.order_line_items oli
      where oli.id = production_productivity.order_item_id
        and public.is_establishment_member(oli.establishment_id)
    )
    or exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = production_productivity.order_item_id_alt
        and public.is_establishment_member(o.establishment_id)
    )
  );

drop policy if exists production_productivity_member_insert on public.production_productivity;
create policy production_productivity_member_insert
  on public.production_productivity
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.order_line_items oli
      where oli.id = production_productivity.order_item_id
        and public.is_establishment_member(oli.establishment_id)
    )
    or exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = production_productivity.order_item_id_alt
        and public.is_establishment_member(o.establishment_id)
    )
  );

-- Labels usados em pedidos.
drop policy if exists order_items_labels_member_select on public.order_items_labels;
create policy order_items_labels_member_select
  on public.order_items_labels
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items_labels.order_id
        and public.is_establishment_member(o.establishment_id)
    )
  );

drop policy if exists order_items_labels_member_insert on public.order_items_labels;
create policy order_items_labels_member_insert
  on public.order_items_labels
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_items_labels.order_id
        and public.is_establishment_member(o.establishment_id)
    )
  );

-- Transferencias de estoque.
drop policy if exists stock_transfers_member_select on public.stock_transfers;
create policy stock_transfers_member_select
  on public.stock_transfers
  for select
  to authenticated
  using (
    public.is_establishment_member(from_establishment_id)
    or public.is_establishment_member(to_establishment_id)
  );

drop policy if exists stock_transfers_member_insert on public.stock_transfers;
create policy stock_transfers_member_insert
  on public.stock_transfers
  for insert
  to authenticated
  with check (
    public.is_establishment_member(from_establishment_id)
    and public.is_establishment_member(to_establishment_id)
  );

drop policy if exists stock_transfers_member_update on public.stock_transfers;
create policy stock_transfers_member_update
  on public.stock_transfers
  for update
  to authenticated
  using (
    public.is_establishment_member(from_establishment_id)
    and public.is_establishment_member(to_establishment_id)
  )
  with check (
    public.is_establishment_member(from_establishment_id)
    and public.is_establishment_member(to_establishment_id)
  );

drop policy if exists stock_transfer_items_member_select on public.stock_transfer_items;
create policy stock_transfer_items_member_select
  on public.stock_transfer_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.stock_transfers st
      where st.id = stock_transfer_items.transfer_id
        and (
          public.is_establishment_member(st.from_establishment_id)
          or public.is_establishment_member(st.to_establishment_id)
        )
    )
  );

drop policy if exists stock_transfer_items_member_insert on public.stock_transfer_items;
create policy stock_transfer_items_member_insert
  on public.stock_transfer_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.stock_transfers st
      where st.id = stock_transfer_items.transfer_id
        and public.is_establishment_member(st.from_establishment_id)
        and public.is_establishment_member(st.to_establishment_id)
    )
  );

-- Auditoria de estoque: leitura para membros, escrita somente pelo proprio usuario autenticado ou service_role.
drop policy if exists stock_balance_audit_member_select on public.stock_balance_audit;
create policy stock_balance_audit_member_select
  on public.stock_balance_audit
  for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

drop policy if exists stock_balance_audit_member_insert on public.stock_balance_audit;
create policy stock_balance_audit_member_insert
  on public.stock_balance_audit
  for insert
  to authenticated
  with check (
    public.is_establishment_member(establishment_id)
    and (user_id is null or user_id = auth.uid())
  );

-- Transportadoras legadas.
drop policy if exists carriers_member_select on public.carriers;
create policy carriers_member_select
  on public.carriers
  for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

drop policy if exists carriers_admin_write on public.carriers;
create policy carriers_admin_write
  on public.carriers
  for all
  to authenticated
  using (public.is_establishment_admin(establishment_id))
  with check (public.is_establishment_admin(establishment_id));

-- Suppliers ainda nao tem establishment_id. Ate normalizar o modelo,
-- remove acesso anonimo e restringe escrita a usuarios admin de algum estabelecimento.
drop policy if exists suppliers_authenticated_read on public.suppliers;
create policy suppliers_authenticated_read
  on public.suppliers
  for select
  to authenticated
  using (true);

drop policy if exists suppliers_admin_write on public.suppliers;
create policy suppliers_admin_write
  on public.suppliers
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active = true
        and m.role = 'admin'
    )
    or exists (
      select 1
      from public.establishment_memberships em
      where em.user_id = auth.uid()
        and em.is_active = true
        and em.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active = true
        and m.role = 'admin'
    )
    or exists (
      select 1
      from public.establishment_memberships em
      where em.user_id = auth.uid()
        and em.is_active = true
        and em.role = 'admin'
    )
  );

-- Permissoes por modulo.
drop policy if exists user_module_permissions_member_select on public.user_module_permissions;
create policy user_module_permissions_member_select
  on public.user_module_permissions
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_establishment_admin(establishment_id)
  );

drop policy if exists user_module_permissions_admin_write on public.user_module_permissions;
create policy user_module_permissions_admin_write
  on public.user_module_permissions
  for all
  to authenticated
  using (public.is_establishment_admin(establishment_id))
  with check (public.is_establishment_admin(establishment_id));

-- Corrige policies permissivas conhecidas de fiscal.
drop policy if exists "Authenticated users can delete fiscal company profiles" on public.fiscal_company_profiles;
drop policy if exists "Authenticated users can insert fiscal company profiles" on public.fiscal_company_profiles;
drop policy if exists "Authenticated users can update fiscal company profiles" on public.fiscal_company_profiles;
drop policy if exists fiscal_company_profiles_admin_write on public.fiscal_company_profiles;
create policy fiscal_company_profiles_admin_write
  on public.fiscal_company_profiles
  for all
  to authenticated
  using (public.is_establishment_admin(establishment_id))
  with check (public.is_establishment_admin(establishment_id));

drop policy if exists "Authenticated users can delete fiscal product mappings" on public.fiscal_product_mappings;
drop policy if exists "Authenticated users can insert fiscal product mappings" on public.fiscal_product_mappings;
drop policy if exists "Authenticated users can update fiscal product mappings" on public.fiscal_product_mappings;
drop policy if exists fiscal_product_mappings_admin_write on public.fiscal_product_mappings;
create policy fiscal_product_mappings_admin_write
  on public.fiscal_product_mappings
  for all
  to authenticated
  using (public.is_establishment_admin(establishment_id))
  with check (public.is_establishment_admin(establishment_id));

-- Corrige INSERT permissivo em versionamento de fichas tecnicas.
drop policy if exists insert_logs_authenticated on public.technical_sheet_revision_logs;
drop policy if exists technical_sheet_revision_logs_member_insert on public.technical_sheet_revision_logs;
create policy technical_sheet_revision_logs_member_insert
  on public.technical_sheet_revision_logs
  for insert
  to authenticated
  with check (
    performed_by = auth.uid()
    and exists (
      select 1
      from public.technical_sheets ts
      where ts.id = technical_sheet_revision_logs.technical_sheet_id
        and public.is_establishment_member(ts.establishment_id)
    )
  );

drop policy if exists insert_versions_authenticated on public.technical_sheet_versions;
drop policy if exists technical_sheet_versions_member_insert on public.technical_sheet_versions;
create policy technical_sheet_versions_member_insert
  on public.technical_sheet_versions
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.is_establishment_member(establishment_id)
  );

-- Remove policies de listagem ampla em buckets publicos.
drop policy if exists "invoice entry files public read" on storage.objects;
drop policy if exists "technical sheet images public read" on storage.objects;
drop policy if exists technical_sheet_images_public_read on storage.objects;

drop policy if exists invoice_entry_files_authenticated_read on storage.objects;
create policy invoice_entry_files_authenticated_read
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'invoice-entry-files');

drop policy if exists technical_sheet_images_authenticated_read on storage.objects;
create policy technical_sheet_images_authenticated_read
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'technical-sheet-images');

commit;
