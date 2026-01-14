// src/lib/stock/moveStock.ts
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const StockMovementSchema = z.object({
  establishment_id: z.string().uuid("Invalid establishment_id (uuid)."),
  product_id: z.string().uuid("Invalid product_id (uuid)."),
  unit_label: z.string().min(1).max(30),
  qty_delta: z.coerce
    .number()
    .finite()
    .refine((n) => n !== 0, "qty_delta cannot be 0."),
  reason: z.string().min(1).max(60).optional().default("adjustment"),
  source: z.string().min(1).max(60).optional().default("api"),
});

export type StockMovementInput = z.infer<typeof StockMovementSchema>;

export type MoveStockResult = {
  ok: true;
  movement?: any;
  stock_balance?: any;
};

function looksLikeUuidButHasNonHexChars(v: string) {
  return /^[0-9a-fA-F-]{36}$/.test(v) === false && v.includes("-");
}

function isMissingTableError(err: any) {
  const code = err?.code;
  const msg = String(err?.message ?? "");
  return code === "42P01" || msg.toLowerCase().includes("does not exist");
}

/**
 * 🔥 FUNÇÃO CENTRAL DE MOVIMENTAÇÃO DE ESTOQUE
 * ÚNICA fonte de verdade do saldo
 */
export async function moveStock(
  supabase: SupabaseClient,
  rawInput: unknown
): Promise<MoveStockResult> {
  let input: StockMovementInput;

  try {
    input = StockMovementSchema.parse(rawInput);
  } catch (e) {
    throw e;
  }

  let movement: any = undefined;

  const { data: movementData, error: movementError } = await supabase
    .from("stock_movements")
    .insert({
      establishment_id: input.establishment_id,
      product_id: input.product_id,
      unit_label: input.unit_label,
      qty_delta: input.qty_delta,
      reason: input.reason,
      source: input.source,
    })
    .select("*")
    .single();

  if (!movementError) {
    movement = movementData;
  }

  const { data: stock_balance, error: rpcError } = await supabase.rpc(
    "fn_upsert_stock_balance",
    {
      p_establishment_id: input.establishment_id,
      p_product_id: input.product_id,
      p_qty_delta: input.qty_delta,
      p_unit_label: input.unit_label,
    }
  );

  if (rpcError) {
    throw new Error(rpcError.message);
  }

  return { ok: true, movement, stock_balance };
}
