"use client";

import { useCallback } from "react";
import {
  buildCreatedByLabel,
  getCurrentUserInfo,
} from "@/lib/auth/current-user";
import { createPurchaseHistoryEntry } from "@/lib/compras/purchase-history";
import type {
  PurchaseHistoryAction,
  PurchaseHistoryEntityType,
} from "@/types/compras";

export function usePurchaseHistory() {
  const createEntry = useCallback(
    async (input: {
      entityType: PurchaseHistoryEntityType;
      entityId: string;
      action: PurchaseHistoryAction;
      title: string;
      description?: string;
      relatedEntityType?: PurchaseHistoryEntityType;
      relatedEntityId?: string;
    }) => {
      const currentUser = await getCurrentUserInfo();
      const createdBy = buildCreatedByLabel(currentUser);

      await createPurchaseHistoryEntry({
        ...input,
        createdBy,
      });
    },
    []
  );

  return {
    createPurchaseHistoryEntryWithUser: createEntry,
  };
}