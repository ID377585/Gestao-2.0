"use client";

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
import type {
  CreatePurchaseRequestInput,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestStatus,
} from "@/types/compras";

const COLLECTION_NAME = "purchaseRequests";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeRequest(id: string, data: Record<string, any>): PurchaseRequest {
  return {
    id,
    numero: data.numero ?? "",
    setorSolicitante: data.setorSolicitante ?? "",
    solicitanteId: data.solicitanteId ?? "",
    solicitanteNome: data.solicitanteNome ?? "",
    dataSolicitacao: data.dataSolicitacao ?? "",
    prioridade: data.prioridade ?? "media",
    status: data.status ?? "pendente",
    observacoes: data.observacoes ?? "",
    totalItens: data.totalItens ?? 0,
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

function normalizeRequestItem(
  id: string,
  requestId: string,
  data: Record<string, any>
): PurchaseRequestItem {
  return {
    id,
    requestId,
    productId: data.productId ?? "",
    produtoNome: data.produtoNome ?? "",
    unidade: data.unidade ?? "",
    quantidade: data.quantidade ?? 0,
    observacao: data.observacao ?? "",
  };
}

function generateRequestNumber() {
  return `SC-${Date.now()}`;
}

export async function createPurchaseRequest(
  input: CreatePurchaseRequestInput
): Promise<string> {
  if (!input.items.length) {
    throw new Error("A solicitação precisa ter ao menos um item.");
  }

  const requestRef = doc(collection(db, COLLECTION_NAME));
  const batch = writeBatch(db);

  const numero = generateRequestNumber();
  const requestId = requestRef.id;

  batch.set(requestRef, {
    numero,
    setorSolicitante: input.setorSolicitante.trim(),
    solicitanteId: input.solicitanteId.trim(),
    solicitanteNome: input.solicitanteNome.trim(),
    dataSolicitacao: new Date().toISOString(),
    prioridade: input.prioridade,
    status: "pendente",
    observacoes: input.observacoes?.trim() ?? "",
    totalItens: input.items.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  input.items.forEach((item) => {
    const itemRef = doc(collection(db, COLLECTION_NAME, requestId, "items"));

    batch.set(itemRef, {
      productId: item.productId?.trim() ?? "",
      produtoNome: item.produtoNome.trim(),
      unidade: item.unidade.trim(),
      quantidade: Number(item.quantidade),
      observacao: item.observacao?.trim() ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();

  return requestId;
}

export async function listPurchaseRequests(): Promise<PurchaseRequest[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) =>
    normalizeRequest(docItem.id, docItem.data())
  );
}

export async function getPurchaseRequestById(
  id: string
): Promise<PurchaseRequest | null> {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return normalizeRequest(snapshot.id, snapshot.data());
}

export async function listPurchaseRequestItems(
  requestId: string
): Promise<PurchaseRequestItem[]> {
  const q = query(
    collection(db, COLLECTION_NAME, requestId, "items"),
    orderBy("produtoNome", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) =>
    normalizeRequestItem(docItem.id, requestId, docItem.data())
  );
}

export async function updatePurchaseRequestStatus(
  id: string,
  status: PurchaseRequestStatus,
  actor?: {
    userId?: string;
    userName?: string;
  }
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: actor?.userId ?? "",
    updatedByName: actor?.userName ?? "",
  });
}