begin;

-- Performance hardening from Supabase Advisor lint 0003_auth_rls_initplan.
-- This preserves the same access rules, but wraps auth.* calls in scalar subqueries
-- so PostgreSQL can initialize them once per statement instead of per row.

alter policy customers_insert_temp_authenticated
  on public.customers
  with check ((select auth.uid()) is not null);

alter policy customers_select_authenticated
  on public.customers
  using ((select auth.uid()) is not null);

alter policy customers_select_by_establishment
  on public.customers
  using (
    exists (
      select 1
      from public.memberships m
      where m.user_id = (select auth.uid())
        and m.establishment_id = customers.establishment_id
    )
  );

alter policy customers_upsert_admin
  on public.customers
  using (
    exists (
      select 1
      from public.memberships m
      where m.user_id = (select auth.uid())
        and m.role = 'admin'::text
        and m.establishment_id = customers.establishment_id
    )
  )
  with check (
    exists (
      select 1
      from public.memberships m
      where m.user_id = (select auth.uid())
        and m.role = 'admin'::text
        and m.establishment_id = customers.establishment_id
    )
  );

alter policy establishments_select_member
  on public.establishments
  using (
    exists (
      select 1
      from public.establishment_memberships m
      where m.establishment_id = establishments.id
        and m.user_id = (select auth.uid())
        and m.is_active = true
    )
  );

alter policy orders_insert_authenticated
  on public.orders
  with check ((select auth.uid()) is not null);

alter policy orders_insert_own
  on public.orders
  with check (customer_user_id = (select auth.uid()));

alter policy orders_insert_member_same_unit
  on public.orders
  with check (
    created_by = (select auth.uid())
    and public.my_role_in_establishment(establishment_id) is not null
  );

alter policy orders_select_own_or_staff
  on public.orders
  using (
    public.is_staff()
    or created_by = (select auth.uid())
  );

alter policy orders_select_cliente_only_own
  on public.orders
  using (
    public.my_role_in_establishment(establishment_id) = 'cliente'::public.app_role
    and created_by = (select auth.uid())
  );

alter policy order_items_insert_own_only_in_created
  on public.order_items
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and o.customer_user_id = (select auth.uid())
        and o.status = 'pedido_criado'::public.order_status
    )
  );

alter policy order_items_select_own_or_staff
  on public.order_items
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and (
          o.customer_user_id = (select auth.uid())
          or public.is_staff()
        )
    )
  );

alter policy invoices_select_owner_or_staff
  on public.invoices
  using (
    public.is_staff()
    or exists (
      select 1
      from public.orders o
      where o.id = invoices.order_id
        and o.created_by = (select auth.uid())
    )
  );

alter policy invoice_items_select_owner_or_staff
  on public.invoice_items
  using (
    public.is_staff()
    or exists (
      select 1
      from public.invoices i
      join public.orders o on o.id = i.order_id
      where i.id = invoice_items.invoice_id
        and o.created_by = (select auth.uid())
    )
  );

alter policy status_events_insert_own_created
  on public.order_status_events
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.orders o
      where o.id = order_status_events.order_id
        and o.customer_user_id = (select auth.uid())
    )
  );

alter policy status_events_select_own_or_staff
  on public.order_status_events
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_status_events.order_id
        and (
          o.customer_user_id = (select auth.uid())
          or public.is_staff()
        )
    )
  );

alter policy select_timeline_events
  on public.order_status_events
  using (
    public.is_staff()
    or public.order_belongs_to_user(order_id, (select auth.uid()))
  );

commit;
