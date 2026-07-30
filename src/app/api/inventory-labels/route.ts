// src/app/api/inventory-labels/route.ts
import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  getIdempotencyKeyFromRequest,
  runIdempotentAction,
} from "@/lib/idempotency/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

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

async function resolveTenantContext(): Promise<{
  establishmentId: string | null;
  userId: string | null;
  debug: string[];
}> {
  try {
    const { user, tenant } = await getAuthenticatedTenantUserOrThrow();

    return {
      establishmentId: tenant.establishmentId,
      userId: user.id,
      debug: [`current-tenant: ok (est=${tenant.establishmentId})`],
    };
  } catch (error: any) {
    return {
      establishmentId: null,
      userId: null,
      debug: [`current-tenant: falhou (${error?.message ?? "sem mensagem"})`],
    };
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { establishmentId } = await resolveTenantContext();

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
  const limited = rateLimit(req, {
    key: "inventory-labels-create",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const supabase = createSupabaseAdminClient();
  const { establishmentId, userId, debug } = await resolveTenantContext();

  if (!establishmentId || !userId) {
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

  let data: unknown = null;
  let error: unknown = null;
  let replayed = false;

  try {
    const result = await runIdempotentAction({
      key: getIdempotencyKeyFromRequest(req, body),
      operation: "inventory_labels.create",
      userId,
      establishmentId,
      payload: {
        productId,
        labelCode,
        unitLabel,
        qty,
        labelType,
        notes,
      },
      execute: async () => {
        const { data: created, error: createError } = await supabase
          .rpc("create_inventory_label", {
            p_establishment_id: establishmentId,
            p_product_id: productId,
            p_label_code: labelCode,
            p_qty: qty,
            p_unit_label: unitLabel,
            p_notes: notes,
            p_label_type: labelType,
            p_user_id: userId,
          })
          .single();

        if (createError) throw createError;
        return created;
      },
    });

    data = result.value;
    replayed = result.replayed;
  } catch (createError: any) {
    error = createError;
  }

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

  return NextResponse.json(data as InventoryLabelRow, {
    status: replayed ? 200 : 201,
    headers: replayed ? { "Idempotency-Replayed": "true" } : undefined,
  });
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
  const limited = rateLimit(req, {
    key: "inventory-labels-patch",
    limit: 90,
    windowMs: 60_000,
  });
  if (limited) return limited;

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
