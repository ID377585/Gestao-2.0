// src/app/api/stock-movements/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { moveStock, type StockMovementInput } from "@/lib/stock/moveStock";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<StockMovementInput>;

    // ✅ MELHORIA: precisa ser await (createSupabaseServerClient costuma ser async)
    const supabase = await createSupabaseServerClient();

    // Log estratégico para ver payload real que chega na API
    console.log("[POST /api/stock-movements] body:", body);

    const result = await moveStock(supabase as any, body);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    const message = err?.message ? String(err.message) : "Unknown error";
    console.error("[POST /api/stock-movements] error:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
