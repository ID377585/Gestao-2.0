import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
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

const COLLECTION_NAME = "goodsReceipts";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function generateReceiptNumber() {
  return `RC-${Date.now()}`;
}

function normalizeReceipt(id: string, data: Record<string, any>): GoodsReceipt {
  return {
    id,
    numero: data.numero ?? "",
    purchaseOrderId: data.purchaseOrderId ?? "",
    purchaseOrderNumber: data.purchaseOrderNumber ?? "",
    supplierId: data.supplierId ?? "",
    supplierName: data.supplierName ?? "",
    dataRecebimento: data.dataRecebimento ?? "",
    responsavelId: data.responsavelId ?? "",
    responsavelNome: data.responsavelNome ?? "",
    status: data.status ?? "pendente",
    observacoes: data.observacoes ?? "",
    totalItens: Number(data.totalItens ?? 0),
    valorTotalRecebido: Number(data.valorTotalRecebido ?? 0),
    inventoryApplied: Boolean(data.inventoryApplied ?? false),
    inventoryPendingLink: Boolean(data.inventoryPendingLink ?? false),
    payableCreated: Boolean(data.payableCreated ?? false),
    finalizedAt: toIsoDate(data.finalizedAt),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

function normalizeReceiptItem(
  id: string,
  receiptId: string,
  data: Record<string, any>
): GoodsReceiptItem {
  return {
    id,
    receiptId,
    productId: data.productId ?? "",
    produtoNome: data.produtoNome ?? "",
    unidade: data.unidade ?? "",
    quantidadePedido: Number(data.quantidadePedido ?? 0),
    quantidadeRecebida: Number(data.quantidadeRecebida ?? 0),
    valorUnitarioPedido: Number(data.valorUnitarioPedido ?? 0),
    valorUnitarioReal: Number(
      data.valorUnitarioReal ?? data.valorUnitarioPedido ?? 0
    ),
    lote: data.lote ?? "",
    validade: data.validade ?? "",
    divergencia: Boolean(data.divergencia ?? false),
    motivoDivergencia: data.motivoDivergencia ?? "",
    observacao: data.observacao ?? "",
  };
}

async function findReceiptByOrderId(
  purchaseOrderId: string
): Promise<GoodsReceipt | null> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("purchaseOrderId", "==", purchaseOrderId),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const first = snapshot.docs[0];
  return normalizeReceipt(first.id, first.data());
}

function getOrderStatusFromReceiptItems(
  items: GoodsReceiptItem[]
): PurchaseOrderStatus {
  if (!items.length) return "aberto";

  const allFullyReceived = items.every(
    (item) => Number(item.quantidadeRecebida) >= Number(item.quantidadePedido)
  );

  if (allFullyReceived) return "recebido";

  const anyReceived = items.some(
    (item) => Number(item.quantidadeRecebida) > 0
  );

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
    throw new Error("Pedido de compra não encontrado.");
  }

  const orderItems = await listPurchaseOrderItems(order.id);

  if (!orderItems.length) {
    throw new Error("O pedido não possui itens.");
  }

  const receiptRef = doc(collection(db, COLLECTION_NAME));
  const receiptId = receiptRef.id;
  const batch = writeBatch(db);

  batch.set(receiptRef, {
    numero: generateReceiptNumber(),
    purchaseOrderId: order.id,
    purchaseOrderNumber: order.numero,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    dataRecebimento: new Date().toISOString(),
    responsavelId: input.responsavelId.trim(),
    responsavelNome: input.responsavelNome.trim(),
    status: "pendente",
    observacoes: input.observacoes?.trim() ?? "",
    totalItens: orderItems.length,
    valorTotalRecebido: 0,
    inventoryApplied: false,
    inventoryPendingLink: false,
    payableCreated: false,
    finalizedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  orderItems.forEach((item) => {
    const itemRef = doc(collection(db, COLLECTION_NAME, receiptId, "items"));

    batch.set(itemRef, {
      productId: item.productId?.trim() ?? "",
      produtoNome: item.produtoNome.trim(),
      unidade: item.unidade.trim(),
      quantidadePedido: Number(item.quantidade),
      quantidadeRecebida: 0,
      valorUnitarioPedido: Number(item.valorUnitario),
      valorUnitarioReal: Number(item.valorUnitario),
      lote: "",
      validade: "",
      divergencia: false,
      motivoDivergencia: "",
      observacao: item.observacao?.trim() ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();

  return receiptId;
}

export async function listGoodsReceipts(): Promise<GoodsReceipt[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) =>
    normalizeReceipt(docItem.id, docItem.data())
  );
}

export async function getGoodsReceiptById(
  id: string
): Promise<GoodsReceipt | null> {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return normalizeReceipt(snapshot.id, snapshot.data());
}

export async function listGoodsReceiptItems(
  receiptId: string
): Promise<GoodsReceiptItem[]> {
  const q = query(
    collection(db, COLLECTION_NAME, receiptId, "items"),
    orderBy("produtoNome", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) =>
    normalizeReceiptItem(docItem.id, receiptId, docItem.data())
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
    throw new Error("Recebimento não encontrado.");
  }

  const order = await getPurchaseOrderById(receipt.purchaseOrderId);

  if (!order) {
    throw new Error("Pedido vinculado ao recebimento não encontrado.");
  }

  const currentItems = await listGoodsReceiptItems(receipt.id);

  if (!currentItems.length) {
    throw new Error("O recebimento não possui itens.");
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
      throw new Error("Quantidade recebida não pode ser negativa.");
    }

    if (valorUnitarioReal < 0) {
      throw new Error("Valor unitário real não pode ser negativo.");
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
  const q = query(
    collection(db, COLLECTION_NAME),
    where("purchaseOrderId", "==", purchaseOrderId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) =>
    normalizeReceipt(docItem.id, docItem.data())
  );
}
