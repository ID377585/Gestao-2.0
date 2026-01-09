// src/app/(dashboard)/dashboard/actions/stock-movements.ts
"use server";

import { moveStock, type StockMovementInput } from "@/lib/stock/moveStock";

export async function createStockMovementAction(input: StockMovementInput) {
  // aqui você pode:
  // - adicionar auditoria por usuário (auth.uid)
  // - validar role/membership
  // - normalizar source padrão etc.
  return moveStock(input);
}
