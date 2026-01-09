// src/app/(dashboard)/dashboard/actions/stock-movements.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { moveStock, type StockMovementInput } from "@/lib/stock/moveStock";

export async function createStockMovementAction(
  input: Omit<StockMovementInput, "establishment_id"> & {
    establishment_id?: string;
  }
) {
  // ✅ precisa do supabase server client (cookie/session)
  const supabase = await createSupabaseServerClient();

  // ✅ establishment do usuário logado
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id as
    | string
    | undefined;

  if (!establishmentId) {
    console.error("[createStockMovementAction] membership recebido:", membership);
    throw new Error("Estabelecimento não encontrado para o usuário atual.");
  }

  // ✅ Força establishment do usuário logado (evita spoof via client)
  const payload: StockMovementInput = {
    establishment_id: establishmentId,
    product_id: (input as any).product_id,
    unit_label: (input as any).unit_label,
    qty_delta: (input as any).qty_delta,
    reason: (input as any).reason ?? "adjustment",
    source: (input as any).source ?? "server_action",
  };

  // Log estratégico (sem expor dados demais)
  console.log("[createStockMovementAction] payload:", {
    establishment_id: payload.establishment_id,
    product_id: payload.product_id,
    unit_label: payload.unit_label,
    qty_delta: payload.qty_delta,
    reason: payload.reason,
    source: payload.source,
  });

  return moveStock(supabase as any, payload);
}
