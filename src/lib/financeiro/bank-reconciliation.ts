import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
  toBoolean,
  toIsoString,
  toNumber,
  toText,
} from "@/lib/legacy/supabase";
import { createFinancialHistoryEntry } from "@/lib/financeiro/financial-history";
import type { BankReconciliationEntry } from "@/types/compras";

const TABLE_NAME = "bank_reconciliation_entries";

function normalizeEntry(
  row: Record<string, unknown>
): BankReconciliationEntry {
  return {
    id: toText(row.id),
    bankAccountId: toText(row.bank_account_id),
    bankAccountName: toText(row.bank_account_name),
    data: toText(row.data),
    descricao: toText(row.descricao),
    tipo: (toText(row.tipo, "saida") ?? "saida") as BankReconciliationEntry["tipo"],
    valor: toNumber(row.valor),
    origem: (toText(row.origem, "manual") ??
      "manual") as BankReconciliationEntry["origem"],
    origemId: toText(row.origem_id),
    conciliado: toBoolean(row.conciliado, false),
    matchedFinanceType: toText(
      row.matched_finance_type
    ) as BankReconciliationEntry["matchedFinanceType"],
    matchedFinanceId: toText(row.matched_finance_id),
    matchedFinanceLabel: toText(row.matched_finance_label),
    matchedAt: toText(row.matched_at),
    observacoes: toText(row.observacoes),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
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
  const supabase = getLegacySupabase();
  let query = supabase.from(TABLE_NAME).select("*");

  if (bankAccountId) {
    query = query.eq("bank_account_id", bankAccountId);
  }

  const { data, error } = await query.order("data", { ascending: false });
  assertSupabaseSuccess(error, "Nao foi possivel listar os lancamentos bancarios");
  return (data ?? []).map((row) => normalizeEntry(row as Record<string, unknown>));
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
  const supabase = getLegacySupabase();
  const id =
    input.origem === "financeiro" && input.origemId
      ? `${input.tipo}_${input.origemId}`
      : createLegacyId();

  const { error } = await supabase.from(TABLE_NAME).upsert(
    {
      id,
      bank_account_id: input.bankAccountId,
      bank_account_name: input.bankAccountName,
      data: input.data,
      descricao: input.descricao,
      tipo: input.tipo,
      valor: Number(input.valor ?? 0),
      origem: input.origem ?? "manual",
      origem_id: input.origemId ?? "",
      conciliado: false,
      matched_finance_type: "",
      matched_finance_id: "",
      matched_finance_label: "",
      matched_at: "",
      observacoes: input.observacoes ?? "",
    },
    { onConflict: "id" }
  );

  assertSupabaseSuccess(error, "Nao foi possivel criar o lancamento bancario");
  return id;
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
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      conciliado: params.conciliado,
      observacoes: params.observacoes ?? "",
    })
    .eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar a conciliacao");
}

export async function linkReconciliationToFinance(params: {
  id: string;
  financeType: "pagar" | "receber";
  financeId: string;
  financeLabel: string;
  observacoes?: string;
}) {
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      conciliado: true,
      matched_finance_type: params.financeType,
      matched_finance_id: params.financeId,
      matched_finance_label: params.financeLabel,
      matched_at: new Date().toISOString(),
      observacoes: params.observacoes ?? "",
    })
    .eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel vincular o lancamento ao financeiro");

  await createFinancialHistoryEntry({
    financeType: params.financeType,
    financeId: params.financeId,
    action: "conciliado_banco",
    title: "Titulo conciliado no banco",
    description: params.financeLabel,
    reconciliationEntryId: params.id,
  });
}

export async function unlinkReconciliationFromFinance(params: {
  id: string;
  observacoes?: string;
}) {
  const currentEntries = await listBankReconciliationEntries();
  const currentEntry = currentEntries.find((item) => item.id === params.id);

  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      conciliado: false,
      matched_finance_type: "",
      matched_finance_id: "",
      matched_finance_label: "",
      matched_at: "",
      observacoes: params.observacoes ?? "",
    })
    .eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel desfazer a conciliacao");

  if (currentEntry?.matchedFinanceType && currentEntry?.matchedFinanceId) {
    await createFinancialHistoryEntry({
      financeType: currentEntry.matchedFinanceType,
      financeId: currentEntry.matchedFinanceId,
      action: "desconciliado_banco",
      title: "Vinculo bancario removido",
      description: params.observacoes ?? "",
      reconciliationEntryId: params.id,
    });
  }
}
