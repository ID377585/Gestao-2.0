import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { createFinancialHistoryEntry } from "@/lib/financeiro/financial-history";
import { db } from "@/lib/firebase/client";
import { createBankReconciliationEntry } from "@/lib/financeiro/bank-reconciliation";
import type {
  AccountReceivable,
  ReceivableStatus,
  UpdateAccountReceivableStatusInput,
} from "@/types/compras";

const COLLECTION_NAME = "accountsReceivable";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeReceivable(
  id: string,
  data: Record<string, any>
): AccountReceivable {
  return {
    id,
    origem: data.origem ?? "manual",
    origemId: data.origemId ?? "",
    customerId: data.customerId ?? "",
    customerName: data.customerName ?? "",
    descricao: data.descricao ?? "",
    valor: Number(data.valor ?? 0),
    vencimento: data.vencimento ?? "",
    statusRecebimento: data.statusRecebimento ?? "pendente",
    dataRecebimento: data.dataRecebimento ?? "",
    formaRecebimento: data.formaRecebimento ?? "",
    bankAccountId: data.bankAccountId ?? "",
    bankAccountName: data.bankAccountName ?? "",
    observacoes: data.observacoes ?? "",
    categoriaId: data.categoriaId ?? "",
    categoria: data.categoria ?? "",
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function computeReceivableStatus(
  receivable: AccountReceivable
): ReceivableStatus {
  if (receivable.statusRecebimento === "cancelado") return "cancelado";
  if (receivable.statusRecebimento === "recebido") return "recebido";
  if (receivable.vencimento && receivable.vencimento < todayYmd()) {
    return "vencido";
  }
  return "pendente";
}

export async function listAccountsReceivable(): Promise<AccountReceivable[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  const normalized = snapshot.docs.map((docItem) =>
    normalizeReceivable(docItem.id, docItem.data())
  );

  return normalized.map((item) => ({
    ...item,
    statusRecebimento: computeReceivableStatus(item),
  }));
}

export async function getAccountReceivableById(
  id: string
): Promise<AccountReceivable | null> {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  const normalized = normalizeReceivable(snapshot.id, snapshot.data());

  return {
    ...normalized,
    statusRecebimento: computeReceivableStatus(normalized),
  };
}

export async function createAccountReceivable(input: {
  origem?: "pedido" | "manual";
  origemId?: string;
  customerId?: string;
  customerName: string;
  descricao: string;
  valor: number;
  vencimento: string;
  categoriaId?: string;
  categoria?: string;
  observacoes?: string;
}) {
  const ref = doc(collection(db, COLLECTION_NAME));

await createFinancialHistoryEntry({
  financeType: "receber",
  financeId: ref.id,
  action: "criado",
  title: "Conta a receber criada",
  description: `${input.customerName} - ${input.descricao}`,
});

  await setDoc(ref, {
    origem: input.origem ?? "manual",
    origemId: input.origemId ?? "",
    customerId: input.customerId ?? "",
    customerName: input.customerName,
    descricao: input.descricao,
    valor: Number(input.valor ?? 0),
    vencimento: input.vencimento,
    statusRecebimento: "pendente",
    dataRecebimento: "",
    formaRecebimento: "",
    bankAccountId: "",
    bankAccountName: "",
    categoriaId: input.categoriaId ?? "",
    categoria: input.categoria ?? "",
    observacoes: input.observacoes ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateAccountReceivableDetails(params: {
  id: string;
  descricao?: string;
  vencimento?: string;
  categoriaId?: string;
  categoria?: string;
  observacoes?: string;
}) {
  const ref = doc(db, COLLECTION_NAME, params.id);

await createFinancialHistoryEntry({
  financeType: "receber",
  financeId: params.id,
  action: "editado",
  title: "Conta a receber editada",
  description: params.descricao ?? "",
});

  await updateDoc(ref, {
    descricao: params.descricao ?? "",
    vencimento: params.vencimento ?? "",
    categoriaId: params.categoriaId ?? "",
    categoria: params.categoria ?? "",
    observacoes: params.observacoes ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function updateAccountReceivableStatus(
  id: string,
  input: UpdateAccountReceivableStatusInput & {
    bankAccountId?: string;
    bankAccountName?: string;
  }
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, {
    statusRecebimento: input.statusRecebimento,
    dataRecebimento: input.dataRecebimento ?? "",
    formaRecebimento: input.formaRecebimento ?? "",
    bankAccountId: input.bankAccountId ?? "",
    bankAccountName: input.bankAccountName ?? "",
    observacoes: input.observacoes ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function markAccountReceivableAsReceived(params: {
  id: string;
  dataRecebimento?: string;
  formaRecebimento?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  observacoes?: string;
}) {
  const current = await getAccountReceivableById(params.id);

await createFinancialHistoryEntry({
  financeType: "receber",
  financeId: params.id,
  action: "recebido",
  title: "Conta marcada como recebida",
  description: params.formaRecebimento ?? "",
  bankAccountName: params.bankAccountName ?? "",
});

  await updateAccountReceivableStatus(params.id, {
    statusRecebimento: "recebido",
    dataRecebimento: params.dataRecebimento ?? todayYmd(),
    formaRecebimento: params.formaRecebimento ?? "",
    bankAccountId: params.bankAccountId ?? "",
    bankAccountName: params.bankAccountName ?? "",
    observacoes: params.observacoes ?? "",
  });

  if (
    current &&
    params.bankAccountId &&
    params.bankAccountName &&
    Number(current.valor) > 0
  ) {
    await createBankReconciliationEntry({
      bankAccountId: params.bankAccountId,
      bankAccountName: params.bankAccountName,
      data: params.dataRecebimento ?? todayYmd(),
      descricao: `Recebimento - ${current.descricao}`,
      tipo: "entrada",
      valor: Number(current.valor),
      origem: "financeiro",
      origemId: current.id,
      observacoes: params.observacoes ?? "",
    });
  }
}

export async function markAccountReceivableAsPending(params: {
  id: string;
  observacoes?: string;
}) {
  
  await createFinancialHistoryEntry({
  financeType: "receber",
  financeId: params.id,
  action: "pendente",
  title: "Conta retornou para pendente",
  description: params.observacoes ?? "",
});

    await updateAccountReceivableStatus(params.id, {
    statusRecebimento: "pendente",
    dataRecebimento: "",
    formaRecebimento: "",
    bankAccountId: "",
    bankAccountName: "",
    observacoes: params.observacoes ?? "",
  });
}

export async function cancelAccountReceivable(params: {
  id: string;
  observacoes?: string;
}) {
  
  await createFinancialHistoryEntry({
  financeType: "receber",
  financeId: params.id,
  action: "cancelado",
  title: "Conta a receber cancelada",
  description: params.observacoes ?? "",
});
  
    await updateAccountReceivableStatus(params.id, {
    statusRecebimento: "cancelado",
    dataRecebimento: "",
    formaRecebimento: "",
    bankAccountId: "",
    bankAccountName: "",
    observacoes: params.observacoes ?? "",
  });
}