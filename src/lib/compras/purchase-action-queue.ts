import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { PurchaseAlertActionItem } from "@/types/compras";

const COLLECTION_NAME = "purchaseActionQueue";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeItem(
  id: string,
  data: Record<string, any>
): PurchaseAlertActionItem {
  return {
    id,
    alertId: data.alertId ?? "",
    alertType: data.alertType ?? "fornecedor_critico",
    title: data.title ?? "",
    description: data.description ?? "",
    severity: data.severity ?? "media",
    supplierId: data.supplierId ?? "",
    supplierName: data.supplierName ?? "",
    purchaseOrderId: data.purchaseOrderId ?? "",
    purchaseOrderNumber: data.purchaseOrderNumber ?? "",
    status: data.status ?? "pendente",
    observacaoTratativa: data.observacaoTratativa ?? "",
    treatedAt: data.treatedAt ?? "",
    treatedBy: data.treatedBy ?? "",
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

export async function listPurchaseActionQueue() {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("updatedAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => normalizeItem(item.id, item.data()));
}

export async function upsertPurchaseActionItem(input: {
  alertId: string;
  alertType: PurchaseAlertActionItem["alertType"];
  title: string;
  description: string;
  severity: PurchaseAlertActionItem["severity"];
  supplierId?: string;
  supplierName?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
}) {
  const ref = doc(db, COLLECTION_NAME, input.alertId);

  await setDoc(
    ref,
    {
      alertId: input.alertId,
      alertType: input.alertType,
      title: input.title,
      description: input.description,
      severity: input.severity,
      supplierId: input.supplierId ?? "",
      supplierName: input.supplierName ?? "",
      purchaseOrderId: input.purchaseOrderId ?? "",
      purchaseOrderNumber: input.purchaseOrderNumber ?? "",
      status: "pendente",
      observacaoTratativa: "",
      treatedAt: "",
      treatedBy: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return ref.id;
}

export async function markPurchaseActionAsDone(params: {
  id: string;
  observacaoTratativa?: string;
  treatedBy?: string;
}) {
  const ref = doc(db, COLLECTION_NAME, params.id);

  await updateDoc(ref, {
    status: "tratado",
    observacaoTratativa: params.observacaoTratativa ?? "",
    treatedAt: new Date().toISOString(),
    treatedBy: params.treatedBy ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function reopenPurchaseAction(params: {
  id: string;
}) {
  const ref = doc(db, COLLECTION_NAME, params.id);

  await updateDoc(ref, {
    status: "pendente",
    observacaoTratativa: "",
    treatedAt: "",
    treatedBy: "",
    updatedAt: serverTimestamp(),
  });
}