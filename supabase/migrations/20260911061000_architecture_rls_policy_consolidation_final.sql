begin;

-- Replace broad ALL policies with command-specific policies. The predicates are
-- intentionally equivalent to the already validated staging policies.
drop policy if exists fiscal_product_mappings_fiscal_write on public.fiscal_product_mappings;
drop policy if exists fiscal_product_mappings_fiscal_delete on public.fiscal_product_mappings;
drop policy if exists fiscal_product_mappings_fiscal_insert on public.fiscal_product_mappings;
drop policy if exists fiscal_product_mappings_fiscal_update on public.fiscal_product_mappings;
create policy fiscal_product_mappings_fiscal_delete on public.fiscal_product_mappings for delete to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
create policy fiscal_product_mappings_fiscal_insert on public.fiscal_product_mappings for insert to authenticated with check (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));
create policy fiscal_product_mappings_fiscal_update on public.fiscal_product_mappings for update to authenticated using (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal'])) with check (private.gestify_has_establishment_role(establishment_id, array['admin','fiscal']));

drop policy if exists hr_employee_face_profiles_admin_write on public.hr_employee_face_profiles;
drop policy if exists hr_employee_face_profiles_admin_delete on public.hr_employee_face_profiles;
drop policy if exists hr_employee_face_profiles_admin_insert on public.hr_employee_face_profiles;
drop policy if exists hr_employee_face_profiles_admin_update on public.hr_employee_face_profiles;
create policy hr_employee_face_profiles_admin_delete on public.hr_employee_face_profiles for delete to authenticated using ((select private.gestify_has_establishment_role(hr_employee_face_profiles.establishment_id, array['admin','operacao'])));
create policy hr_employee_face_profiles_admin_insert on public.hr_employee_face_profiles for insert to authenticated with check ((select private.gestify_has_establishment_role(hr_employee_face_profiles.establishment_id, array['admin','operacao'])));
create policy hr_employee_face_profiles_admin_update on public.hr_employee_face_profiles for update to authenticated using ((select private.gestify_has_establishment_role(hr_employee_face_profiles.establishment_id, array['admin','operacao']))) with check ((select private.gestify_has_establishment_role(hr_employee_face_profiles.establishment_id, array['admin','operacao'])));

drop policy if exists hr_employee_schedules_admin_write on public.hr_employee_schedules;
drop policy if exists hr_employee_schedules_admin_delete on public.hr_employee_schedules;
drop policy if exists hr_employee_schedules_admin_insert on public.hr_employee_schedules;
drop policy if exists hr_employee_schedules_admin_update on public.hr_employee_schedules;
create policy hr_employee_schedules_admin_delete on public.hr_employee_schedules for delete to authenticated using ((select private.gestify_has_establishment_role(hr_employee_schedules.establishment_id, array['admin'])));
create policy hr_employee_schedules_admin_insert on public.hr_employee_schedules for insert to authenticated with check ((select private.gestify_has_establishment_role(hr_employee_schedules.establishment_id, array['admin'])));
create policy hr_employee_schedules_admin_update on public.hr_employee_schedules for update to authenticated using ((select private.gestify_has_establishment_role(hr_employee_schedules.establishment_id, array['admin']))) with check ((select private.gestify_has_establishment_role(hr_employee_schedules.establishment_id, array['admin'])));

drop policy if exists hr_holidays_admin_write on public.hr_holidays;
drop policy if exists hr_holidays_admin_delete on public.hr_holidays;
drop policy if exists hr_holidays_admin_insert on public.hr_holidays;
drop policy if exists hr_holidays_admin_update on public.hr_holidays;
create policy hr_holidays_admin_delete on public.hr_holidays for delete to authenticated using ((select private.gestify_has_establishment_role(hr_holidays.establishment_id, array['admin'])));
create policy hr_holidays_admin_insert on public.hr_holidays for insert to authenticated with check ((select private.gestify_has_establishment_role(hr_holidays.establishment_id, array['admin'])));
create policy hr_holidays_admin_update on public.hr_holidays for update to authenticated using ((select private.gestify_has_establishment_role(hr_holidays.establishment_id, array['admin']))) with check ((select private.gestify_has_establishment_role(hr_holidays.establishment_id, array['admin'])));

drop policy if exists gestify_inventory_items_write on public.inventory_items;
drop policy if exists gestify_inventory_items_delete on public.inventory_items;
drop policy if exists gestify_inventory_items_insert on public.inventory_items;
drop policy if exists gestify_inventory_items_update on public.inventory_items;
create policy gestify_inventory_items_delete on public.inventory_items for delete to authenticated using (exists (select 1 from public.inventory_sessions s where s.id=inventory_items.session_id and private.gestify_has_establishment_role(s.establishment_id,array['admin','estoque','operacao'])));
create policy gestify_inventory_items_insert on public.inventory_items for insert to authenticated with check (exists (select 1 from public.inventory_sessions s where s.id=inventory_items.session_id and private.gestify_has_establishment_role(s.establishment_id,array['admin','estoque','operacao'])));
create policy gestify_inventory_items_update on public.inventory_items for update to authenticated using (exists (select 1 from public.inventory_sessions s where s.id=inventory_items.session_id and private.gestify_has_establishment_role(s.establishment_id,array['admin','estoque','operacao']))) with check (exists (select 1 from public.inventory_sessions s where s.id=inventory_items.session_id and private.gestify_has_establishment_role(s.establishment_id,array['admin','estoque','operacao'])));

drop policy if exists gestify_order_items_labels_write on public.order_items_labels;
drop policy if exists gestify_order_items_labels_delete on public.order_items_labels;
drop policy if exists gestify_order_items_labels_insert on public.order_items_labels;
drop policy if exists gestify_order_items_labels_update on public.order_items_labels;
create policy gestify_order_items_labels_delete on public.order_items_labels for delete to authenticated using (exists (select 1 from public.orders o where o.id=order_items_labels.order_id and private.gestify_has_establishment_role(o.establishment_id,array['admin','operacao','estoque'])));
create policy gestify_order_items_labels_insert on public.order_items_labels for insert to authenticated with check (exists (select 1 from public.orders o where o.id=order_items_labels.order_id and private.gestify_has_establishment_role(o.establishment_id,array['admin','operacao','estoque'])));
create policy gestify_order_items_labels_update on public.order_items_labels for update to authenticated using (exists (select 1 from public.orders o where o.id=order_items_labels.order_id and private.gestify_has_establishment_role(o.establishment_id,array['admin','operacao','estoque']))) with check (exists (select 1 from public.orders o where o.id=order_items_labels.order_id and private.gestify_has_establishment_role(o.establishment_id,array['admin','operacao','estoque'])));

drop policy if exists production_productivity_tenant_write on public.production_productivity;
drop policy if exists production_productivity_tenant_delete on public.production_productivity;
drop policy if exists production_productivity_tenant_insert on public.production_productivity;
drop policy if exists production_productivity_tenant_update on public.production_productivity;
create policy production_productivity_tenant_delete on public.production_productivity for delete to authenticated using ((exists (select 1 from public.order_line_items oli where oli.id=production_productivity.order_item_id and private.gestify_has_establishment_role(oli.establishment_id,array['admin','operacao','producao'])) or exists (select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where oi.id=production_productivity.order_item_id_alt and private.gestify_has_establishment_role(o.establishment_id,array['admin','operacao','producao']))));
create policy production_productivity_tenant_insert on public.production_productivity for insert to authenticated with check ((exists (select 1 from public.order_line_items oli where oli.id=production_productivity.order_item_id and private.gestify_has_establishment_role(oli.establishment_id,array['admin','operacao','producao'])) or exists (select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where oi.id=production_productivity.order_item_id_alt and private.gestify_has_establishment_role(o.establishment_id,array['admin','operacao','producao']))));
create policy production_productivity_tenant_update on public.production_productivity for update to authenticated using ((exists (select 1 from public.order_line_items oli where oli.id=production_productivity.order_item_id and private.gestify_has_establishment_role(oli.establishment_id,array['admin','operacao','producao'])) or exists (select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where oi.id=production_productivity.order_item_id_alt and private.gestify_has_establishment_role(o.establishment_id,array['admin','operacao','producao'])))) with check ((exists (select 1 from public.order_line_items oli where oli.id=production_productivity.order_item_id and private.gestify_has_establishment_role(oli.establishment_id,array['admin','operacao','producao'])) or exists (select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where oi.id=production_productivity.order_item_id_alt and private.gestify_has_establishment_role(o.establishment_id,array['admin','operacao','producao']))));

drop policy if exists gestify_tenant_delete_admin on public.user_module_permissions;
drop policy if exists gestify_tenant_insert_staff on public.user_module_permissions;
drop policy if exists "read own active module permissions" on public.user_module_permissions;
drop policy if exists gestify_tenant_update_staff on public.user_module_permissions;
drop policy if exists user_module_permissions_delete on public.user_module_permissions;
drop policy if exists user_module_permissions_insert on public.user_module_permissions;
drop policy if exists user_module_permissions_select on public.user_module_permissions;
drop policy if exists user_module_permissions_update on public.user_module_permissions;
create policy user_module_permissions_delete on public.user_module_permissions for delete to authenticated using (private.gestify_has_establishment_role(establishment_id,array['admin']) or private.current_user_can_manage_establishment_impl(establishment_id));
create policy user_module_permissions_insert on public.user_module_permissions for insert to authenticated with check (private.gestify_has_establishment_role(establishment_id,array['admin','operacao','estoque','fiscal']) or private.current_user_can_manage_establishment_impl(establishment_id));
create policy user_module_permissions_select on public.user_module_permissions for select to authenticated using (((user_id=(select auth.uid())) and exists (select 1 from public.memberships m where m.establishment_id=user_module_permissions.establishment_id and m.user_id=(select auth.uid()) and m.is_active=true)) or private.current_user_can_manage_establishment_impl(establishment_id));
create policy user_module_permissions_update on public.user_module_permissions for update to authenticated using (private.gestify_has_establishment_role(establishment_id,array['admin','operacao','estoque','fiscal']) or private.current_user_can_manage_establishment_impl(establishment_id)) with check (private.gestify_has_establishment_role(establishment_id,array['admin','operacao','estoque','fiscal']) or private.current_user_can_manage_establishment_impl(establishment_id));

notify pgrst, 'reload schema';
commit;
