// src/app/api/current-stock/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") {
    return null;
  }
  return v;
}

async function resolveEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ establishmentId: string | null; debug: string[] }> {
  const debug: string[] = [];

  // 1) helper do app
  try {
    const helperRes = await getActiveMembershipOrRedirect();
    const membership = (helperRes as any)?.membership ?? helperRes;

    const estId = normalizeId((membership as any)?.establishment_id);
    const orgId = normalizeId((membership as any)?.organization_id);
    const picked = estId ?? orgId ?? null;

    debug.push(
      `membership-helper: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`
    );

    return { establishmentId: picked, debug };
  } catch (e: any) {
    debug.push(`membership-helper: falhou (${e?.message ?? "sem mensagem"})`);
  }

  // 2) fallback: auth.getUser -> memberships -> profiles
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (userErr) debug.push(`auth.getUser: erro (${userErr.message})`);
  if (!userId) {
    debug.push("auth.getUser: sem userId");
    return { establishmentId: null, debug };
  }

  debug.push(`auth.getUser: ok (user=${userId})`);

  const { data: m, error: mErr } = await supabase
    .from("memberships")
    .select("establishment_id, organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (mErr) debug.push(`fallback memberships: erro (${mErr.message})`);

  const estId = normalizeId((m as any)?.establishment_id);
  const orgId = normalizeId((m as any)?.organization_id);

  if (estId ?? orgId) {
    debug.push(
      `fallback memberships: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`
    );
    return { establishmentId: estId ?? orgId ?? null, debug };
  }

  const { data: p, error: pErr } = await supabase
    .from("profiles")
    .select("establishment_id, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (pErr) debug.push(`fallback profiles: erro (${pErr.message})`);

  const estId2 = normalizeId((p as any)?.establishment_id);
  const orgId2 = normalizeId((p as any)?.organization_id);

  debug.push(
    `fallback profiles: ok (est=${estId2 ?? "null"} org=${orgId2 ?? "null"})`
  );

  return { establishmentId: estId2 ?? orgId2 ?? null, debug };
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { establishmentId, debug } = await resolveEstablishmentId(supabase);
    if (!establishmentId) {
      console.error("GET /api/current-stock: establishmentId não resolvido", debug);
      return NextResponse.json(
        {
          error: "Não foi possível identificar o estabelecimento do usuário.",
          debug,
        },
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
          debug,
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
