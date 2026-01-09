// src/lib/stock/moveStock.ts
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const StockMovementSchema = z.object({
  establishment_id: z.string().uuid("Invalid establishment_id (uuid)."),
  product_id: z.string().uuid("Invalid product_id (uuid)."),
  unit_label: z.string().min(1, "unit_label is required.").max(30),
  qty_delta: z.coerce
    .number()
    .finite()
    .refine((n) => n !== 0, "qty_delta cannot be 0."),
  reason: z
    .string()
    .min(1, "reason is required.")
    .max(60)
    .optional()
    .default("adjustment"),
  source: z
    .string()
    .min(1, "source is required.")
    .max(60)
    .optional()
    .default("api"),
});

export type StockMovementInput = z.infer<typeof StockMovementSchema>;

export type MoveStockResult = {
  ok: true;
  movement?: any;
  stock_balance?: any;
};

function looksLikeUuidButHasNonHexChars(v: string) {
  // UUID deve ser hex (0-9a-f) com hífens. Se tiver "o" por exemplo, cai aqui.
  return /^[0-9a-fA-F-]{36}$/.test(v) === false && v.includes("-");
}

/**
 * Em alguns ambientes, você pode ainda não ter criado a tabela stock_movements
 * (ou a RLS pode bloquear). Nesses casos, não queremos impedir o update do saldo via RPC.
 */
function isMissingTableError(err: any) {
  // Postgres undefined_table = 42P01
  const code = (err as any)?.code;
  const msg = String((err as any)?.message ?? "");
  return code === "42P01" || msg.toLowerCase().includes("does not exist");
}

export async function moveStock(
  supabase: SupabaseClient,
  rawInput: unknown
): Promise<MoveStockResult> {
  // Log estratégico para validar payload real (sem expor tudo)
  console.log(
    "[moveStock] rawInput keys:",
    rawInput && typeof rawInput === "object"
      ? Object.keys(rawInput as any)
      : typeof rawInput
  );

  let input: StockMovementInput;

  try {
    input = StockMovementSchema.parse(rawInput);
  } catch (e: any) {
    // Melhora diagnóstico de UUID inválido (caso clássico 0 vs o)
    const est = (rawInput as any)?.establishment_id;
    const prod = (rawInput as any)?.product_id;

    if (typeof est === "string" && looksLikeUuidButHasNonHexChars(est)) {
      console.error("[moveStock] establishment_id suspeito (não-hex):", est);
    }
    if (typeof prod === "string" && looksLikeUuidButHasNonHexChars(prod)) {
      console.error("[moveStock] product_id suspeito (não-hex):", prod);
    }

    // mantém a mensagem do zod como erro principal
    throw e;
  }

  console.log("[moveStock] parsed:", {
    establishment_id: input.establishment_id,
    product_id: input.product_id,
    unit_label: input.unit_label,
    qty_delta: input.qty_delta,
    reason: input.reason,
    source: input.source,
  });

  // 1) grava o movimento (se você tiver a tabela stock_movements)
  // MELHORIA: se não existir tabela / ou der RLS, não derruba o fluxo do saldo via RPC
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

  if (movementError) {
    // Loga e continua (prioridade é atualizar saldo)
    console.error("[moveStock] movement insert error:", movementError);

    // Se não for "tabela inexistente", pode ser RLS/perm ou outro problema.
    // Ainda assim, seguimos com RPC — porque o saldo é o que importa.
    // Se você quiser “hard fail” nesses casos, eu te devolvo a versão estrita.
    if (!isMissingTableError(movementError)) {
      // apenas segue (não dá throw aqui)
    }
  } else {
    movement = movementData;
  }

  // 2) atualiza saldo via função (RPC)
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
    console.error("[moveStock] rpc error:", rpcError);
    throw new Error(rpcError.message);
  }

  return { ok: true, movement, stock_balance };
}
