// src/app/api/transferencias/stock/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") return null;
  return v;
}

async function resolveEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string | null> {
  // 1) helper do app
  try {
    const helperRes = await getActiveMembershipOrRedirect();
    const membership = (helperRes as any)?.membership ?? helperRes;

    const estId = normalizeId((membership as any)?.establishment_id);
    const orgId = normalizeId((membership as any)?.organization_id);
    return estId ?? orgId ?? null;
  } catch {}

  // 2) fallback memberships
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return null;

    const { data: m } = await supabase
      .from("memberships")
      .select("establishment_id, organization_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const estId = normalizeId((m as any)?.establishment_id);
    const orgId = normalizeId((m as any)?.organization_id);
    return estId ?? orgId ?? null;
  } catch {}

  return null;
}

function jsonError(message: string, status = 400, extra?: any) {
  return NextResponse.json({ error: message, ...(extra ? { details: extra } : {}) }, { status });
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const establishmentId = await resolveEstablishmentId(supabase);

    if (!establishmentId) {
      return jsonError("Não foi possível determinar o establishment_id do usuário logado.", 401);
    }

    const body = await request.json().catch(() => null);
    const product_id = normalizeId(body?.product_id);
    const unit_label = String(body?.unit_label ?? "").trim().toUpperCase();

    if (!product_id) return jsonError("product_id é obrigatório.");
    if (!unit_label) return jsonError("unit_label é obrigatório.");

    // View principal usada no app para saldo de estoque por unidade
    // (se não existir no seu banco, troque para `current_stock`)
    const { data, error } = await supabase
      .from("inventory_current_stock")
      .select("qty")
      .eq("establishment_id", establishmentId)
      .eq("product_id", product_id)
      .eq("unit_label", unit_label)
      .maybeSingle();

    if (error) {
      // fallback para outra view, caso seu projeto use `current_stock`
      const { data: data2, error: error2 } = await supabase
        .from("current_stock")
        .select("qty")
        .eq("establishment_id", establishmentId)
        .eq("product_id", product_id)
        .eq("unit_label", unit_label)
        .maybeSingle();

      if (error2) {
        return jsonError("Erro ao consultar saldo do estoque.", 500, { error, error2 });
      }

      const qty = Number(data2?.qty ?? 0);
      return NextResponse.json({ ok: true, available: Number.isFinite(qty) ? qty : 0 });
    }

    const qty = Number(data?.qty ?? 0);
    return NextResponse.json({ ok: true, available: Number.isFinite(qty) ? qty : 0 });
  } catch (e: any) {
    return NextResponse.json({ error: "Erro inesperado ao consultar saldo." }, { status: 500 });
  }
}
