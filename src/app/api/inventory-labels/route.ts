// src/app/api/inventory-labels/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type InventoryLabelRow = {
  id: string;
  label_code: string;
  qty: number;
  unit_label: string;
  notes: string | null;
  created_at: string;
};

function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") {
    return null;
  }
  return v;
}

async function resolveEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
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
      `membership-helper: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`,
    );

    return { establishmentId: picked, debug };
  } catch (e: any) {
    debug.push(`membership-helper: falhou (${e?.message ?? "sem mensagem"})`);
    // segue fallback
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
      `fallback memberships: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`,
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
    `fallback profiles: ok (est=${estId2 ?? "null"} org=${orgId2 ?? "null"})`,
  );

  return { establishmentId: estId2 ?? orgId2 ?? null, debug };
}

/**
 * GET /api/inventory-labels
 * Lista histórico do estabelecimento
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { establishmentId, debug } = await resolveEstablishmentId(supabase);
    if (!establishmentId) {
      console.error(
        "GET /api/inventory-labels: establishmentId não resolvido",
        debug,
      );
      return NextResponse.json(
        {
          error: "Não foi possível identificar o estabelecimento do usuário.",
          debug,
        },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("inventory_labels")
      .select("id, label_code, qty, unit_label, notes, created_at")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/inventory-labels erro:", error);
      return NextResponse.json(
        {
          error: `Erro ao carregar histórico de etiquetas: ${error.message}`,
          code: (error as any)?.code ?? null,
          details: (error as any)?.details ?? null,
          hint: (error as any)?.hint ?? null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json((data ?? []) as InventoryLabelRow[], {
      status: 200,
    });
  } catch (err: any) {
    console.error("GET /api/inventory-labels erro inesperado:", err);
    return NextResponse.json(
      {
        error: `Erro inesperado ao carregar etiquetas: ${
          err?.message ?? "sem mensagem"
        }`,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/inventory-labels
 * Cria uma etiqueta no banco
 */
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const { establishmentId, debug } = await resolveEstablishmentId(supabase);
    if (!establishmentId) {
      console.error(
        "POST /api/inventory-labels: establishmentId não resolvido",
        debug,
      );
      return NextResponse.json(
        {
          error: "Não foi possível identificar o estabelecimento do usuário.",
          debug,
        },
        { status: 403 },
      );
    }

    const body = await req.json();

    const product_name = String(body?.productName ?? "").trim();
    const qty = Number(body?.qty);
    const unit_label = String(body?.unitLabel ?? "").trim();
    const label_code = String(body?.labelCode ?? "").trim();
    const notes =
      body?.extraPayload !== undefined && body?.extraPayload !== null
        ? JSON.stringify(body.extraPayload)
        : null;

    if (!product_name || !unit_label || !label_code || !Number.isFinite(qty)) {
      return NextResponse.json(
        { error: "Payload inválido para criar etiqueta." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("inventory_labels")
      .insert({
        establishment_id: establishmentId,
        product_name,
        qty,
        unit_label,
        label_code,
        notes,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("POST /api/inventory-labels erro:", error);
      return NextResponse.json(
        {
          error: `Erro ao salvar etiqueta no banco: ${error.message}`,
          code: (error as any)?.code ?? null,
          details: (error as any)?.details ?? null,
          hint: (error as any)?.hint ?? null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/inventory-labels erro inesperado:", err);
    return NextResponse.json(
      {
        error: `Erro inesperado ao salvar etiqueta: ${
          err?.message ?? "sem mensagem"
        }`,
      },
      { status: 500 },
    );
  }
}
