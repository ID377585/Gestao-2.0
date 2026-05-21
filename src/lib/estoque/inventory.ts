import {
  assertSupabaseSuccess,
  getLegacyTenantScope,
  legacySelect,
  legacyUpdate,
  legacyUpsert,
  toBoolean,
} from "@/lib/legacy/supabase";
import { moveStock } from "@/lib/stock/moveStock";
import type {
  FinalizeGoodsReceiptResult,
  GoodsReceipt,
  GoodsReceiptItem,
  PurchaseOrder,
  PurchaseOrderStatus,
} from "@/types/compras";

const RECEIPTS_TABLE = "goods_receipts";
const RECEIPT_ITEMS_TABLE = "goods_receipt_items";
const ORDERS_TABLE = "purchase_orders";
const PAYABLES_TABLE = "accounts_payable";

export async function applyPurchaseReceiptToInventory(params: {
  receipt: GoodsReceipt;
  order: PurchaseOrder;
  items: GoodsReceiptItem[];
  receiptStatus: "divergencia" | "finalizado";
  orderStatus: PurchaseOrderStatus;
  valorTotalRecebido: number;
  observacoes?: string;
  vencimento?: string;
}): Promise<FinalizeGoodsReceiptResult> {
  const { supabase, establishmentId } = await getLegacyTenantScope();
  const { query: liveReceiptQuery } = await legacySelect(
    RECEIPTS_TABLE,
    "id, inventory_applied, inventory_pending_link, status, valor_total_recebido"
  );

  const { data: liveReceipt, error: receiptError } = await liveReceiptQuery
    .eq("id", params.receipt.id)
    .maybeSingle();

  assertSupabaseSuccess(receiptError, "Nao foi possivel validar o recebimento");

  if (!liveReceipt) {
    throw new Error("Recebimento nao encontrado.");
  }

  if (toBoolean(liveReceipt.inventory_applied, false)) {
    return {
      receiptStatus: (liveReceipt.status as "divergencia" | "finalizado") ?? params.receiptStatus,
      orderStatus: params.orderStatus,
      valorTotalRecebido: Number(liveReceipt.valor_total_recebido ?? 0),
      inventoryPendingLink: toBoolean(liveReceipt.inventory_pending_link, false),
      alreadyApplied: true,
    };
  }

  let inventoryPendingLink = false;

  for (const item of params.items) {
    const quantidadeRecebida = Number(item.quantidadeRecebida ?? 0);
    const valorUnitarioReal = Number(item.valorUnitarioReal ?? 0);

    const { query: itemUpdateQuery } = await legacyUpdate(RECEIPT_ITEMS_TABLE, {
      quantidade_recebida: quantidadeRecebida,
      valor_unitario_real: valorUnitarioReal,
      lote: item.lote ?? "",
      validade: item.validade ?? "",
      divergencia: Boolean(item.divergencia),
      motivo_divergencia: item.motivoDivergencia ?? "",
    });
    const { error: itemError } = await itemUpdateQuery
      .eq("id", item.id)
      .eq("receipt_id", params.receipt.id);

    assertSupabaseSuccess(itemError, "Nao foi possivel atualizar os itens do recebimento");

    if (quantidadeRecebida <= 0) {
      continue;
    }

    if (!item.productId) {
      inventoryPendingLink = true;
      continue;
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, establishment_id, default_unit_label")
      .eq("id", item.productId)
      .eq("establishment_id", establishmentId)
      .maybeSingle();

    if (productError || !product) {
      console.error("[compras] produto sem vinculo de estoque para recebimento", {
        itemId: item.id,
        productId: item.productId,
        error: productError,
      });
      inventoryPendingLink = true;
      continue;
    }

    try {
      await moveStock(supabase as never, {
        establishment_id: establishmentId,
        product_id: product.id,
        unit_label: item.unidade || product.default_unit_label || "UN",
        qty_delta: quantidadeRecebida,
        reason: "purchase_receipt",
        source: "legacy_purchase_receipt",
      });
    } catch (error) {
      console.error("[compras] falha ao aplicar estoque do recebimento", {
        receiptId: params.receipt.id,
        itemId: item.id,
        productId: item.productId,
        error,
      });
      inventoryPendingLink = true;
    }
  }

  const { query: receiptUpdateQuery } = await legacyUpdate(RECEIPTS_TABLE, {
    status: params.receiptStatus,
    observacoes: params.observacoes ?? params.receipt.observacoes ?? "",
    valor_total_recebido: params.valorTotalRecebido,
    inventory_applied: true,
    inventory_pending_link: inventoryPendingLink,
    payable_created: params.valorTotalRecebido > 0,
    finalized_at: new Date().toISOString(),
  });
  const { error: receiptUpdateError } = await receiptUpdateQuery.eq(
    "id",
    params.receipt.id
  );

  assertSupabaseSuccess(receiptUpdateError, "Nao foi possivel finalizar o recebimento");

  const { query: orderUpdateQuery } = await legacyUpdate(ORDERS_TABLE, {
    status: params.orderStatus,
  });
  const { error: orderUpdateError } = await orderUpdateQuery.eq(
    "id",
    params.order.id
  );

  assertSupabaseSuccess(orderUpdateError, "Nao foi possivel atualizar o pedido de compra");

  if (params.valorTotalRecebido > 0) {
    const payableQuery = await legacyUpsert(
      PAYABLES_TABLE,
      {
        id: params.receipt.id,
        origem: "recebimento",
        origem_id: params.receipt.id,
        supplier_id: params.receipt.supplierId,
        supplier_name: params.receipt.supplierName,
        descricao: `Recebimento ${params.receipt.numero} - Pedido ${params.receipt.purchaseOrderNumber}`,
        valor: params.valorTotalRecebido,
        vencimento: params.vencimento ?? params.order.vencimento ?? "",
        status_pagamento: "pendente",
        data_pagamento: "",
        forma_pagamento: "",
        numero_documento: params.receipt.numero,
        categoria: "Compras",
        centro_custo: "Suprimentos",
        observacoes: params.observacoes ?? "",
      },
      { onConflict: "id" }
    );
    const { error: payableError } = await payableQuery;

    assertSupabaseSuccess(payableError, "Nao foi possivel gerar a conta a pagar do recebimento");
  }

  return {
    receiptStatus: params.receiptStatus,
    orderStatus: params.orderStatus,
    valorTotalRecebido: params.valorTotalRecebido,
    inventoryPendingLink,
    alreadyApplied: false,
  };
}
