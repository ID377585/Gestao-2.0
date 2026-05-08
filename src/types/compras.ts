export type SupplierStatus = boolean;

export interface Supplier {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  telefone2?: string;
  email?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  estado?: string;
  uf?: string;
  observacoes?: string;
  ativo: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  telefone2?: string;
  email?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  estado?: string;
  uf?: string;
  observacoes?: string;
  ativo?: SupplierStatus;
}

export interface UpdateSupplierInput {
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  telefone2?: string;
  email?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  estado?: string;
  uf?: string;
  observacoes?: string;
  ativo?: SupplierStatus;
}

export type PurchaseRequestStatus =
  | "pendente"
  | "em_cotacao"
  | "aprovada"
  | "rejeitada"
  | "convertida";

export type PriorityLevel =
  | "baixa"
  | "media"
  | "alta";

export interface PurchaseRequest {
  id: string;
  numero: string;
  setorSolicitante: string;
  solicitanteId: string;
  solicitanteNome: string;
  dataSolicitacao: string;
  prioridade: PriorityLevel;
  status: PurchaseRequestStatus;
  observacoes?: string;
  totalItens: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRequestItem {
  id: string;
  requestId: string;
  productId?: string;
  produtoNome: string;
  unidade: string;
  quantidade: number;
  observacao?: string;
}

export interface CreatePurchaseRequestItemInput {
  productId?: string;
  produtoNome: string;
  unidade: string;
  quantidade: number;
  observacao?: string;
}

export interface CreatePurchaseRequestInput {
  setorSolicitante: string;
  solicitanteId: string;
  solicitanteNome: string;
  prioridade: PriorityLevel;
  observacoes?: string;
  items: CreatePurchaseRequestItemInput[];
}

export interface UpdatePurchaseRequestStatusInput {
  status: PurchaseRequestStatus;
}

export type PurchaseOrderStatus =
  | "aberto"
  | "enviado"
  | "parcial"
  | "recebido"
  | "cancelado";

export interface PurchaseOrder {
  id: string;
  numero: string;
  supplierId: string;
  supplierName: string;
  requestId?: string;
  requestNumber?: string;
  dataEmissao: string;
  previsaoEntrega?: string;
  vencimento?: string;
  status: PurchaseOrderStatus;
  valorTotal: number;
  observacoes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId?: string;
  produtoNome: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  desconto?: number;
  valorTotal: number;
  observacao?: string;
}

export interface CreatePurchaseOrderItemInput {
  productId?: string;
  produtoNome: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  desconto?: number;
  observacao?: string;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  supplierName: string;
  requestId?: string;
  requestNumber?: string;
  previsaoEntrega?: string;
  vencimento?: string;
  observacoes?: string;
  createdBy: string;
  createdByName: string;
  items: CreatePurchaseOrderItemInput[];
}

export interface CreateOrderFromRequestInput {
  requestId: string;
  supplierId: string;
  supplierName: string;
  previsaoEntrega?: string;
  vencimento?: string;
  observacoes?: string;
  createdBy: string;
  createdByName: string;
  itemPrices: Array<{
    productId?: string;
    produtoNome: string;
    unidade: string;
    valorUnitario: number;
    desconto?: number;
    observacao?: string;
  }>;
}

export type GoodsReceiptStatus =
  | "pendente"
  | "conferido"
  | "divergencia"
  | "finalizado";

export interface GoodsReceipt {
  id: string;
  numero: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierName: string;
  dataRecebimento: string;
  responsavelId: string;
  responsavelNome: string;
  status: GoodsReceiptStatus;
  observacoes?: string;
  totalItens: number;
  valorTotalRecebido: number;
  inventoryApplied: boolean;
  inventoryPendingLink: boolean;
  payableCreated: boolean;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptItem {
  id: string;
  receiptId: string;
  productId?: string;
  produtoNome: string;
  unidade: string;
  quantidadePedido: number;
  quantidadeRecebida: number;
  valorUnitarioPedido: number;
  valorUnitarioReal: number;
  lote?: string;
  validade?: string;
  divergencia: boolean;
  motivoDivergencia?: string;
  observacao?: string;
}

export interface CreateGoodsReceiptFromOrderInput {
  purchaseOrderId: string;
  responsavelId: string;
  responsavelNome: string;
  observacoes?: string;
}

export interface FinalizeGoodsReceiptItemInput {
  id: string;
  quantidadeRecebida: number;
  valorUnitarioReal: number;
  lote?: string;
  validade?: string;
  motivoDivergencia?: string;
}

export interface FinalizeGoodsReceiptInput {
  receiptId: string;
  observacoes?: string;
  vencimento?: string;
  items: FinalizeGoodsReceiptItemInput[];
}

export interface InventoryProduct {
  id: string;
  nome: string;
  unidade?: string;
  stockAtual: number;
  custoMedio: number;
  ultimoCustoCompra?: number;
  dataUltimaCompra?: string;
  updatedAt?: string;
}

export interface FinalizeGoodsReceiptResult {
  receiptStatus: "divergencia" | "finalizado";
  orderStatus: PurchaseOrderStatus;
  valorTotalRecebido: number;
  inventoryPendingLink: boolean;
  alreadyApplied?: boolean;
}

export type PayableStatus =
  | "pendente"
  | "pago"
  | "vencido"
  | "cancelado";

export interface AccountPayable {
  id: string;
  origem: "compra" | "recebimento" | "manual";
  origemId: string;
  supplierId: string;
  supplierName: string;
  descricao: string;
  valor: number;
  vencimento: string;
  statusPagamento: PayableStatus;
  dataPagamento?: string;
  formaPagamento?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  numeroDocumento?: string;
  categoriaId?: string;
  categoria?: string;
  centroCustoId?: string;
  centroCusto?: string;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAccountPayableStatusInput {
  statusPagamento: PayableStatus;
  dataPagamento?: string;
  formaPagamento?: string;
  observacoes?: string;
}

export interface AccountPayableFilters {
  status?: PayableStatus | "todos";
  supplierId?: string;
  origem?: "compra" | "recebimento" | "manual" | "todos";
}

export type ReceivableStatus =
  | "pendente"
  | "recebido"
  | "vencido"
  | "cancelado";

export interface AccountReceivable {
  id: string;
  origem: "pedido" | "manual";
  origemId: string;
  customerId: string;
  customerName: string;
  descricao: string;
  valor: number;
  vencimento: string;
  statusRecebimento: ReceivableStatus;
  dataRecebimento?: string;
  formaRecebimento?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  observacoes?: string;
  categoriaId?: string;
  categoria?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAccountReceivableStatusInput {
  statusRecebimento: ReceivableStatus;
  dataRecebimento?: string;
  formaRecebimento?: string;
  observacoes?: string;
}

export interface AccountReceivableFilters {
  status?: ReceivableStatus | "todos";
  customerId?: string;
}

export type FinancialAccountType = "receita" | "despesa" | "custo";

export interface FinancialCategory {
  id: string;
  codigo: string;
  grupo: string;
  categoria: string;
  subcategoria?: string;
  tipo: FinancialAccountType;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinancialCategoryInput {
  codigo: string;
  grupo: string;
  categoria: string;
  subcategoria?: string;
  tipo: FinancialAccountType;
  ativo?: boolean;
}

export interface CostCenter {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCostCenterInput {
  codigo: string;
  nome: string;
  descricao?: string;
  ativo?: boolean;
}

export type BankAccountType = "corrente" | "poupanca" | "caixa";

export interface BankAccount {
  id: string;
  banco: string;
  nomeConta: string;
  agencia?: string;
  numeroConta?: string;
  tipo: BankAccountType;
  saldoInicial: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountInput {
  banco: string;
  nomeConta: string;
  agencia?: string;
  numeroConta?: string;
  tipo: BankAccountType;
  saldoInicial?: number;
  ativo?: boolean;
}

export interface BankReconciliationEntry {
  id: string;
  bankAccountId: string;
  bankAccountName: string;
  data: string;
  descricao: string;
  tipo: "entrada" | "saida";
  valor: number;
  origem: "manual" | "financeiro";
  origemId?: string;
  conciliado: boolean;
  matchedFinanceType?: "pagar" | "receber";
  matchedFinanceId?: string;
  matchedFinanceLabel?: string;
  matchedAt?: string;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
}

export type FinancialHistoryAction =
  | "criado"
  | "editado"
  | "pago"
  | "recebido"
  | "cancelado"
  | "pendente"
  | "conciliado_banco"
  | "desconciliado_banco";

export interface FinancialHistoryEntry {
  id: string;
  financeType: "pagar" | "receber";
  financeId: string;
  action: FinancialHistoryAction;
  title: string;
  description?: string;
  bankAccountName?: string;
  reconciliationEntryId?: string;
  createdAt: string;
  createdBy?: string;
}

export type PurchaseHistoryEntityType =
  | "solicitacao"
  | "pedido"
  | "recebimento";

export type PurchaseHistoryAction =
  | "solicitacao_criada"
  | "solicitacao_status_alterado"
  | "pedido_criado"
  | "solicitacao_convertida"
  | "recebimento_iniciado"
  | "recebimento_finalizado";

export interface PurchaseHistoryEntry {
  id: string;
  entityType: PurchaseHistoryEntityType;
  entityId: string;
  action: PurchaseHistoryAction;
  title: string;
  description?: string;
  relatedEntityType?: PurchaseHistoryEntityType;
  relatedEntityId?: string;
  createdAt: string;
  createdBy?: string;
}

export interface PurchaseAlertActionItem {
  id: string;
  alertId: string;
  alertType:
    | "fornecedor_critico"
    | "fornecedor_divergencia"
    | "fornecedor_sem_compra"
    | "pedido_atrasado";
  title: string;
  description: string;
  severity: "alta" | "media" | "baixa";
  supplierId?: string;
  supplierName?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  status: "pendente" | "tratado";
  observacaoTratativa?: string;
  treatedAt?: string;
  treatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierActionPlanItem {
  id: string;
  supplierId: string;
  supplierName: string;
  title: string;
  description?: string;
  category: "comercial" | "operacional" | "financeiro" | "qualidade";
  status: "pendente" | "em_andamento" | "concluido" | "cancelado";
  priority: "alta" | "media" | "baixa";
  dueDate?: string;
  assignedTo?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierContactHistoryItem {
  id: string;
  supplierId: string;
  supplierName: string;
  contactType: "ligacao" | "whatsapp" | "email" | "reuniao" | "visita";
  subject: string;
  notes?: string;
  contactDate: string;
  nextFollowUpDate?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierScoreReviewItem {
  id: string;
  supplierId: string;
  supplierName: string;
  scheduledDate: string;
  notes?: string;
  status: "agendada" | "realizada" | "cancelada";
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
export interface BuyerMonthlyGoal {
  id: string;
  buyer: string;
  referenceMonth: string; // YYYY-MM
  targetContacts: number;
  targetActionsCompleted: number;
  targetReviewsDone: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}