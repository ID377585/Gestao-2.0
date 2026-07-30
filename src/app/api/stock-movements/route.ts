// src/app/api/stock-movements/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getIdempotencyKeyFromRequest,
  runIdempotentAction,
} from "@/lib/idempotency/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { moveStock, type StockMovementInput } from "@/lib/stock/moveStock";
import { assertActiveTenantRole } from "@/lib/tenant/guards";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, {
      key: "stock-movements",
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    let tenant: Awaited<ReturnType<typeof assertActiveTenantRole>>;

    try {
      tenant = await assertActiveTenantRole(["admin", "operacao", "estoque"]);
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "Sem permissão para movimentar estoque." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Partial<StockMovementInput>;

    const supabase = await createSupabaseServerClient();
    const requestedEstablishmentId = String(body.establishment_id ?? "").trim();

    if (
      requestedEstablishmentId &&
      requestedEstablishmentId !== tenant.establishmentId
    ) {
      return NextResponse.json(
        { ok: false, error: "Estabelecimento inválido para a empresa ativa." },
        { status: 403 }
      );
    }

    if (!body.product_id) {
      return NextResponse.json(
        { ok: false, error: "product_id obrigatório." },
        { status: 400 }
      );
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", body.product_id)
      .eq("establishment_id", tenant.establishmentId)
      .maybeSingle();

    if (productError) {
      console.error("[POST /api/stock-movements] product validation error:", productError);
      return NextResponse.json(
        { ok: false, error: "Não foi possível validar o produto." },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "Produto não pertence à empresa ativa." },
        { status: 403 }
      );
    }

    const { value: result, replayed } = await runIdempotentAction({
      key: getIdempotencyKeyFromRequest(req, body as Record<string, unknown>),
      operation: "stock.movements.create",
      userId: tenant.userId,
      establishmentId: tenant.establishmentId,
      payload: {
        ...body,
        establishment_id: tenant.establishmentId,
      },
      execute: () =>
        moveStock(supabase as any, {
          ...body,
          establishment_id: tenant.establishmentId,
        }),
    });

    return NextResponse.json(result, {
      status: 200,
      headers: replayed ? { "Idempotency-Replayed": "true" } : undefined,
    });
  } catch (err: any) {
    const message = err?.message ? String(err.message) : "Unknown error";
    console.error("[POST /api/stock-movements] error:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
