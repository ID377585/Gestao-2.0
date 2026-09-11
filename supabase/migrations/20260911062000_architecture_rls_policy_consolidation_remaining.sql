begin;

-- Version the remaining Production RLS consolidation already validated operationally.
-- Some of these legacy tables exist in long-lived environments but are not yet created by
-- the canonical fresh-replay history. Guard each optional table so a clean database remains
-- reproducible without weakening the policy consolidation where the table exists.

do $$
begin
  if to_regclass('public.fiscal_certificates') is not null then
    drop policy if exists fiscal_certificates_fiscal_write on public.fiscal_certificates;
    create policy fiscal_certificates_fiscal_insert on public.fiscal_certificates for insert to authenticated with check (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
    create policy fiscal_certificates_fiscal_update on public.fiscal_certificates for update to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal'])) with check (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
    create policy fiscal_certificates_fiscal_delete on public.fiscal_certificates for delete to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
  end if;

  if to_regclass('public.fiscal_nfe_inbox') is not null then
    drop policy if exists fiscal_nfe_inbox_fiscal_write on public.fiscal_nfe_inbox;
    create policy fiscal_nfe_inbox_fiscal_insert on public.fiscal_nfe_inbox for insert to authenticated with check (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
    create policy fiscal_nfe_inbox_fiscal_update on public.fiscal_nfe_inbox for update to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal'])) with check (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
    create policy fiscal_nfe_inbox_fiscal_delete on public.fiscal_nfe_inbox for delete to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
  end if;

  if to_regclass('public.fiscal_nsu_control') is not null then
    drop policy if exists fiscal_nsu_control_fiscal_write on public.fiscal_nsu_control;
    create policy fiscal_nsu_control_fiscal_insert on public.fiscal_nsu_control for insert to authenticated with check (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
    create policy fiscal_nsu_control_fiscal_update on public.fiscal_nsu_control for update to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal'])) with check (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
    create policy fiscal_nsu_control_fiscal_delete on public.fiscal_nsu_control for delete to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
  end if;

  if to_regclass('public.import_job_pages') is not null and to_regclass('public.import_jobs') is not null then
    drop policy if exists import_job_pages_tenant_write on public.import_job_pages;
    create policy import_job_pages_tenant_insert on public.import_job_pages for insert to authenticated with check (exists (select 1 from public.import_jobs j where j.id=import_job_pages.job_id and private.gestify_has_establishment_role(j.establishment_id,array['admin','operacao'])));
    create policy import_job_pages_tenant_update on public.import_job_pages for update to authenticated using (exists (select 1 from public.import_jobs j where j.id=import_job_pages.job_id and private.gestify_has_establishment_role(j.establishment_id,array['admin','operacao']))) with check (exists (select 1 from public.import_jobs j where j.id=import_job_pages.job_id and private.gestify_has_establishment_role(j.establishment_id,array['admin','operacao'])));
    create policy import_job_pages_tenant_delete on public.import_job_pages for delete to authenticated using (exists (select 1 from public.import_jobs j where j.id=import_job_pages.job_id and private.gestify_has_establishment_role(j.establishment_id,array['admin','operacao'])));
  end if;

  if to_regclass('public.stock_transfer_items') is not null and to_regclass('public.stock_transfers') is not null then
    drop policy if exists stock_transfer_items_write on public.stock_transfer_items;
    drop policy if exists gestify_stock_transfer_items_write on public.stock_transfer_items;
    create policy gestify_stock_transfer_items_insert on public.stock_transfer_items for insert to authenticated with check (exists (select 1 from public.stock_transfers st where st.id=stock_transfer_items.transfer_id and private.gestify_has_establishment_role(st.from_establishment_id,array['admin','estoque','operacao'])));
    create policy gestify_stock_transfer_items_update on public.stock_transfer_items for update to authenticated using (exists (select 1 from public.stock_transfers st where st.id=stock_transfer_items.transfer_id and private.gestify_has_establishment_role(st.from_establishment_id,array['admin','estoque','operacao']))) with check (exists (select 1 from public.stock_transfers st where st.id=stock_transfer_items.transfer_id and private.gestify_has_establishment_role(st.from_establishment_id,array['admin','estoque','operacao'])));
    create policy gestify_stock_transfer_items_delete on public.stock_transfer_items for delete to authenticated using (exists (select 1 from public.stock_transfers st where st.id=stock_transfer_items.transfer_id and private.gestify_has_establishment_role(st.from_establishment_id,array['admin','estoque','operacao'])));
  end if;

  if to_regclass('public.technical_sheet_scales') is not null and to_regclass('public.technical_sheets') is not null then
    drop policy if exists technical_sheet_scales_tenant_write on public.technical_sheet_scales;
    create policy technical_sheet_scales_tenant_insert on public.technical_sheet_scales for insert to authenticated with check (exists (select 1 from public.technical_sheets ts where ts.id=technical_sheet_scales.technical_sheet_id and private.gestify_has_establishment_role(ts.establishment_id,array['admin','operacao'])));
    create policy technical_sheet_scales_tenant_update on public.technical_sheet_scales for update to authenticated using (exists (select 1 from public.technical_sheets ts where ts.id=technical_sheet_scales.technical_sheet_id and private.gestify_has_establishment_role(ts.establishment_id,array['admin','operacao']))) with check (exists (select 1 from public.technical_sheets ts where ts.id=technical_sheet_scales.technical_sheet_id and private.gestify_has_establishment_role(ts.establishment_id,array['admin','operacao'])));
    create policy technical_sheet_scales_tenant_delete on public.technical_sheet_scales for delete to authenticated using (exists (select 1 from public.technical_sheets ts where ts.id=technical_sheet_scales.technical_sheet_id and private.gestify_has_establishment_role(ts.establishment_id,array['admin','operacao'])));
  end if;

  if to_regclass('public.technical_sheet_scale_ingredients') is not null and to_regclass('public.technical_sheet_scales') is not null and to_regclass('public.technical_sheets') is not null then
    drop policy if exists technical_sheet_scale_ingredients_tenant_write on public.technical_sheet_scale_ingredients;
    create policy technical_sheet_scale_ingredients_tenant_insert on public.technical_sheet_scale_ingredients for insert to authenticated with check (exists (select 1 from public.technical_sheet_scales s join public.technical_sheets ts on ts.id=s.technical_sheet_id where s.id=technical_sheet_scale_ingredients.scale_id and private.gestify_has_establishment_role(ts.establishment_id,array['admin','operacao'])));
    create policy technical_sheet_scale_ingredients_tenant_update on public.technical_sheet_scale_ingredients for update to authenticated using (exists (select 1 from public.technical_sheet_scales s join public.technical_sheets ts on ts.id=s.technical_sheet_id where s.id=technical_sheet_scale_ingredients.scale_id and private.gestify_has_establishment_role(ts.establishment_id,array['admin','operacao']))) with check (exists (select 1 from public.technical_sheet_scales s join public.technical_sheets ts on ts.id=s.technical_sheet_id where s.id=technical_sheet_scale_ingredients.scale_id and private.gestify_has_establishment_role(ts.establishment_id,array['admin','operacao'])));
    create policy technical_sheet_scale_ingredients_tenant_delete on public.technical_sheet_scale_ingredients for delete to authenticated using (exists (select 1 from public.technical_sheet_scales s join public.technical_sheets ts on ts.id=s.technical_sheet_id where s.id=technical_sheet_scale_ingredients.scale_id and private.gestify_has_establishment_role(ts.establishment_id,array['admin','operacao'])));
  end if;

  if to_regclass('public.organizations') is not null and to_regclass('public.memberships') is not null then
    drop policy if exists organizations_admin_manage on public.organizations;
    create policy organizations_admin_insert on public.organizations for insert to authenticated with check (exists (select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.is_active=true and m.role='admin'));
    create policy organizations_admin_update on public.organizations for update to authenticated using (exists (select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.is_active=true and m.role='admin')) with check (exists (select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.is_active=true and m.role='admin'));
    create policy organizations_admin_delete on public.organizations for delete to authenticated using (exists (select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.is_active=true and m.role='admin'));
  end if;

  if to_regclass('public.units') is not null and to_regclass('public.memberships') is not null then
    drop policy if exists units_admin_manage on public.units;
    create policy units_admin_insert on public.units for insert to authenticated with check (exists (select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.is_active=true and m.role='admin'));
    create policy units_admin_update on public.units for update to authenticated using (exists (select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.is_active=true and m.role='admin')) with check (exists (select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.is_active=true and m.role='admin'));
    create policy units_admin_delete on public.units for delete to authenticated using (exists (select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.is_active=true and m.role='admin'));
  end if;
end
$$;

notify pgrst, 'reload schema';
commit;
