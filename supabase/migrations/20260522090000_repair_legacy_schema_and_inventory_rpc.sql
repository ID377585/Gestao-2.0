begin;

create schema if not exists private;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function private.gestify_legacy_table_names()
returns text[]
language sql
stable
as $$
  select array[
    'suppliers',
    'purchase_requests',
    'purchase_request_items',
    'purchase_orders',
    'purchase_order_items',
    'goods_receipts',
    'goods_receipt_items',
    'supplier_action_plans',
    'supplier_contact_history',
    'supplier_score_reviews',
    'purchase_action_queue',
    'buyer_monthly_goals',
    'purchase_history',
    'financial_categories',
    'cost_centers',
    'bank_accounts',
    'accounts_payable',
    'accounts_receivable',
    'financial_history',
    'bank_reconciliation_entries'
  ];
$$;

create table if not exists public.suppliers (
  id text primary key,
  razao_social text not null,
  nome_fantasia text not null default '',
  cnpj text not null default '',
  contato text not null default '',
  telefone text not null default '',
  email text not null default '',
  endereco text not null default '',
  observacoes text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.purchase_requests (
  id text primary key,
  numero text not null,
  setor_solicitante text not null,
  solicitante_id text not null,
  solicitante_nome text not null,
  data_solicitacao text not null,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  status text not null default 'pendente' check (status in ('pendente', 'em_cotacao', 'aprovada', 'rejeitada', 'convertida')),
  observacoes text not null default '',
  total_itens integer not null default 0,
  updated_by text not null default '',
  updated_by_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.purchase_request_items (
  id text primary key,
  request_id text not null references public.purchase_requests(id) on delete cascade,
  product_id text not null default '',
  produto_nome text not null,
  unidade text not null,
  quantidade numeric(14, 3) not null default 0,
  observacao text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.purchase_orders (
  id text primary key,
  numero text not null,
  supplier_id text not null default '',
  supplier_name text not null,
  request_id text not null default '',
  request_number text not null default '',
  data_emissao text not null,
  previsao_entrega text not null default '',
  vencimento text not null default '',
  status text not null default 'aberto' check (status in ('aberto', 'enviado', 'parcial', 'recebido', 'cancelado')),
  valor_total numeric(14, 2) not null default 0,
  observacoes text not null default '',
  created_by text not null,
  created_by_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.purchase_order_items (
  id text primary key,
  purchase_order_id text not null references public.purchase_orders(id) on delete cascade,
  product_id text not null default '',
  produto_nome text not null,
  unidade text not null,
  quantidade numeric(14, 3) not null default 0,
  valor_unitario numeric(14, 4) not null default 0,
  desconto numeric(14, 2) not null default 0,
  valor_total numeric(14, 2) not null default 0,
  observacao text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.goods_receipts (
  id text primary key,
  numero text not null,
  purchase_order_id text not null references public.purchase_orders(id) on delete cascade,
  purchase_order_number text not null,
  supplier_id text not null default '',
  supplier_name text not null,
  data_recebimento text not null,
  responsavel_id text not null,
  responsavel_nome text not null,
  status text not null default 'pendente' check (status in ('pendente', 'conferido', 'divergencia', 'finalizado')),
  observacoes text not null default '',
  total_itens integer not null default 0,
  valor_total_recebido numeric(14, 2) not null default 0,
  inventory_applied boolean not null default false,
  inventory_pending_link boolean not null default false,
  payable_created boolean not null default false,
  finalized_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.goods_receipt_items (
  id text primary key,
  receipt_id text not null references public.goods_receipts(id) on delete cascade,
  product_id text not null default '',
  produto_nome text not null,
  unidade text not null,
  quantidade_pedido numeric(14, 3) not null default 0,
  quantidade_recebida numeric(14, 3) not null default 0,
  valor_unitario_pedido numeric(14, 4) not null default 0,
  valor_unitario_real numeric(14, 4) not null default 0,
  lote text not null default '',
  validade text not null default '',
  divergencia boolean not null default false,
  motivo_divergencia text not null default '',
  observacao text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.supplier_action_plans (
  id text primary key,
  supplier_id text not null,
  supplier_name text not null,
  title text not null,
  description text not null default '',
  category text not null default 'operacional' check (category in ('comercial', 'operacional', 'financeiro', 'qualidade')),
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  priority text not null default 'media' check (priority in ('alta', 'media', 'baixa')),
  due_date text not null default '',
  assigned_to text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.supplier_contact_history (
  id text primary key,
  supplier_id text not null,
  supplier_name text not null,
  contact_type text not null default 'email' check (contact_type in ('ligacao', 'whatsapp', 'email', 'reuniao', 'visita')),
  subject text not null,
  notes text not null default '',
  contact_date text not null,
  next_follow_up_date text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.supplier_score_reviews (
  id text primary key,
  supplier_id text not null,
  supplier_name text not null,
  scheduled_date text not null,
  notes text not null default '',
  status text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  created_by text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.purchase_action_queue (
  id text primary key,
  alert_id text not null unique,
  alert_type text not null check (alert_type in ('fornecedor_critico', 'fornecedor_divergencia', 'fornecedor_sem_compra', 'pedido_atrasado')),
  title text not null,
  description text not null,
  severity text not null check (severity in ('alta', 'media', 'baixa')),
  supplier_id text not null default '',
  supplier_name text not null default '',
  purchase_order_id text not null default '',
  purchase_order_number text not null default '',
  status text not null default 'pendente' check (status in ('pendente', 'tratado')),
  observacao_tratativa text not null default '',
  treated_at text not null default '',
  treated_by text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.buyer_monthly_goals (
  id text primary key,
  buyer text not null,
  reference_month text not null,
  target_contacts integer not null default 0,
  target_actions_completed integer not null default 0,
  target_reviews_done integer not null default 0,
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (buyer, reference_month)
);

create table if not exists public.purchase_history (
  id text primary key,
  entity_type text not null check (entity_type in ('solicitacao', 'pedido', 'recebimento')),
  entity_id text not null,
  action text not null check (action in ('solicitacao_criada', 'solicitacao_status_alterado', 'pedido_criado', 'solicitacao_convertida', 'recebimento_iniciado', 'recebimento_finalizado')),
  title text not null,
  description text not null default '',
  related_entity_type text not null default '',
  related_entity_id text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.financial_categories (
  id text primary key,
  codigo text not null,
  grupo text not null,
  categoria text not null,
  subcategoria text not null default '',
  tipo text not null check (tipo in ('receita', 'despesa', 'custo')),
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cost_centers (
  id text primary key,
  codigo text not null,
  nome text not null,
  descricao text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bank_accounts (
  id text primary key,
  banco text not null,
  nome_conta text not null,
  agencia text not null default '',
  numero_conta text not null default '',
  tipo text not null check (tipo in ('corrente', 'poupanca', 'caixa')),
  saldo_inicial numeric(14, 2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.accounts_payable (
  id text primary key,
  origem text not null default 'manual' check (origem in ('compra', 'recebimento', 'manual')),
  origem_id text not null default '',
  supplier_id text not null default '',
  supplier_name text not null default '',
  descricao text not null,
  valor numeric(14, 2) not null default 0,
  vencimento text not null,
  status_pagamento text not null default 'pendente' check (status_pagamento in ('pendente', 'pago', 'vencido', 'cancelado')),
  data_pagamento text not null default '',
  forma_pagamento text not null default '',
  bank_account_id text not null default '',
  bank_account_name text not null default '',
  numero_documento text not null default '',
  categoria_id text not null default '',
  categoria text not null default '',
  centro_custo_id text not null default '',
  centro_custo text not null default '',
  observacoes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.accounts_receivable (
  id text primary key,
  origem text not null default 'manual' check (origem in ('pedido', 'manual')),
  origem_id text not null default '',
  customer_id text not null default '',
  customer_name text not null default '',
  descricao text not null,
  valor numeric(14, 2) not null default 0,
  vencimento text not null,
  status_recebimento text not null default 'pendente' check (status_recebimento in ('pendente', 'recebido', 'vencido', 'cancelado')),
  data_recebimento text not null default '',
  forma_recebimento text not null default '',
  bank_account_id text not null default '',
  bank_account_name text not null default '',
  observacoes text not null default '',
  categoria_id text not null default '',
  categoria text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.financial_history (
  id text primary key,
  finance_type text not null check (finance_type in ('pagar', 'receber')),
  finance_id text not null,
  action text not null check (action in ('criado', 'editado', 'pago', 'recebido', 'cancelado', 'pendente', 'conciliado_banco', 'desconciliado_banco')),
  title text not null,
  description text not null default '',
  bank_account_name text not null default '',
  reconciliation_entry_id text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bank_reconciliation_entries (
  id text primary key,
  bank_account_id text not null default '',
  bank_account_name text not null default '',
  data text not null,
  descricao text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  valor numeric(14, 2) not null default 0,
  origem text not null default 'manual' check (origem in ('manual', 'financeiro')),
  origem_id text not null default '',
  conciliado boolean not null default false,
  matched_finance_type text not null default '',
  matched_finance_id text not null default '',
  matched_finance_label text not null default '',
  matched_at text not null default '',
  observacoes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists suppliers_razao_social_idx
  on public.suppliers (razao_social);
create index if not exists purchase_requests_created_at_idx
  on public.purchase_requests (created_at desc);
create index if not exists purchase_request_items_request_id_idx
  on public.purchase_request_items (request_id, produto_nome);
create index if not exists purchase_orders_created_at_idx
  on public.purchase_orders (created_at desc);
create index if not exists purchase_orders_request_id_idx
  on public.purchase_orders (request_id);
create index if not exists purchase_order_items_purchase_order_id_idx
  on public.purchase_order_items (purchase_order_id, produto_nome);
create index if not exists goods_receipts_purchase_order_id_idx
  on public.goods_receipts (purchase_order_id, created_at desc);
create index if not exists goods_receipt_items_receipt_id_idx
  on public.goods_receipt_items (receipt_id, produto_nome);
create index if not exists supplier_action_plans_supplier_id_idx
  on public.supplier_action_plans (supplier_id, created_at desc);
create index if not exists supplier_contact_history_supplier_id_idx
  on public.supplier_contact_history (supplier_id, contact_date desc);
create index if not exists supplier_score_reviews_supplier_id_idx
  on public.supplier_score_reviews (supplier_id, scheduled_date);
create index if not exists purchase_action_queue_updated_at_idx
  on public.purchase_action_queue (updated_at desc);
create index if not exists buyer_monthly_goals_reference_month_idx
  on public.buyer_monthly_goals (reference_month desc, buyer asc);
create index if not exists purchase_history_entity_idx
  on public.purchase_history (entity_type, entity_id, created_at desc);
create index if not exists financial_categories_grupo_categoria_idx
  on public.financial_categories (grupo asc, categoria asc);
create index if not exists cost_centers_nome_idx
  on public.cost_centers (nome asc);
create index if not exists bank_accounts_banco_nome_conta_idx
  on public.bank_accounts (banco asc, nome_conta asc);
create index if not exists accounts_payable_created_at_idx
  on public.accounts_payable (created_at desc);
create index if not exists accounts_receivable_created_at_idx
  on public.accounts_receivable (created_at desc);
create index if not exists financial_history_finance_idx
  on public.financial_history (finance_type, finance_id, created_at desc);
create index if not exists bank_reconciliation_entries_bank_account_id_idx
  on public.bank_reconciliation_entries (bank_account_id, data desc);

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at before update on public.suppliers
for each row execute function public.update_updated_at_column();

drop trigger if exists purchase_requests_set_updated_at on public.purchase_requests;
create trigger purchase_requests_set_updated_at before update on public.purchase_requests
for each row execute function public.update_updated_at_column();

drop trigger if exists purchase_request_items_set_updated_at on public.purchase_request_items;
create trigger purchase_request_items_set_updated_at before update on public.purchase_request_items
for each row execute function public.update_updated_at_column();

drop trigger if exists purchase_orders_set_updated_at on public.purchase_orders;
create trigger purchase_orders_set_updated_at before update on public.purchase_orders
for each row execute function public.update_updated_at_column();

drop trigger if exists purchase_order_items_set_updated_at on public.purchase_order_items;
create trigger purchase_order_items_set_updated_at before update on public.purchase_order_items
for each row execute function public.update_updated_at_column();

drop trigger if exists goods_receipts_set_updated_at on public.goods_receipts;
create trigger goods_receipts_set_updated_at before update on public.goods_receipts
for each row execute function public.update_updated_at_column();

drop trigger if exists goods_receipt_items_set_updated_at on public.goods_receipt_items;
create trigger goods_receipt_items_set_updated_at before update on public.goods_receipt_items
for each row execute function public.update_updated_at_column();

drop trigger if exists supplier_action_plans_set_updated_at on public.supplier_action_plans;
create trigger supplier_action_plans_set_updated_at before update on public.supplier_action_plans
for each row execute function public.update_updated_at_column();

drop trigger if exists supplier_contact_history_set_updated_at on public.supplier_contact_history;
create trigger supplier_contact_history_set_updated_at before update on public.supplier_contact_history
for each row execute function public.update_updated_at_column();

drop trigger if exists supplier_score_reviews_set_updated_at on public.supplier_score_reviews;
create trigger supplier_score_reviews_set_updated_at before update on public.supplier_score_reviews
for each row execute function public.update_updated_at_column();

drop trigger if exists purchase_action_queue_set_updated_at on public.purchase_action_queue;
create trigger purchase_action_queue_set_updated_at before update on public.purchase_action_queue
for each row execute function public.update_updated_at_column();

drop trigger if exists buyer_monthly_goals_set_updated_at on public.buyer_monthly_goals;
create trigger buyer_monthly_goals_set_updated_at before update on public.buyer_monthly_goals
for each row execute function public.update_updated_at_column();

drop trigger if exists financial_categories_set_updated_at on public.financial_categories;
create trigger financial_categories_set_updated_at before update on public.financial_categories
for each row execute function public.update_updated_at_column();

drop trigger if exists cost_centers_set_updated_at on public.cost_centers;
create trigger cost_centers_set_updated_at before update on public.cost_centers
for each row execute function public.update_updated_at_column();

drop trigger if exists bank_accounts_set_updated_at on public.bank_accounts;
create trigger bank_accounts_set_updated_at before update on public.bank_accounts
for each row execute function public.update_updated_at_column();

drop trigger if exists accounts_payable_set_updated_at on public.accounts_payable;
create trigger accounts_payable_set_updated_at before update on public.accounts_payable
for each row execute function public.update_updated_at_column();

drop trigger if exists accounts_receivable_set_updated_at on public.accounts_receivable;
create trigger accounts_receivable_set_updated_at before update on public.accounts_receivable
for each row execute function public.update_updated_at_column();

drop trigger if exists bank_reconciliation_entries_set_updated_at on public.bank_reconciliation_entries;
create trigger bank_reconciliation_entries_set_updated_at before update on public.bank_reconciliation_entries
for each row execute function public.update_updated_at_column();

do $$
declare
  table_name text;
begin
  foreach table_name in array private.gestify_legacy_table_names() loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'alter table public.%I add column if not exists establishment_id uuid references public.establishments(id) on delete cascade',
        table_name
      );

      execute format(
        'create index if not exists %I on public.%I (establishment_id, created_at desc)',
        table_name || '_establishment_created_idx',
        table_name
      );
    end if;
  end loop;
end $$;

alter table if exists public.buyer_monthly_goals
  drop constraint if exists buyer_monthly_goals_buyer_reference_month_key;

drop index if exists public.buyer_monthly_goals_buyer_reference_month_establishment_idx;
create unique index if not exists buyer_monthly_goals_establishment_buyer_reference_month_idx
  on public.buyer_monthly_goals (establishment_id, buyer, reference_month);

alter table if exists public.purchase_action_queue
  drop constraint if exists purchase_action_queue_alert_id_key;

drop index if exists public.purchase_action_queue_alert_id_establishment_idx;
create unique index if not exists purchase_action_queue_establishment_alert_id_idx
  on public.purchase_action_queue (establishment_id, alert_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array private.gestify_legacy_table_names() loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      execute format('drop policy if exists gestify_legacy_tenant_select on public.%I', table_name);
      execute format('drop policy if exists gestify_legacy_tenant_insert on public.%I', table_name);
      execute format('drop policy if exists gestify_legacy_tenant_update on public.%I', table_name);
      execute format('drop policy if exists gestify_legacy_tenant_delete on public.%I', table_name);

      execute format(
        'create policy gestify_legacy_tenant_select on public.%I for select to authenticated using (establishment_id is not null and private.gestify_is_establishment_member(establishment_id))',
        table_name
      );
      execute format(
        'create policy gestify_legacy_tenant_insert on public.%I for insert to authenticated with check (establishment_id is not null and private.gestify_is_establishment_member(establishment_id))',
        table_name
      );
      execute format(
        'create policy gestify_legacy_tenant_update on public.%I for update to authenticated using (establishment_id is not null and private.gestify_is_establishment_member(establishment_id)) with check (establishment_id is not null and private.gestify_is_establishment_member(establishment_id))',
        table_name
      );
      execute format(
        'create policy gestify_legacy_tenant_delete on public.%I for delete to authenticated using (establishment_id is not null and private.gestify_is_establishment_member(establishment_id))',
        table_name
      );

      execute format('grant select, insert, update, delete on table public.%I to authenticated, service_role', table_name);
    end if;
  end loop;
end $$;

create or replace function public.create_inventory_label(
  p_establishment_id uuid,
  p_product_id uuid,
  p_label_code text,
  p_qty numeric,
  p_unit_label text,
  p_notes text default null,
  p_label_type text default null
)
returns table (
  id uuid,
  label_code text,
  qty numeric,
  qty_balance numeric,
  unit_label text,
  notes text,
  created_at timestamptz,
  status text,
  product_id uuid
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_label public.inventory_labels%rowtype;
  v_unit_label text := upper(trim(coalesce(p_unit_label, '')));
  v_label_code text := trim(coalesce(p_label_code, ''));
  v_before_qty numeric := 0;
  v_after_qty numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if p_establishment_id is null then
    raise exception 'Estabelecimento nao informado.';
  end if;

  if not private.gestify_has_establishment_role(
    p_establishment_id,
    array['admin', 'operacao', 'estoque']
  ) then
    raise exception 'Sem permissao para criar etiquetas neste estabelecimento.';
  end if;

  if p_product_id is null then
    raise exception 'Produto nao informado.';
  end if;

  if v_label_code = '' then
    raise exception 'Codigo/Lote da etiqueta vazio.';
  end if;

  if v_unit_label = '' then
    raise exception 'Unidade nao informada.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantidade invalida.';
  end if;

  perform 1
  from public.products p
  where p.id = p_product_id
    and p.establishment_id = p_establishment_id;

  if not found then
    raise exception 'Produto nao encontrado neste estabelecimento.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(
      p_establishment_id::text || ':' || p_product_id::text || ':' || v_unit_label
    )
  );

  select coalesce(sb.quantity, 0)
    into v_before_qty
  from public.stock_balances sb
  where sb.establishment_id = p_establishment_id
    and sb.product_id = p_product_id
    and sb.unit_label = v_unit_label
  limit 1;

  v_before_qty := coalesce(v_before_qty, 0);

  insert into public.inventory_labels (
    establishment_id,
    product_id,
    label_code,
    qty,
    qty_balance,
    used_qty,
    unit_label,
    status,
    order_id,
    separated_at,
    separated_by,
    created_by,
    notes,
    last_action
  )
  values (
    p_establishment_id,
    p_product_id,
    v_label_code,
    p_qty,
    p_qty,
    0,
    v_unit_label,
    'available',
    null,
    null,
    null,
    v_user_id,
    p_notes,
    'LABEL_CREATED'
  )
  returning * into v_label;

  insert into public.inventory_movements (
    establishment_id,
    product_id,
    label_id,
    qty,
    qty_delta,
    unit_label,
    direction,
    movement_type,
    reason,
    created_by,
    details
  )
  values (
    p_establishment_id,
    p_product_id,
    v_label.id,
    p_qty,
    p_qty,
    v_unit_label,
    'IN',
    'LABEL_IN',
    'LABEL_CREATED',
    v_user_id,
    jsonb_build_object(
      'label_code', v_label_code,
      'label_type', nullif(trim(coalesce(p_label_type, '')), ''),
      'source', 'create_inventory_label'
    )
  );

  select coalesce(sb.quantity, 0)
    into v_after_qty
  from public.stock_balances sb
  where sb.establishment_id = p_establishment_id
    and sb.product_id = p_product_id
    and sb.unit_label = v_unit_label
  limit 1;

  v_after_qty := coalesce(v_after_qty, 0);

  if v_after_qty is distinct from (v_before_qty + p_qty) then
    perform 1
    from public.fn_upsert_stock_balance(
      p_establishment_id,
      p_product_id,
      p_qty,
      v_unit_label
    );
  end if;

  return query
  select
    v_label.id,
    v_label.label_code,
    v_label.qty,
    v_label.qty_balance,
    v_label.unit_label,
    v_label.notes,
    v_label.created_at,
    v_label.status,
    v_label.product_id;
end;
$$;

revoke all on function public.create_inventory_label(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  text
) from public, anon;

grant execute on function public.create_inventory_label(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  text
) to authenticated;

commit;
