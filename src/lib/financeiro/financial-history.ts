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
  FinancialHistoryAction,
  FinancialHistoryEntry,
} from "@/types/compras";

const COLLECTION_NAME = "financialHistory";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeEntry(
  id: string,
  data: Record<string, any>
): FinancialHistoryEntry {
  return {
    id,
    financeType: data.financeType ?? "pagar",
    financeId: data.financeId ?? "",
    action: data.action ?? "editado",
    title: data.title ?? "",
    description: data.description ?? "",
    bankAccountName: data.bankAccountName ?? "",
    reconciliationEntryId: data.reconciliationEntryId ?? "",
    createdAt: toIsoDate(data.createdAt),
    createdBy: data.createdBy ?? "",
  };
}

export async function createFinancialHistoryEntry(input: {
  financeType: "pagar" | "receber";
  financeId: string;
  action: FinancialHistoryAction;
  title: string;
  description?: string;
  bankAccountName?: string;
  reconciliationEntryId?: string;
  createdBy?: string;
}) {
  const ref = doc(collection(db, COLLECTION_NAME));

  await setDoc(ref, {
    financeType: input.financeType,
    financeId: input.financeId,
    action: input.action,
    title: input.title,
    description: input.description ?? "",
    bankAccountName: input.bankAccountName ?? "",
    reconciliationEntryId: input.reconciliationEntryId ?? "",
    createdBy: input.createdBy ?? "",
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function listFinancialHistory(params: {
  financeType: "pagar" | "receber";
  financeId: string;
}) {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("financeType", "==", params.financeType),
    where("financeId", "==", params.financeId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => normalizeEntry(item.id, item.data()));
}