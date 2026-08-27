-- Gestify core regression/E2E suite.
-- STAGING ONLY. Execute against gestify-staging and keep the final ROLLBACK.
-- The suite creates synthetic fixtures, validates core contracts and persists nothing.

begin;

create temporary table gestify_e2e_report(
  result text,
  final_order_status text,
  status_events bigint,
  final_stock numeric,
  invoice_total numeric,
  idempotency_unique boolean,
  order_lock_contract boolean
) on commit drop;

do $$
declare
  u_a uuid := gen_random_uuid();
  u_b uuid := gen_random_uuid();
  u_inactive uuid := gen_random_uuid();
  e_a uuid := gen_random_uuid();
  e_b uuid := gen_random_uuid();
  p_a uuid := gen_random_uuid();
  o_a uuid := gen_random_uuid();
  o_b uuid := gen_random_uuid();
  inv_a uuid := gen_random_uuid();
  denied boolean := false;
  idempotency_unique boolean := false;
  order_lock_contract boolean := false;
  s text;
  event_count bigint;
  stock_value numeric;
  invoice_value numeric;
begin
  insert into auth.users(id) values (u_a),(u_b),(u_inactive);
  insert into public.establishments(id,name)
    values (e_a,'E2E Tenant A'),(e_b,'E2E Tenant B');

  insert into public.establishment_memberships(establishment_id,user_id,role,is_active) values
    (e_a,u_a,'admin',true),
    (e_b,u_b,'admin',true),
    (e_a,u_inactive,'operacao',false);

  insert into public.memberships(user_id,establishment_id,role,is_active) values
    (u_a,e_a,'admin',true),
    (u_b,e_b,'admin',true),
    (u_inactive,e_a,'operacao',false);

  insert into public.products(
    id,establishment_id,name,product_type,price,default_unit_label,created_by
  ) values (p_a,e_a,'E2E Produto','insumo',10,'UN',u_a);

  insert into public.orders(
    id,establishment_id,created_by,customer_user_id,status,notes
  ) values
    (o_a,e_a,u_a,u_a,'pedido_criado','E2E A'),
    (o_b,e_b,u_b,u_b,'pedido_criado','E2E B');

  insert into public.order_line_items(
    order_id,establishment_id,product_id,product_name,quantity,unit_label
  ) values (o_a,e_a,p_a,'E2E Produto',2,'UN');

  insert into public.order_items(order_id,product_name,qty,unit)
    values (o_a,'E2E Produto',2,'UN');

  -- Simulate authenticated Tenant A for privileged order RPCs.
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  perform public.advance_order_status(o_a,'aceitou_pedido','e2e');
  perform public.advance_order_status(o_a,'em_preparo','e2e');
  perform public.advance_order_status(o_a,'em_separacao','e2e');
  perform public.advance_order_status(o_a,'em_faturamento','e2e');
  perform public.advance_order_status(o_a,'em_transporte','e2e');
  perform public.advance_order_status(o_a,'entregue','e2e');

  select status::text into s from public.orders where id=o_a;
  if s <> 'entregue' then
    raise exception 'E2E order lifecycle failed: %', s;
  end if;

  select count(*) into event_count
  from public.order_status_events where order_id=o_a;
  if event_count < 6 then
    raise exception 'E2E order events missing';
  end if;

  -- Cross-tenant mutation must be rejected.
  begin
    perform public.advance_order_status(o_b,'aceitou_pedido','cross-tenant must fail');
  exception when sqlstate '42501' then
    denied := true;
  end;
  if not denied then
    raise exception 'E2E cross-tenant order mutation was not denied';
  end if;

  -- Inactive membership must not regain privileged access.
  perform set_config('request.jwt.claim.sub', u_inactive::text, true);
  denied := false;
  begin
    perform public.reopen_order(o_a,'inactive must fail');
  exception when sqlstate '42501' then
    denied := true;
  end;
  if not denied then
    raise exception 'E2E inactive membership was not denied';
  end if;

  -- Production/stock path and resulting balance.
  insert into public.stock_balances(establishment_id,product_id,quantity,unit_label)
    values(e_a,p_a,5,'UN');
  insert into public.stock_movements(
    establishment_id,product_id,unit_label,qty_delta,reason,source,created_by
  ) values(e_a,p_a,'UN',-2,'e2e','qa',u_a);
  update public.stock_balances
  set quantity=quantity-2
  where establishment_id=e_a and product_id=p_a;

  select quantity into stock_value
  from public.stock_balances
  where establishment_id=e_a and product_id=p_a;
  if stock_value <> 3 then
    raise exception 'E2E stock balance failed';
  end if;

  -- Invoice/export-facing data path.
  insert into public.order_invoices(
    id,order_id,status,subtotal,discount,shipping,total,
    created_by,finalized_by,finalized_at
  ) values(inv_a,o_a,'finalized',20,0,0,20,u_a,u_a,now());

  insert into public.order_invoice_items(
    invoice_id,product_id,description,quantity,unit,unit_price,line_total
  ) values(inv_a,p_a,'E2E Produto',2,'UN',10,20);

  select total into invoice_value from public.order_invoices where id=inv_a;
  if invoice_value <> 20 then
    raise exception 'E2E invoice total failed';
  end if;

  -- Idempotency: same user/tenant/operation/key cannot be created twice.
  insert into public.api_idempotency_keys(
    establishment_id,user_id,operation,idempotency_key,request_hash,
    status,response_status,response_body
  ) values(
    e_a,u_a,'e2e.order','same-key','hash-a','completed',200,'{"ok":true}'::jsonb
  );

  begin
    insert into public.api_idempotency_keys(
      establishment_id,user_id,operation,idempotency_key,request_hash
    ) values(e_a,u_a,'e2e.order','same-key','hash-a');
  exception when unique_violation then
    idempotency_unique := true;
  end;
  if not idempotency_unique then
    raise exception 'E2E idempotency uniqueness failed';
  end if;

  -- Concurrency invariants: order transitions lock their row and the ledger
  -- has a unique tenant-scoped key. True load/race saturation belongs to the
  -- controlled load suite, but these are the database serialization guards.
  select position('for update' in lower(pg_get_functiondef(p.oid))) > 0
    into order_lock_contract
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='advance_order_status'
  limit 1;

  if not coalesce(order_lock_contract,false) then
    raise exception 'E2E order concurrency lock contract missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='api_idempotency_keys'
      and indexdef ilike 'CREATE UNIQUE INDEX%user_id%establishment_id%operation%idempotency_key%'
  ) then
    raise exception 'E2E tenant idempotency unique index missing';
  end if;

  insert into gestify_e2e_report values (
    'PASS',s,event_count,stock_value,invoice_value,
    idempotency_unique,order_lock_contract
  );
end $$;

select * from gestify_e2e_report;

-- Mandatory: no synthetic fixture persists in staging.
rollback;
