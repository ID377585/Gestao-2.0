// src/app/api/transferencias/stock/create/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") return null;
  return v;
}

function jsonError(message: string, status = 400, extra?: any) {
  return NextResponse.json({ error: message, ...(extra ? { details: extra } : {}) }, { status });
}

/**
 * Rota "create" (placeholder por enquanto).
 * IMPORTANTÍSSIMO: aqui NÃO pode ter JSX/React.
 *
 * Depois vamos implementar a criação real da transferência (OUT/IN no inventory_movements).
 */
export async function POST(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "stock-transfer-create",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    await getAuthenticatedTenantUserOrThrow();
    await createSupabaseServerClient(); // garante sessão server ok

    return NextResponse.json(
      {
        ok: false,
        message:
          "Endpoint de criação ainda não implementado. (Build OK) - Em seguida implementamos a gravação da transferência.",
      },
      { status: 501 },
    );
  } catch (e: any) {
    return jsonError("Não autorizado ou erro inesperado.", 401);
  }
}
