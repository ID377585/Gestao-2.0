import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { getPurchaseRequestById, listPurchaseRequestItems } from "@/lib/compras/requests";
import type {
  CreateOrderFromRequestInput,
  CreatePurchaseOrderInput,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
} from "@/types/compras";

const COLLECTION_NAME = "purchaseOrders";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeOrder(id: string, data: Record<string, any>): PurchaseOrder {
  return {
    id,
    numero: data.numero ?? "",
    supplierId: data.supplierId ?? "",
    supplierName: data.supplierName ?? "",
    requestId: data.requestId ?? "",
    requestNumber: data.requestNumber ?? "",
    dataEmissao: data.dataEmissao ?? "",
    previsaoEntrega: data.previsaoEntrega ?? "",
    vencimento: data.vencimento ?? "",
    status: data.status ?? "aberto",
    valorTotal: data.valorTotal ?? 0,
    observacoes: data.observacoes ?? "",
    createdBy: data.createdBy ?? "",
    createdByName: data.createdByName ?? "",
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

function normalizeOrderItem(
  id: string,
  purchaseOrderId: string,
  data: Record<string, any>
): PurchaseOrderItem {
  return {
    id,
    purchaseOrderId,
    productId: data.productId ?? "",
    produtoNome: data.produtoNome ?? "",
    unidade: data.unidade ?? "",
    quantidade: data.quantidade ?? 0,
    valorUnitario: data.valorUnitario ?? 0,
    desconto: data.desconto ?? 0,
    valorTotal: data.valorTotal ?? 0,
    observacao: data.observacao ?? "",
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

  const orderRef = doc(collection(db, COLLECTION_NAME));
  const batch = writeBatch(db);

  const orderId = orderRef.id;
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

  batch.set(orderRef, {
    numero,
    supplierId: input.supplierId.trim(),
    supplierName: input.supplierName.trim(),
    requestId: input.requestId?.trim() ?? "",
    requestNumber: input.requestNumber?.trim() ?? "",
    dataEmissao: new Date().toISOString(),
    previsaoEntrega: input.previsaoEntrega ?? "",
    vencimento: input.vencimento ?? "",
    status: "aberto",
    valorTotal,
    observacoes: input.observacoes?.trim() ?? "",
    createdBy: input.createdBy.trim(),
    createdByName: input.createdByName.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  items.forEach((item) => {
    const itemRef = doc(collection(db, COLLECTION_NAME, orderId, "items"));

    batch.set(itemRef, {
      productId: item.productId?.trim() ?? "",
      produtoNome: item.produtoNome.trim(),
      unidade: item.unidade.trim(),
      quantidade: Number(item.quantidade),
      valorUnitario: Number(item.valorUnitario),
      desconto: Number(item.desconto ?? 0),
      valorTotal: Number(item.valorTotal),
      observacao: item.observacao?.trim() ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  batch.commit();
  return orderId;
}

export async function createOrderFromRequest(
  input: CreateOrderFromRequestInput
): Promise<string> {
  const request = await getPurchaseRequestById(input.requestId);

  if (!request) {
    throw new Error("Solicitação não encontrada.");
  }

  const requestItems = await listPurchaseRequestItems(input.requestId);

  if (!requestItems.length) {
    throw new Error("A solicitação não possui itens.");
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
    throw new Error("Todos os itens precisam ter valor unitário maior que zero.");
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

  await updateDoc(doc(db, "purchaseRequests", request.id), {
    status: "convertida",
    updatedAt: serverTimestamp(),
  });

  return orderId;
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) =>
    normalizeOrder(docItem.id, docItem.data())
  );
}

export async function getPurchaseOrderById(
  id: string
): Promise<PurchaseOrder | null> {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return normalizeOrder(snapshot.id, snapshot.data());
}

export async function listPurchaseOrderItems(
  purchaseOrderId: string
): Promise<PurchaseOrderItem[]> {
  const q = query(
    collection(db, COLLECTION_NAME, purchaseOrderId, "items"),
    orderBy("produtoNome", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) =>
    normalizeOrderItem(docItem.id, purchaseOrderId, docItem.data())
  );
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: PurchaseOrderStatus
): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}