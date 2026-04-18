import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { createFinancialHistoryEntry } from "@/lib/financeiro/financial-history";
import { db } from "@/lib/firebase/client";
import type { BankReconciliationEntry } from "@/types/compras";

const COLLECTION_NAME = "bankReconciliationEntries";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeEntry(
  id: string,
  data: Record<string, any>
): BankReconciliationEntry {
  return {
    id,
    bankAccountId: data.bankAccountId ?? "",
    bankAccountName: data.bankAccountName ?? "",
    data: data.data ?? "",
    descricao: data.descricao ?? "",
    tipo: data.tipo ?? "saida",
    valor: Number(data.valor ?? 0),
    origem: data.origem ?? "manual",
    origemId: data.origemId ?? "",
    conciliado: Boolean(data.conciliado ?? false),
    matchedFinanceType: data.matchedFinanceType ?? "",
    matchedFinanceId: data.matchedFinanceId ?? "",
    matchedFinanceLabel: data.matchedFinanceLabel ?? "",
    matchedAt: data.matchedAt ?? "",
    observacoes: data.observacoes ?? "",
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeDate(value: string) {
  if (!value) return "";

  if (value.includes("/")) {
    const [day, month, year] = value.split("/");
    if (day && month && year) {
      const normalizedYear = year.length === 2 ? `20${year}` : year;
      return `${normalizedYear.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  return value;
}

function normalizeMoney(value: string) {
  if (!value) return 0;

  const sanitized = value
    .replace(/R\$/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listBankReconciliationEntries(
  bankAccountId?: string
): Promise<BankReconciliationEntry[]> {
  const baseCollection = collection(db, COLLECTION_NAME);

  const q = bankAccountId
    ? query(
        baseCollection,
        where("bankAccountId", "==", bankAccountId),
        orderBy("data", "desc")
      )
    : query(baseCollection, orderBy("data", "desc"));

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => normalizeEntry(item.id, item.data()));
}

export async function createBankReconciliationEntry(input: {
  bankAccountId: string;
  bankAccountName: string;
  data: string;
  descricao: string;
  tipo: "entrada" | "saida";
  valor: number;
  origem?: "manual" | "financeiro";
  origemId?: string;
  observacoes?: string;
}) {
  const refId =
    input.origem === "financeiro" && input.origemId
      ? `${input.tipo}_${input.origemId}`
      : doc(collection(db, COLLECTION_NAME)).id;

  const ref = doc(db, COLLECTION_NAME, refId);

  await setDoc(
    ref,
    {
      bankAccountId: input.bankAccountId,
      bankAccountName: input.bankAccountName,
      data: input.data,
      descricao: input.descricao,
      tipo: input.tipo,
      valor: Number(input.valor ?? 0),
      origem: input.origem ?? "manual",
      origemId: input.origemId ?? "",
      conciliado: false,
      matchedFinanceType: "",
      matchedFinanceId: "",
      matchedFinanceLabel: "",
      matchedAt: "",
      observacoes: input.observacoes ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return ref.id;
}

export async function importBankReconciliationCsv(params: {
  csvText: string;
  bankAccountId: string;
  bankAccountName: string;
}) {
  const lines = params.csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    throw new Error("CSV vazio ou sem linhas suficientes.");
  }

  const headers = parseCsvLine(lines[0]).map((item) => item.toLowerCase());

  const dateIndex = headers.findIndex((item) => item.includes("data"));
  const descriptionIndex = headers.findIndex(
    (item) =>
      item.includes("descricao") ||
      item.includes("descrição") ||
      item.includes("historico") ||
      item.includes("histórico")
  );
  const valueIndex = headers.findIndex(
    (item) => item.includes("valor") || item.includes("amount")
  );
  const typeIndex = headers.findIndex((item) => item.includes("tipo"));

  if (dateIndex === -1 || descriptionIndex === -1 || valueIndex === -1) {
    throw new Error("CSV precisa ter colunas de data, descricao e valor.");
  }

  let importedCount = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);

    const data = normalizeDate(cols[dateIndex] ?? "");
    const descricao = cols[descriptionIndex] ?? "";
    const valor = normalizeMoney(cols[valueIndex] ?? "");
    const rawType = (cols[typeIndex] ?? "").toLowerCase();

    if (!data || !descricao || !valor) continue;

    const tipo =
      rawType === "entrada" || rawType === "credito" || rawType === "crédito"
        ? "entrada"
        : valor < 0
        ? "saida"
        : "entrada";

    await createBankReconciliationEntry({
      bankAccountId: params.bankAccountId,
      bankAccountName: params.bankAccountName,
      data,
      descricao,
      tipo,
      valor: Math.abs(Number(valor)),
      origem: "manual",
      observacoes: "Importado por CSV",
    });

    importedCount += 1;
  }

  return importedCount;
}

export async function markReconciliationEntry(params: {
  id: string;
  conciliado: boolean;
  observacoes?: string;
}) {
  const ref = doc(db, COLLECTION_NAME, params.id);

  await updateDoc(ref, {
    conciliado: params.conciliado,
    observacoes: params.observacoes ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function linkReconciliationToFinance(params: {
  id: string;
  financeType: "pagar" | "receber";
  financeId: string;
  financeLabel: string;
  observacoes?: string;
}) {
  const ref = doc(db, COLLECTION_NAME, params.id);

  await updateDoc(ref, {
    conciliado: true,
    matchedFinanceType: params.financeType,
    matchedFinanceId: params.financeId,
    matchedFinanceLabel: params.financeLabel,
    matchedAt: new Date().toISOString(),
    observacoes: params.observacoes ?? "",
    updatedAt: serverTimestamp(),
  });

await createFinancialHistoryEntry({
  financeType: params.financeType,
  financeId: params.financeId,
  action: "conciliado_banco",
  title: "Título conciliado no banco",
  description: params.financeLabel,
  reconciliationEntryId: params.id,
});

}

export async function unlinkReconciliationFromFinance(params: {
  id: string;
  observacoes?: string;
}) {
  const ref = doc(db, COLLECTION_NAME, params.id);
  const currentEntries = await listBankReconciliationEntries();
const currentEntry = currentEntries.find((item) => item.id === params.id);

if (currentEntry?.matchedFinanceType && currentEntry?.matchedFinanceId) {
  await createFinancialHistoryEntry({
    financeType: currentEntry.matchedFinanceType,
    financeId: currentEntry.matchedFinanceId,
    action: "desconciliado_banco",
    title: "Vínculo bancário removido",
    description: params.observacoes ?? "",
    reconciliationEntryId: params.id,
  });
}

  await updateDoc(ref, {
    conciliado: false,
    matchedFinanceType: "",
    matchedFinanceId: "",
    matchedFinanceLabel: "",
    matchedAt: "",
    observacoes: params.observacoes ?? "",
    updatedAt: serverTimestamp(),
  });
}