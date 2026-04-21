import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
  toIsoString,
  toText,
} from "@/lib/legacy/supabase";
import type {
  FinancialHistoryAction,
  FinancialHistoryEntry,
} from "@/types/compras";

const TABLE_NAME = "financial_history";

function normalizeEntry(row: Record<string, unknown>): FinancialHistoryEntry {
  return {
    id: toText(row.id),
    financeType: (toText(row.finance_type, "pagar") ??
      "pagar") as FinancialHistoryEntry["financeType"],
    financeId: toText(row.finance_id),
    action: (toText(row.action, "editado") ??
      "editado") as FinancialHistoryAction,
    title: toText(row.title),
    description: toText(row.description),
    bankAccountName: toText(row.bank_account_name),
    reconciliationEntryId: toText(row.reconciliation_entry_id),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    createdBy: toText(row.created_by),
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
  const supabase = getLegacySupabase();
  const id = createLegacyId();

  const { error } = await supabase.from(TABLE_NAME).insert({
    id,
    finance_type: input.financeType,
    finance_id: input.financeId,
    action: input.action,
    title: input.title,
    description: input.description ?? "",
    bank_account_name: input.bankAccountName ?? "",
    reconciliation_entry_id: input.reconciliationEntryId ?? "",
    created_by: input.createdBy ?? "",
  });

  assertSupabaseSuccess(error, "Nao foi possivel registrar o historico financeiro");
  return id;
}

export async function listFinancialHistory(params: {
  financeType: "pagar" | "receber";
  financeId: string;
}) {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("finance_type", params.financeType)
    .eq("finance_id", params.financeId)
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar o historico financeiro");
  return (data ?? []).map((row) => normalizeEntry(row as Record<string, unknown>));
}

export async function listAllFinancialHistory() {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar a auditoria financeira");
  return (data ?? []).map((row) => normalizeEntry(row as Record<string, unknown>));
}
