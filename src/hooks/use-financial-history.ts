"use client";

import { useCallback } from "react";
import { getCurrentUserInfo, buildCreatedByLabel } from "@/lib/auth/current-user";
import { createFinancialHistoryEntry } from "@/lib/financeiro/financial-history";
import type { FinancialHistoryAction } from "@/types/compras";

export function useFinancialHistory() {
  const createEntry = useCallback(
    async (input: {
      financeType: "pagar" | "receber";
      financeId: string;
      action: FinancialHistoryAction;
      title: string;
      description?: string;
      bankAccountName?: string;
      reconciliationEntryId?: string;
    }) => {
      const user = await getCurrentUserInfo();
      const createdBy = buildCreatedByLabel(user);

      await createFinancialHistoryEntry({
        ...input,
        createdBy,
      });
    },
    []
  );

  return {
    createFinancialHistoryEntryWithUser: createEntry,
  };
}