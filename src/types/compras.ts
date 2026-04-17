export type SupplierStatus = boolean;

export interface Supplier {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
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
  email?: string;
  endereco?: string;
  observacoes?: string;
  ativo?: SupplierStatus;
}

export interface UpdateSupplierInput {
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
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
  | "vencido";

export interface AccountPayable {
  id: string;
  origem: "compra";
  origemId: string;
  supplierId: string;
  supplierName: string;
  descricao: string;
  valor: number;
  vencimento: string;
  statusPagamento: PayableStatus;
  dataPagamento?: string;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAccountPayableStatusInput {
  statusPagamento: PayableStatus;
  dataPagamento?: string;
  observacoes?: string;
}

export interface AccountPayableFilters {
  status?: PayableStatus | "todos";
  supplierId?: string;
}
