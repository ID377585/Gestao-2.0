"use client";

import { buildCreatedByLabel, getCurrentUserInfo } from "@/lib/auth/current-user";

export async function buildReceiptResponsible() {
  const currentUser = await getCurrentUserInfo();

  return {
    responsavelId: currentUser?.id || "unknown",
    responsavelNome:
      buildCreatedByLabel(currentUser) || "Usuário não identificado",
  };
}