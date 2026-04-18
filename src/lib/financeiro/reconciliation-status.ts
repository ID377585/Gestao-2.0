import { listBankReconciliationEntries } from "@/lib/financeiro/bank-reconciliation";
import type { BankReconciliationEntry } from "@/types/compras";

export type FinancialBankStatus = {
  bankConciliated: boolean;
  bankAccountName: string;
  matchedAt: string;
  reconciliationEntryId: string;
};

function buildStatus(entry?: BankReconciliationEntry): FinancialBankStatus {
  if (!entry) {
    return {
      bankConciliated: false,
      bankAccountName: "",
      matchedAt: "",
      reconciliationEntryId: "",
    };
  }

  return {
    bankConciliated: Boolean(entry.conciliado),
    bankAccountName: entry.bankAccountName ?? "",
    matchedAt: entry.matchedAt ?? "",
    reconciliationEntryId: entry.id,
  };
}

export async function getBankStatusMap(params: {
  financeType: "pagar" | "receber";
}) {
  const entries = await listBankReconciliationEntries();

  const filtered = entries.filter(
    (entry) => entry.matchedFinanceType === params.financeType && entry.matchedFinanceId
  );

  const map = new Map<string, FinancialBankStatus>();

  for (const entry of filtered) {
    map.set(entry.matchedFinanceId as string, buildStatus(entry));
  }

  return map;
}