create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
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
create trigger suppliers_set_updated_at
before update on public.suppliers
for each row
execute function public.update_updated_at_column();

drop trigger if exists purchase_requests_set_updated_at on public.purchase_requests;
create trigger purchase_requests_set_updated_at
before update on public.purchase_requests
for each row
execute function public.update_updated_at_column();

drop trigger if exists purchase_request_items_set_updated_at on public.purchase_request_items;
create trigger purchase_request_items_set_updated_at
before update on public.purchase_request_items
for each row
execute function public.update_updated_at_column();

drop trigger if exists purchase_orders_set_updated_at on public.purchase_orders;
create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row
execute function public.update_updated_at_column();

drop trigger if exists purchase_order_items_set_updated_at on public.purchase_order_items;
create trigger purchase_order_items_set_updated_at
before update on public.purchase_order_items
for each row
execute function public.update_updated_at_column();

drop trigger if exists goods_receipts_set_updated_at on public.goods_receipts;
create trigger goods_receipts_set_updated_at
before update on public.goods_receipts
for each row
execute function public.update_updated_at_column();

drop trigger if exists goods_receipt_items_set_updated_at on public.goods_receipt_items;
create trigger goods_receipt_items_set_updated_at
before update on public.goods_receipt_items
for each row
execute function public.update_updated_at_column();

drop trigger if exists supplier_action_plans_set_updated_at on public.supplier_action_plans;
create trigger supplier_action_plans_set_updated_at
before update on public.supplier_action_plans
for each row
execute function public.update_updated_at_column();

drop trigger if exists supplier_contact_history_set_updated_at on public.supplier_contact_history;
create trigger supplier_contact_history_set_updated_at
before update on public.supplier_contact_history
for each row
execute function public.update_updated_at_column();

drop trigger if exists supplier_score_reviews_set_updated_at on public.supplier_score_reviews;
create trigger supplier_score_reviews_set_updated_at
before update on public.supplier_score_reviews
for each row
execute function public.update_updated_at_column();

drop trigger if exists purchase_action_queue_set_updated_at on public.purchase_action_queue;
create trigger purchase_action_queue_set_updated_at
before update on public.purchase_action_queue
for each row
execute function public.update_updated_at_column();

drop trigger if exists buyer_monthly_goals_set_updated_at on public.buyer_monthly_goals;
create trigger buyer_monthly_goals_set_updated_at
before update on public.buyer_monthly_goals
for each row
execute function public.update_updated_at_column();

drop trigger if exists financial_categories_set_updated_at on public.financial_categories;
create trigger financial_categories_set_updated_at
before update on public.financial_categories
for each row
execute function public.update_updated_at_column();

drop trigger if exists cost_centers_set_updated_at on public.cost_centers;
create trigger cost_centers_set_updated_at
before update on public.cost_centers
for each row
execute function public.update_updated_at_column();

drop trigger if exists bank_accounts_set_updated_at on public.bank_accounts;
create trigger bank_accounts_set_updated_at
before update on public.bank_accounts
for each row
execute function public.update_updated_at_column();

drop trigger if exists accounts_payable_set_updated_at on public.accounts_payable;
create trigger accounts_payable_set_updated_at
before update on public.accounts_payable
for each row
execute function public.update_updated_at_column();

drop trigger if exists accounts_receivable_set_updated_at on public.accounts_receivable;
create trigger accounts_receivable_set_updated_at
before update on public.accounts_receivable
for each row
execute function public.update_updated_at_column();

drop trigger if exists bank_reconciliation_entries_set_updated_at on public.bank_reconciliation_entries;
create trigger bank_reconciliation_entries_set_updated_at
before update on public.bank_reconciliation_entries
for each row
execute function public.update_updated_at_column();

alter table public.suppliers disable row level security;
alter table public.purchase_requests disable row level security;
alter table public.purchase_request_items disable row level security;
alter table public.purchase_orders disable row level security;
alter table public.purchase_order_items disable row level security;
alter table public.goods_receipts disable row level security;
alter table public.goods_receipt_items disable row level security;
alter table public.supplier_action_plans disable row level security;
alter table public.supplier_contact_history disable row level security;
alter table public.supplier_score_reviews disable row level security;
alter table public.purchase_action_queue disable row level security;
alter table public.buyer_monthly_goals disable row level security;
alter table public.purchase_history disable row level security;
alter table public.financial_categories disable row level security;
alter table public.cost_centers disable row level security;
alter table public.bank_accounts disable row level security;
alter table public.accounts_payable disable row level security;
alter table public.accounts_receivable disable row level security;
alter table public.financial_history disable row level security;
alter table public.bank_reconciliation_entries disable row level security;

grant select, insert, update, delete on table
  public.suppliers,
  public.purchase_requests,
  public.purchase_request_items,
  public.purchase_orders,
  public.purchase_order_items,
  public.goods_receipts,
  public.goods_receipt_items,
  public.supplier_action_plans,
  public.supplier_contact_history,
  public.supplier_score_reviews,
  public.purchase_action_queue,
  public.buyer_monthly_goals,
  public.purchase_history,
  public.financial_categories,
  public.cost_centers,
  public.bank_accounts,
  public.accounts_payable,
  public.accounts_receivable,
  public.financial_history,
  public.bank_reconciliation_entries
to authenticated, service_role;
