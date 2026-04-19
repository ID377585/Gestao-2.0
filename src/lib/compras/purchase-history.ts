import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type {
  PurchaseHistoryAction,
  PurchaseHistoryEntry,
  PurchaseHistoryEntityType,
} from "@/types/compras";

const COLLECTION_NAME = "purchaseHistory";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeEntry(
  id: string,
  data: Record<string, any>
): PurchaseHistoryEntry {
  return {
    id,
    entityType: data.entityType ?? "pedido",
    entityId: data.entityId ?? "",
    action: data.action ?? "pedido_criado",
    title: data.title ?? "",
    description: data.description ?? "",
    relatedEntityType: data.relatedEntityType ?? "",
    relatedEntityId: data.relatedEntityId ?? "",
    createdAt: toIsoDate(data.createdAt),
    createdBy: data.createdBy ?? "",
  };
}

export async function createPurchaseHistoryEntry(input: {
  entityType: PurchaseHistoryEntityType;
  entityId: string;
  action: PurchaseHistoryAction;
  title: string;
  description?: string;
  relatedEntityType?: PurchaseHistoryEntityType;
  relatedEntityId?: string;
  createdBy?: string;
}) {
  const ref = doc(collection(db, COLLECTION_NAME));

  await setDoc(ref, {
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    title: input.title,
    description: input.description ?? "",
    relatedEntityType: input.relatedEntityType ?? "",
    relatedEntityId: input.relatedEntityId ?? "",
    createdBy: input.createdBy ?? "",
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function listPurchaseHistory(params: {
  entityType: PurchaseHistoryEntityType;
  entityId: string;
}) {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("entityType", "==", params.entityType),
    where("entityId", "==", params.entityId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => normalizeEntry(item.id, item.data()));
}

export async function listAllPurchaseHistory() {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => normalizeEntry(item.id, item.data()));
}