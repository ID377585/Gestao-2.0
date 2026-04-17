import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type {
  AccountPayable,
  PayableStatus,
  UpdateAccountPayableStatusInput,
} from "@/types/compras";

const COLLECTION_NAME = "accountsPayable";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizePayable(
  id: string,
  data: Record<string, any>
): AccountPayable {
  return {
    id,
    origem: data.origem ?? "compra",
    origemId: data.origemId ?? "",
    supplierId: data.supplierId ?? "",
    supplierName: data.supplierName ?? "",
    descricao: data.descricao ?? "",
    valor: Number(data.valor ?? 0),
    vencimento: data.vencimento ?? "",
    statusPagamento: data.statusPagamento ?? "pendente",
    dataPagamento: data.dataPagamento ?? "",
    observacoes: data.observacoes ?? "",
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function computePayableStatus(payable: AccountPayable): PayableStatus {
  if (payable.statusPagamento === "pago") return "pago";
  if (payable.vencimento && payable.vencimento < todayYmd()) return "vencido";
  return "pendente";
}

export async function listAccountsPayable(): Promise<AccountPayable[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  const normalized = snapshot.docs.map((docItem) =>
    normalizePayable(docItem.id, docItem.data())
  );

  return normalized.map((item) => ({
    ...item,
    statusPagamento: computePayableStatus(item),
  }));
}

export async function getAccountPayableById(
  id: string
): Promise<AccountPayable | null> {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  const normalized = normalizePayable(snapshot.id, snapshot.data());

  return {
    ...normalized,
    statusPagamento: computePayableStatus(normalized),
  };
}

export async function updateAccountPayableStatus(
  id: string,
  input: UpdateAccountPayableStatusInput
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, {
    statusPagamento: input.statusPagamento,
    dataPagamento: input.dataPagamento ?? "",
    observacoes: input.observacoes ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function markAccountPayableAsPaid(params: {
  id: string;
  dataPagamento?: string;
  observacoes?: string;
}) {
  await updateAccountPayableStatus(params.id, {
    statusPagamento: "pago",
    dataPagamento: params.dataPagamento ?? todayYmd(),
    observacoes: params.observacoes ?? "",
  });
}

export async function markAccountPayableAsPending(params: {
  id: string;
  observacoes?: string;
}) {
  await updateAccountPayableStatus(params.id, {
    statusPagamento: "pendente",
    dataPagamento: "",
    observacoes: params.observacoes ?? "",
  });
}