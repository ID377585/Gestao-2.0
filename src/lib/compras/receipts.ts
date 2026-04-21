import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
  toBoolean,
  toIsoString,
  toNumber,
  toText,
} from "@/lib/legacy/supabase";
import { applyPurchaseReceiptToInventory } from "@/lib/estoque/inventory";
import {
  getPurchaseOrderById,
  listPurchaseOrderItems,
} from "@/lib/compras/orders";
import type {
  CreateGoodsReceiptFromOrderInput,
  FinalizeGoodsReceiptInput,
  GoodsReceipt,
  GoodsReceiptItem,
  PurchaseOrderStatus,
} from "@/types/compras";

const RECEIPTS_TABLE = "goods_receipts";
const RECEIPT_ITEMS_TABLE = "goods_receipt_items";

function generateReceiptNumber() {
  return `RC-${Date.now()}`;
}

function normalizeReceipt(row: Record<string, unknown>): GoodsReceipt {
  return {
    id: toText(row.id),
    numero: toText(row.numero),
    purchaseOrderId: toText(row.purchase_order_id),
    purchaseOrderNumber: toText(row.purchase_order_number),
    supplierId: toText(row.supplier_id),
    supplierName: toText(row.supplier_name),
    dataRecebimento: toText(row.data_recebimento),
    responsavelId: toText(row.responsavel_id),
    responsavelNome: toText(row.responsavel_nome),
    status: (toText(row.status, "pendente") ?? "pendente") as GoodsReceipt["status"],
    observacoes: toText(row.observacoes),
    totalItens: toNumber(row.total_itens),
    valorTotalRecebido: toNumber(row.valor_total_recebido),
    inventoryApplied: toBoolean(row.inventory_applied, false),
    inventoryPendingLink: toBoolean(row.inventory_pending_link, false),
    payableCreated: toBoolean(row.payable_created, false),
    finalizedAt: toIsoString(row.finalized_at as string | null | undefined),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

function normalizeReceiptItem(row: Record<string, unknown>): GoodsReceiptItem {
  return {
    id: toText(row.id),
    receiptId: toText(row.receipt_id),
    productId: toText(row.product_id),
    produtoNome: toText(row.produto_nome),
    unidade: toText(row.unidade),
    quantidadePedido: toNumber(row.quantidade_pedido),
    quantidadeRecebida: toNumber(row.quantidade_recebida),
    valorUnitarioPedido: toNumber(row.valor_unitario_pedido),
    valorUnitarioReal: toNumber(row.valor_unitario_real),
    lote: toText(row.lote),
    validade: toText(row.validade),
    divergencia: toBoolean(row.divergencia, false),
    motivoDivergencia: toText(row.motivo_divergencia),
    observacao: toText(row.observacao),
  };
}

async function findReceiptByOrderId(
  purchaseOrderId: string
): Promise<GoodsReceipt | null> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(RECEIPTS_TABLE)
    .select("*")
    .eq("purchase_order_id", purchaseOrderId)
    .limit(1)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar o recebimento do pedido");
  return data ? normalizeReceipt(data as Record<string, unknown>) : null;
}

function getOrderStatusFromReceiptItems(
  items: GoodsReceiptItem[]
): PurchaseOrderStatus {
  if (!items.length) return "aberto";

  const allFullyReceived = items.every(
    (item) => Number(item.quantidadeRecebida) >= Number(item.quantidadePedido)
  );

  if (allFullyReceived) return "recebido";

  const anyReceived = items.some((item) => Number(item.quantidadeRecebida) > 0);
  if (anyReceived) return "parcial";

  return "aberto";
}

function calculateReceiptTotal(items: GoodsReceiptItem[]) {
  return items.reduce((acc, item) => {
    return acc + Number(item.quantidadeRecebida) * Number(item.valorUnitarioReal);
  }, 0);
}

export async function createReceiptFromOrder(
  input: CreateGoodsReceiptFromOrderInput
): Promise<string> {
  const existingReceipt = await findReceiptByOrderId(input.purchaseOrderId);

  if (existingReceipt) {
    return existingReceipt.id;
  }

  const order = await getPurchaseOrderById(input.purchaseOrderId);

  if (!order) {
    throw new Error("Pedido de compra nao encontrado.");
  }

  const orderItems = await listPurchaseOrderItems(order.id);

  if (!orderItems.length) {
    throw new Error("O pedido nao possui itens.");
  }

  const supabase = getLegacySupabase();
  const receiptId = createLegacyId();

  const { error: receiptError } = await supabase.from(RECEIPTS_TABLE).insert({
    id: receiptId,
    numero: generateReceiptNumber(),
    purchase_order_id: order.id,
    purchase_order_number: order.numero,
    supplier_id: order.supplierId,
    supplier_name: order.supplierName,
    data_recebimento: new Date().toISOString(),
    responsavel_id: input.responsavelId.trim(),
    responsavel_nome: input.responsavelNome.trim(),
    status: "pendente",
    observacoes: input.observacoes?.trim() ?? "",
    total_itens: orderItems.length,
    valor_total_recebido: 0,
    inventory_applied: false,
    inventory_pending_link: false,
    payable_created: false,
    finalized_at: null,
  });

  assertSupabaseSuccess(receiptError, "Nao foi possivel iniciar o recebimento");

  const itemsPayload = orderItems.map((item) => ({
    id: createLegacyId(),
    receipt_id: receiptId,
    product_id: item.productId?.trim() ?? "",
    produto_nome: item.produtoNome.trim(),
    unidade: item.unidade.trim(),
    quantidade_pedido: Number(item.quantidade),
    quantidade_recebida: 0,
    valor_unitario_pedido: Number(item.valorUnitario),
    valor_unitario_real: Number(item.valorUnitario),
    lote: "",
    validade: "",
    divergencia: false,
    motivo_divergencia: "",
    observacao: item.observacao?.trim() ?? "",
  }));

  const { error: itemsError } = await supabase
    .from(RECEIPT_ITEMS_TABLE)
    .insert(itemsPayload);

  assertSupabaseSuccess(itemsError, "Nao foi possivel salvar os itens do recebimento");
  return receiptId;
}

export async function listGoodsReceipts(): Promise<GoodsReceipt[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(RECEIPTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar os recebimentos");
  return (data ?? []).map((row) =>
    normalizeReceipt(row as Record<string, unknown>)
  );
}

export async function getGoodsReceiptById(
  id: string
): Promise<GoodsReceipt | null> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(RECEIPTS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar o recebimento");
  return data ? normalizeReceipt(data as Record<string, unknown>) : null;
}

export async function listGoodsReceiptItems(
  receiptId: string
): Promise<GoodsReceiptItem[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(RECEIPT_ITEMS_TABLE)
    .select("*")
    .eq("receipt_id", receiptId)
    .order("produto_nome", { ascending: true });

  assertSupabaseSuccess(error, "Nao foi possivel listar os itens do recebimento");
  return (data ?? []).map((row) =>
    normalizeReceiptItem(row as Record<string, unknown>)
  );
}

export async function finalizeGoodsReceipt(
  input: FinalizeGoodsReceiptInput
): Promise<{
  receiptStatus: "divergencia" | "finalizado";
  orderStatus: PurchaseOrderStatus;
  valorTotalRecebido: number;
  inventoryPendingLink: boolean;
  alreadyApplied?: boolean;
}> {
  const receipt = await getGoodsReceiptById(input.receiptId);

  if (!receipt) {
    throw new Error("Recebimento nao encontrado.");
  }

  const order = await getPurchaseOrderById(receipt.purchaseOrderId);

  if (!order) {
    throw new Error("Pedido vinculado ao recebimento nao encontrado.");
  }

  const currentItems = await listGoodsReceiptItems(receipt.id);

  if (!currentItems.length) {
    throw new Error("O recebimento nao possui itens.");
  }

  const inputMap = new Map(input.items.map((item) => [item.id, item]));

  const mergedItems: GoodsReceiptItem[] = currentItems.map((current) => {
    const incoming = inputMap.get(current.id);

    const quantidadeRecebida = Number(
      incoming?.quantidadeRecebida ?? current.quantidadeRecebida ?? 0
    );

    const valorUnitarioReal = Number(
      incoming?.valorUnitarioReal ?? current.valorUnitarioReal ?? 0
    );

    if (quantidadeRecebida < 0) {
      throw new Error("Quantidade recebida nao pode ser negativa.");
    }

    if (valorUnitarioReal < 0) {
      throw new Error("Valor unitario real nao pode ser negativo.");
    }

    const motivoDivergencia = incoming?.motivoDivergencia?.trim() ?? "";
    const lote = incoming?.lote?.trim() ?? "";
    const validade = incoming?.validade ?? "";

    const divergencia =
      quantidadeRecebida !== Number(current.quantidadePedido) ||
      valorUnitarioReal !== Number(current.valorUnitarioPedido) ||
      Boolean(motivoDivergencia);

    return {
      ...current,
      quantidadeRecebida,
      valorUnitarioReal,
      lote,
      validade,
      motivoDivergencia,
      divergencia,
    };
  });

  const hasDivergence = mergedItems.some((item) => item.divergencia);
  const receiptStatus = hasDivergence ? "divergencia" : "finalizado";
  const orderStatus = getOrderStatusFromReceiptItems(mergedItems);
  const valorTotalRecebido = calculateReceiptTotal(mergedItems);

  return applyPurchaseReceiptToInventory({
    receipt,
    order,
    items: mergedItems,
    receiptStatus,
    orderStatus,
    valorTotalRecebido,
    observacoes: input.observacoes,
    vencimento: input.vencimento,
  });
}

export async function listGoodsReceiptsByOrderId(
  purchaseOrderId: string
): Promise<GoodsReceipt[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(RECEIPTS_TABLE)
    .select("*")
    .eq("purchase_order_id", purchaseOrderId)
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar os recebimentos do pedido");
  return (data ?? []).map((row) =>
    normalizeReceipt(row as Record<string, unknown>)
  );
}
