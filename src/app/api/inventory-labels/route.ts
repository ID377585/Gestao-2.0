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
  status?: string;
  product_id?: string | null;
};

function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") return null;
  return v;
}

function normalizeLabelType(value: any): "MANIPULACAO" | "FABRICANTE" | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const cleaned = raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (cleaned === "MANIPULACAO" || cleaned === "MANIPULACAO_PADRAO") return "MANIPULACAO";
  if (cleaned === "FABRICANTE" || cleaned === "REVALIDAR") return "FABRICANTE";
  return null;
}

function isMissingTypeColumnError(err: any): boolean {
  const code = String(err?.code ?? "").toUpperCase();
  const msg = String(err?.message ?? "").toLowerCase();
  const details = String(err?.details ?? "").toLowerCase();
  const hint = String(err?.hint ?? "").toLowerCase();

  if (code === "PGRST204" || code === "42703") return true;

  const blob = `${msg} ${details} ${hint}`;
  if (blob.includes("schema cache") && blob.includes("'type'")) return true;
  if (blob.includes("could not find the 'type' column")) return true;
  if (blob.includes("column") && blob.includes("type") && blob.includes("does not exist")) return true;

  return false;
}

async function resolveEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ establishmentId: string | null; userId: string | null; debug: string[] }> {
  const debug: string[] = [];

  try {
    const helperRes = await getActiveMembershipOrRedirect();
    const membership = (helperRes as any)?.membership ?? helperRes;

    const estId = normalizeId((membership as any)?.establishment_id);
    const orgId = normalizeId((membership as any)?.organization_id);
    const userId = normalizeId((membership as any)?.user_id);

    const picked = estId ?? orgId ?? null;
    debug.push(`membership-helper: ok (est=${estId ?? "null"} org=${orgId ?? "null"} user=${userId ?? "null"})`);

    return { establishmentId: picked, userId, debug };
  } catch (e: any) {
    debug.push(`membership-helper: falhou (${e?.message ?? "sem mensagem"})`);
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userId = normalizeId(userData?.user?.id);

  if (userErr) debug.push(`auth.getUser: erro (${userErr.message})`);
  if (!userId) {
    debug.push("auth.getUser: sem userId");
    return { establishmentId: null, userId: null, debug };
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
    debug.push(`fallback memberships: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`);
    return { establishmentId: estId ?? orgId ?? null, userId, debug };
  }

  const { data: p, error: pErr } = await supabase
    .from("profiles")
    .select("establishment_id, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (pErr) debug.push(`fallback profiles: erro (${pErr.message})`);

  const estId2 = normalizeId((p as any)?.establishment_id);
  const orgId2 = normalizeId((p as any)?.organization_id);
  debug.push(`fallback profiles: ok (est=${estId2 ?? "null"} org=${orgId2 ?? "null"})`);

  return { establishmentId: estId2 ?? orgId2 ?? null, userId, debug };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { establishmentId } = await resolveEstablishmentId(supabase);

  if (!establishmentId) {
    return NextResponse.json({ error: "Estabelecimento não encontrado no membership." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("inventory_labels")
    .select("id, label_code, qty, unit_label, notes, created_at, status, product_id")
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as InventoryLabelRow[], { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { establishmentId, userId, debug } = await resolveEstablishmentId(supabase);

  if (!establishmentId) {
    return NextResponse.json({ error: "Estabelecimento não encontrado no membership.", debug }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido (JSON)." }, { status: 400 });
  }

  const productId = normalizeId(body?.productId ?? body?.product_id);
  const labelCode = String(body?.labelCode ?? body?.label_code ?? "").trim();
  const unitLabel = String(body?.unitLabel ?? body?.unit_label ?? "").trim();
  const qty = Number(body?.qty);

  const labelType = normalizeLabelType(body?.labelType ?? body?.label_type ?? body?.type);

  const notes =
    body?.notes != null
      ? String(body.notes)
      : body?.extraPayload != null
        ? JSON.stringify(body.extraPayload)
        : null;

  if (!productId) return NextResponse.json({ error: "productId obrigatório." }, { status: 400 });
  if (!labelCode) return NextResponse.json({ error: "labelCode obrigatório." }, { status: 400 });
  if (!unitLabel) return NextResponse.json({ error: "unitLabel obrigatório." }, { status: 400 });
  if (!qty || qty <= 0) return NextResponse.json({ error: "qty inválido." }, { status: 400 });

  // tentativa 1: com coluna `type` (se existir no schema)
  const insertBase: any = {
    establishment_id: establishmentId,
    product_id: productId, // ✅ ESSENCIAL para atualizar Estoque Atual via triggers/saldos
    label_code: labelCode,
    qty,
    unit_label: unitLabel,
    status: "available",
    created_by: userId,
    notes,
  };

  const insertWithType: any = labelType ? { ...insertBase, type: labelType } : insertBase;

  const { data: created1, error: err1 } = await supabase
    .from("inventory_labels")
    .insert(insertWithType)
    .select("id, label_code, qty, unit_label, notes, created_at, status, product_id")
    .single();

  if (!err1 && created1) {
    return NextResponse.json(created1 as InventoryLabelRow, { status: 201 });
  }

  // fallback: se não existir coluna `type`, tenta sem ela
  if (isMissingTypeColumnError(err1)) {
    const { data: created2, error: err2 } = await supabase
      .from("inventory_labels")
      .insert(insertBase)
      .select("id, label_code, qty, unit_label, notes, created_at, status, product_id")
      .single();

    if (err2 || !created2) {
      const msg = (err2 as any)?.message ?? "Falha ao salvar etiqueta no banco (insert).";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json(created2 as InventoryLabelRow, { status: 201 });
  }

  // erros comuns
  if ((err1 as any)?.code === "23505") {
    return NextResponse.json(
      { error: "Já existe uma etiqueta com este código/lote. Verifique o lote ou a UNIQUE constraint." },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { error: (err1 as any)?.message ?? "Falha ao salvar etiqueta no banco (insert)." },
    { status: 500 }
  );
}
