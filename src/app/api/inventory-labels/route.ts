// src/app/api/inventory-labels/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

// ✅ NOVO: permite PATCH aqui também (evita 405 e mantém compatibilidade)
import { revalidateInventoryLabel } from "@/app/(dashboard)/dashboard/etiquetas/actions";

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
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null")
    return null;
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

  if (cleaned === "MANIPULACAO" || cleaned === "MANIPULACAO_PADRAO")
    return "MANIPULACAO";
  if (cleaned === "FABRICANTE" || cleaned === "REVALIDAR") return "FABRICANTE";
  return null;
}

/**
 * ✅ CRÍTICO: normaliza unidade em MAIÚSCULO para não violar
 * check constraint: stock_balances_unit_uppercase
 *
 * - trim
 * - remove espaços internos
 * - uppercase
 * - opcional: restringe para unidades comuns (mantém compatibilidade)
 */
function normalizeUnitLabel(input: any): string {
  const cleaned = String(input ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();

  // Se você quiser permitir qualquer texto, basta retornar cleaned.
  // Mantive lista curta para evitar lixo tipo "kg," ou "kgg".
  const ALLOWED = new Set(["UN", "KG", "G", "L", "ML"]);
  if (ALLOWED.has(cleaned)) return cleaned;

  // fallback seguro: ainda retorna uppercase sem espaços
  return cleaned;
}

async function resolveEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{
  establishmentId: string | null;
  userId: string | null;
  debug: string[];
}> {
  const debug: string[] = [];

  try {
    const helperRes = await getActiveMembershipOrRedirect();
    const membership = (helperRes as any)?.membership ?? helperRes;

    const estId = normalizeId((membership as any)?.establishment_id);
    const orgId = normalizeId((membership as any)?.organization_id);
    const userId = normalizeId((membership as any)?.user_id);

    const picked = estId ?? orgId ?? null;
    debug.push(
      `membership-helper: ok (est=${estId ?? "null"} org=${orgId ?? "null"} user=${
        userId ?? "null"
      })`
    );

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
    debug.push(
      `fallback memberships: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`
    );
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
  debug.push(
    `fallback profiles: ok (est=${estId2 ?? "null"} org=${orgId2 ?? "null"})`
  );

  return { establishmentId: estId2 ?? orgId2 ?? null, userId, debug };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { establishmentId } = await resolveEstablishmentId(supabase);

  if (!establishmentId) {
    return NextResponse.json(
      { error: "Estabelecimento não encontrado no membership." },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("inventory_labels")
    .select(
      "id, label_code, qty, unit_label, notes, created_at, status, product_id"
    )
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as InventoryLabelRow[], { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { establishmentId, debug } = await resolveEstablishmentId(
    supabase
  );

  if (!establishmentId) {
    return NextResponse.json(
      { error: "Estabelecimento não encontrado no membership.", debug },
      { status: 401 }
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido (JSON)." }, { status: 400 });
  }

  const productId = normalizeId(body?.productId ?? body?.product_id);
  const labelCode = String(body?.labelCode ?? body?.label_code ?? "").trim();

  // ✅ FIX: unidade em UPPERCASE (evita violar stock_balances_unit_uppercase)
  const unitLabelRaw = body?.unitLabel ?? body?.unit_label ?? "";
  const unitLabel = normalizeUnitLabel(unitLabelRaw);

  const qty = Number(body?.qty);

  const labelType = normalizeLabelType(
    body?.labelType ?? body?.label_type ?? body?.type
  );

  const notes =
    body?.notes != null
      ? String(body.notes)
      : body?.extraPayload != null
      ? JSON.stringify(body.extraPayload)
      : null;

  if (!productId)
    return NextResponse.json(
      { error: "productId obrigatório." },
      { status: 400 }
    );
  if (!labelCode)
    return NextResponse.json(
      { error: "labelCode obrigatório." },
      { status: 400 }
    );
  if (!unitLabel)
    return NextResponse.json(
      { error: "unitLabel obrigatório." },
      { status: 400 }
    );
  if (!qty || qty <= 0)
    return NextResponse.json({ error: "qty inválido." }, { status: 400 });

  const { data, error } = await supabase
    .rpc("create_inventory_label", {
      p_establishment_id: establishmentId,
      p_product_id: productId,
      p_label_code: labelCode,
      p_qty: qty,
      p_unit_label: unitLabel,
      p_notes: notes,
      p_label_type: labelType,
    })
    .single();

  // erros comuns
  if ((error as any)?.code === "23505") {
    return NextResponse.json(
      {
        error:
          "Já existe uma etiqueta com este código/lote. Verifique o lote ou a UNIQUE constraint.",
      },
      { status: 409 }
    );
  }

  if (error || !data) {
    return NextResponse.json(
      {
        error: (error as any)?.message ?? "Falha ao salvar etiqueta no banco.",
        code: (error as any)?.code ?? null,
        details: (error as any)?.details ?? null,
        hint: (error as any)?.hint ?? null,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(data as InventoryLabelRow, { status: 201 });
}

/**
 * ✅ NOVO: PATCH (compatibilidade)
 * - Aceita PATCH em /api/inventory-labels para NÃO retornar 405
 * - Faz a revalidação chamando a server action (fonte de verdade)
 *
 * Body esperado:
 * { labelId: string, newNotes: any }
 */
export async function PATCH(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido (JSON)." }, { status: 400 });
  }

  const labelId = normalizeId(body?.labelId);
  const newNotes = body?.newNotes ?? null;

  if (!labelId) {
    return NextResponse.json(
      { error: "labelId obrigatório." },
      { status: 400 }
    );
  }

  try {
    const updated = await revalidateInventoryLabel({ labelId, newNotes });
    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Falha ao revalidar etiqueta." },
      { status: 500 }
    );
  }
}
