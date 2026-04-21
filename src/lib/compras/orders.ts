import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
  toIsoString,
  toNumber,
  toText,
} from "@/lib/legacy/supabase";
import {
  getPurchaseRequestById,
  listPurchaseRequestItems,
} from "@/lib/compras/requests";
import type {
  CreateOrderFromRequestInput,
  CreatePurchaseOrderInput,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
} from "@/types/compras";

const ORDERS_TABLE = "purchase_orders";
const ORDER_ITEMS_TABLE = "purchase_order_items";

function normalizeOrder(row: Record<string, unknown>): PurchaseOrder {
  return {
    id: toText(row.id),
    numero: toText(row.numero),
    supplierId: toText(row.supplier_id),
    supplierName: toText(row.supplier_name),
    requestId: toText(row.request_id),
    requestNumber: toText(row.request_number),
    dataEmissao: toText(row.data_emissao),
    previsaoEntrega: toText(row.previsao_entrega),
    vencimento: toText(row.vencimento),
    status: (toText(row.status, "aberto") ?? "aberto") as PurchaseOrderStatus,
    valorTotal: toNumber(row.valor_total),
    observacoes: toText(row.observacoes),
    createdBy: toText(row.created_by),
    createdByName: toText(row.created_by_name),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

function normalizeOrderItem(
  row: Record<string, unknown>
): PurchaseOrderItem {
  return {
    id: toText(row.id),
    purchaseOrderId: toText(row.purchase_order_id),
    productId: toText(row.product_id),
    produtoNome: toText(row.produto_nome),
    unidade: toText(row.unidade),
    quantidade: toNumber(row.quantidade),
    valorUnitario: toNumber(row.valor_unitario),
    desconto: toNumber(row.desconto),
    valorTotal: toNumber(row.valor_total),
    observacao: toText(row.observacao),
  };
}

function generateOrderNumber() {
  return `PC-${Date.now()}`;
}

function calculateItemTotal(
  quantidade: number,
  valorUnitario: number,
  desconto = 0
) {
  return Number(quantidade) * Number(valorUnitario) - Number(desconto || 0);
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput
): Promise<string> {
  if (!input.items.length) {
    throw new Error("O pedido precisa ter ao menos um item.");
  }

  const supabase = getLegacySupabase();
  const orderId = createLegacyId();
  const numero = generateOrderNumber();

  const items = input.items.map((item) => ({
    ...item,
    valorTotal: calculateItemTotal(
      Number(item.quantidade),
      Number(item.valorUnitario),
      Number(item.desconto ?? 0)
    ),
  }));

  const valorTotal = items.reduce((acc, item) => acc + item.valorTotal, 0);

  const { error: orderError } = await supabase.from(ORDERS_TABLE).insert({
    id: orderId,
    numero,
    supplier_id: input.supplierId.trim(),
    supplier_name: input.supplierName.trim(),
    request_id: input.requestId?.trim() ?? "",
    request_number: input.requestNumber?.trim() ?? "",
    data_emissao: new Date().toISOString(),
    previsao_entrega: input.previsaoEntrega ?? "",
    vencimento: input.vencimento ?? "",
    status: "aberto",
    valor_total: valorTotal,
    observacoes: input.observacoes?.trim() ?? "",
    created_by: input.createdBy.trim(),
    created_by_name: input.createdByName.trim(),
  });

  assertSupabaseSuccess(orderError, "Nao foi possivel criar o pedido de compra");

  const itemsPayload = items.map((item) => ({
    id: createLegacyId(),
    purchase_order_id: orderId,
    product_id: item.productId?.trim() ?? "",
    produto_nome: item.produtoNome.trim(),
    unidade: item.unidade.trim(),
    quantidade: Number(item.quantidade),
    valor_unitario: Number(item.valorUnitario),
    desconto: Number(item.desconto ?? 0),
    valor_total: Number(item.valorTotal),
    observacao: item.observacao?.trim() ?? "",
  }));

  const { error: itemsError } = await supabase
    .from(ORDER_ITEMS_TABLE)
    .insert(itemsPayload);

  assertSupabaseSuccess(itemsError, "Nao foi possivel salvar os itens do pedido");
  return orderId;
}

export async function createOrderFromRequest(
  input: CreateOrderFromRequestInput
): Promise<string> {
  const request = await getPurchaseRequestById(input.requestId);

  if (!request) {
    throw new Error("Solicitacao nao encontrada.");
  }

  const requestItems = await listPurchaseRequestItems(input.requestId);

  if (!requestItems.length) {
    throw new Error("A solicitacao nao possui itens.");
  }

  const normalizedItems = requestItems.map((requestItem) => {
    const matchedPrice = input.itemPrices.find((price) => {
      if (requestItem.productId && price.productId) {
        return requestItem.productId === price.productId;
      }

      return (
        requestItem.produtoNome.trim().toLowerCase() ===
        price.produtoNome.trim().toLowerCase()
      );
    });

    return {
      productId: requestItem.productId ?? "",
      produtoNome: requestItem.produtoNome,
      unidade: requestItem.unidade,
      quantidade: requestItem.quantidade,
      valorUnitario: Number(matchedPrice?.valorUnitario ?? 0),
      desconto: Number(matchedPrice?.desconto ?? 0),
      observacao: matchedPrice?.observacao ?? requestItem.observacao ?? "",
    };
  });

  if (normalizedItems.some((item) => item.valorUnitario <= 0)) {
    throw new Error("Todos os itens precisam ter valor unitario maior que zero.");
  }

  const orderId = await createPurchaseOrder({
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    requestId: request.id,
    requestNumber: request.numero,
    previsaoEntrega: input.previsaoEntrega,
    vencimento: input.vencimento,
    observacoes: input.observacoes,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    items: normalizedItems,
  });

  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from("purchase_requests")
    .update({ status: "convertida" })
    .eq("id", request.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar a solicitacao de compra");
  return orderId;
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar os pedidos de compra");
  return (data ?? []).map((row) => normalizeOrder(row as Record<string, unknown>));
}

export async function getPurchaseOrderById(
  id: string
): Promise<PurchaseOrder | null> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar o pedido de compra");
  return data ? normalizeOrder(data as Record<string, unknown>) : null;
}

export async function listPurchaseOrderItems(
  purchaseOrderId: string
): Promise<PurchaseOrderItem[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(ORDER_ITEMS_TABLE)
    .select("*")
    .eq("purchase_order_id", purchaseOrderId)
    .order("produto_nome", { ascending: true });

  assertSupabaseSuccess(error, "Nao foi possivel listar os itens do pedido");
  return (data ?? []).map((row) =>
    normalizeOrderItem(row as Record<string, unknown>)
  );
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: PurchaseOrderStatus
): Promise<void> {
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(ORDERS_TABLE)
    .update({ status })
    .eq("id", id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar o status do pedido");
}
