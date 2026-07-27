begin;

-- Performance hardening from Supabase Advisor lint 0003_auth_rls_initplan.
-- Keeps the same access rules, but only touches policies that exist in the
-- target database so clean preview branches and older tenants stay migratable.

do $$
begin
  if to_regclass('public.customers') is not null and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_insert_temp_authenticated'
  ) then
    execute 'alter policy customers_insert_temp_authenticated on public.customers with check ((select auth.uid()) is not null)';
  end if;

  if to_regclass('public.customers') is not null and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_select_authenticated'
  ) then
    execute 'alter policy customers_select_authenticated on public.customers using ((select auth.uid()) is not null)';
  end if;

  if to_regclass('public.customers') is not null and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_select_by_establishment'
  ) then
    execute $policy$
      alter policy customers_select_by_establishment
        on public.customers
        using (
          exists (
            select 1
            from public.memberships m
            where m.user_id = (select auth.uid())
              and m.establishment_id = customers.establishment_id
          )
        )
    $policy$;
  end if;

  if to_regclass('public.customers') is not null and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_upsert_admin'
  ) then
    execute $policy$
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
        )
    $policy$;
  end if;

  if to_regclass('public.establishments') is not null and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'establishments'
      and policyname = 'establishments_select_member'
  ) then
    execute $policy$
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
        )
    $policy$;
  end if;

  if to_regclass('public.orders') is not null and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders'
      and policyname = 'orders_insert_authenticated'
  ) then
    execute 'alter policy orders_insert_authenticated on public.orders with check ((select auth.uid()) is not null)';
  end if;

  if to_regclass('public.orders') is not null and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders'
      and policyname = 'orders_insert_own'
  ) then
    execute 'alter policy orders_insert_own on public.orders with check (customer_user_id = (select auth.uid()))';
  end if;

  if to_regclass('public.orders') is not null
    and to_regprocedure('public.my_role_in_establishment(uuid)') is not null
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'orders'
        and policyname = 'orders_insert_member_same_unit'
    )
  then
    execute $policy$
      alter policy orders_insert_member_same_unit
        on public.orders
        with check (
          created_by = (select auth.uid())
          and public.my_role_in_establishment(establishment_id) is not null
        )
    $policy$;
  end if;

  if to_regclass('public.orders') is not null
    and to_regprocedure('public.is_staff()') is not null
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'orders'
        and policyname = 'orders_select_own_or_staff'
    )
  then
    execute $policy$
      alter policy orders_select_own_or_staff
        on public.orders
        using (
          public.is_staff()
          or created_by = (select auth.uid())
        )
    $policy$;
  end if;

  if to_regclass('public.orders') is not null
    and to_regprocedure('public.my_role_in_establishment(uuid)') is not null
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'orders'
        and policyname = 'orders_select_cliente_only_own'
    )
  then
    execute $policy$
      alter policy orders_select_cliente_only_own
        on public.orders
        using (
          public.my_role_in_establishment(establishment_id) = 'cliente'::public.app_role
          and created_by = (select auth.uid())
        )
    $policy$;
  end if;

  if to_regclass('public.order_items') is not null and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'order_items'
      and policyname = 'order_items_insert_own_only_in_created'
  ) then
    execute $policy$
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
        )
    $policy$;
  end if;

  if to_regclass('public.order_items') is not null
    and to_regprocedure('public.is_staff()') is not null
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'order_items'
        and policyname = 'order_items_select_own_or_staff'
    )
  then
    execute $policy$
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
        )
    $policy$;
  end if;

  if to_regclass('public.invoices') is not null
    and to_regprocedure('public.is_staff()') is not null
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'invoices'
        and policyname = 'invoices_select_owner_or_staff'
    )
  then
    execute $policy$
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
        )
    $policy$;
  end if;

  if to_regclass('public.invoice_items') is not null
    and to_regclass('public.invoices') is not null
    and to_regprocedure('public.is_staff()') is not null
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'invoice_items'
        and policyname = 'invoice_items_select_owner_or_staff'
    )
  then
    execute $policy$
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
        )
    $policy$;
  end if;

  if to_regclass('public.order_status_events') is not null and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'order_status_events'
      and policyname = 'status_events_insert_own_created'
  ) then
    execute $policy$
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
        )
    $policy$;
  end if;

  if to_regclass('public.order_status_events') is not null
    and to_regprocedure('public.is_staff()') is not null
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'order_status_events'
        and policyname = 'status_events_select_own_or_staff'
    )
  then
    execute $policy$
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
        )
    $policy$;
  end if;

  if to_regclass('public.order_status_events') is not null
    and to_regprocedure('public.is_staff()') is not null
    and to_regprocedure('public.order_belongs_to_user(uuid, uuid)') is not null
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'order_status_events'
        and policyname = 'select_timeline_events'
    )
  then
    execute $policy$
      alter policy select_timeline_events
        on public.order_status_events
        using (
          public.is_staff()
          or public.order_belongs_to_user(order_id, (select auth.uid()))
        )
    $policy$;
  end if;
end $$;

commit;
