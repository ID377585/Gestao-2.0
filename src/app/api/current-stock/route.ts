// src/app/api/current-stock/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveEstablishmentIdOrThrow } from "@/lib/tenant/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    let establishmentId: string;

    try {
      establishmentId = await getActiveEstablishmentIdOrThrow();
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message ?? "Não foi possível identificar o estabelecimento do usuário." },
        { status: 403 }
      );
    }

    // ✅ Lê da VIEW current_stock + join em products para devolver name
    const { data, error } = await supabase
      .from("current_stock")
      .select(
        `
        establishment_id,
        product_id,
        unit_label,
        qty_balance,
        products:products ( id, name, unit, category )
      `
      )
      .eq("establishment_id", establishmentId)
      .order("qty_balance", { ascending: false });

    if (error) {
      console.error("GET /api/current-stock erro:", error);
      return NextResponse.json(
        {
          error: `Erro ao carregar estoque atual: ${error.message}`,
          code: (error as any)?.code ?? null,
          details: (error as any)?.details ?? null,
          hint: (error as any)?.hint ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (err: any) {
    console.error("GET /api/current-stock erro inesperado:", err);
    return NextResponse.json(
      { error: `Erro inesperado ao carregar estoque: ${err?.message ?? "sem mensagem"}` },
      { status: 500 }
    );
  }
}
