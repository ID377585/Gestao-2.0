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

function normalizeLabelType(value: any): "MANIPULACAO" | "FABRICANTE" | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Remove acentos e normaliza para comparação
  const cleaned = raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (cleaned === "MANIPULACAO" || cleaned === "MANIPULACAO ") return "MANIPULACAO";
  if (cleaned === "FABRICANTE") return "FABRICANTE";

  // Compat com possíveis variações de frontend
  if (cleaned === "MANIPULACAO" || cleaned === "MANIPULACAO_PADRAO") return "MANIPULACAO";
  return null;
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
        debug
      );
      return NextResponse.json(
        {
          error: "Não foi possível identificar o estabelecimento do usuário.",
          debug,
        },
        { status: 403 }
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
        { status: 500 }
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
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory-labels
 * Cria uma etiqueta no banco
 * ✅ e (NOVO) gera entrada automática no estoque para MANIPULACAO e FABRICANTE
 */
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const { establishmentId, debug } = await resolveEstablishmentId(supabase);
    if (!establishmentId) {
      console.error(
        "POST /api/inventory-labels: establishmentId não resolvido",
        debug
      );
      return NextResponse.json(
        {
          error: "Não foi possível identificar o estabelecimento do usuário.",
          debug,
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    // ✅ product_id obrigatório
    const product_id =
      normalizeId(body?.productId ?? body?.product_id ?? "") ?? "";

    // Compat: aceita camelCase e snake_case
    const productName = String(
      body?.productName ?? body?.product_name ?? ""
    ).trim();

    const qty = Number(body?.qty);

    const unit_label = String(
      body?.unitLabel ?? body?.unit_label ?? body?.unit ?? ""
    ).trim();

    const label_code = String(
      body?.labelCode ?? body?.label_code ?? body?.code ?? ""
    ).trim();

    // ✅ NOVO: tipo da etiqueta (MANIPULACAO ou FABRICANTE)
    const label_type = normalizeLabelType(
      body?.labelType ?? body?.label_type ?? body?.type ?? body?.tipo
    );

    const notes =
      body?.extraPayload !== undefined && body?.extraPayload !== null
        ? JSON.stringify(body.extraPayload)
        : body?.notes !== undefined
        ? String(body.notes)
        : null;

    // ✅ validação mínima (mantida)
    if (!product_id) {
      return NextResponse.json(
        {
          error:
            "Payload inválido para criar etiqueta: productId/product_id é obrigatório.",
          debug_payload: {
            product_id,
            productName,
            qty,
            unit_label,
            label_code,
            label_type,
            received_keys: Object.keys(body ?? {}),
          },
        },
        { status: 400 }
      );
    }

    if (!unit_label || !label_code || !Number.isFinite(qty)) {
      return NextResponse.json(
        {
          error: "Payload inválido para criar etiqueta.",
          debug_payload: {
            product_id,
            productName,
            qty,
            unit_label,
            label_code,
            label_type,
            received_keys: Object.keys(body ?? {}),
          },
        },
        { status: 400 }
      );
    }

    // ✅ NOVO: como agora é regra de negócio obrigatória (MANIPULACAO e FABRICANTE),
    // exigimos o tipo para garantir a automação corretamente.
    if (!label_type) {
      return NextResponse.json(
        {
          error:
            "Payload inválido para criar etiqueta: labelType/type/tipo é obrigatório e deve ser MANIPULACAO ou FABRICANTE.",
          debug_payload: {
            product_id,
            productName,
            qty,
            unit_label,
            label_code,
            label_type,
            received_keys: Object.keys(body ?? {}),
          },
        },
        { status: 400 }
      );
    }

    // 1) cria a etiqueta
    const { data: insertedLabel, error: labelErr } = await supabase
      .from("inventory_labels")
      .insert({
        establishment_id: establishmentId,
        product_id,
        qty,
        unit_label,
        label_code,
        notes,
        // ✅ NOVO: grava o tipo se sua tabela inventory_labels tiver essa coluna.
        // Se sua tabela AINDA não tem a coluna "type", comente as 2 linhas abaixo.
        type: label_type,
      })
      .select("id, type, establishment_id, product_id, qty, unit_label")
      .maybeSingle();

    if (labelErr) {
      console.error("POST /api/inventory-labels erro:", labelErr);
      return NextResponse.json(
        {
          error: `Erro ao salvar etiqueta no banco: ${labelErr.message}`,
          code: (labelErr as any)?.code ?? null,
          details: (labelErr as any)?.details ?? null,
          hint: (labelErr as any)?.hint ?? null,
          debug,
          debug_payload: {
            establishment_id: establishmentId,
            product_id,
            productName,
            qty,
            unit_label,
            label_code,
            label_type,
            received_keys: Object.keys(body ?? {}),
          },
        },
        { status: 500 }
      );
    }

    const labelId = insertedLabel?.id ?? null;

    // Segurança: se por algum motivo não retornou id
    if (!labelId) {
      return NextResponse.json(
        { error: "Etiqueta criada, mas não foi possível obter o ID." },
        { status: 500 }
      );
    }

    // 2) ✅ NOVO: cria movimento de ENTRADA no estoque para MANIPULACAO e FABRICANTE
    const reason =
      label_type === "MANIPULACAO"
        ? "entrada_por_etiqueta_manipulacao"
        : "entrada_por_etiqueta_fabricante";

    const { error: mvErr } = await supabase.from("inventory_movements").insert({
      establishment_id: establishmentId,
      product_id,
      unit_label,
      qty_delta: qty, // ENTRADA
      reason,
      source: "inventory_label",
      label_id: labelId,
    });

    if (mvErr) {
      // ✅ rollback: apaga a etiqueta para não ficar "etiqueta sem estoque"
      console.error(
        "POST /api/inventory-labels: falha ao criar movimento de estoque. Fazendo rollback da etiqueta.",
        mvErr
      );

      const { error: rbErr } = await supabase
        .from("inventory_labels")
        .delete()
        .eq("id", labelId);

      if (rbErr) {
        console.error(
          "POST /api/inventory-labels: rollback falhou (etiqueta pode ter ficado gravada sem movimento).",
          rbErr
        );
      }

      return NextResponse.json(
        {
          error:
            "Falha ao gerar entrada automática no estoque (etiqueta revertida).",
          details: mvErr.message,
          code: (mvErr as any)?.code ?? null,
          hint: (mvErr as any)?.hint ?? null,
          debug,
          debug_payload: {
            establishment_id: establishmentId,
            product_id,
            productName,
            qty,
            unit_label,
            label_code,
            label_type,
            label_id: labelId,
            received_keys: Object.keys(body ?? {}),
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, id: labelId },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("POST /api/inventory-labels erro inesperado:", err);
    return NextResponse.json(
      {
        error: `Erro inesperado ao salvar etiqueta: ${
          err?.message ?? "sem mensagem"
        }`,
      },
      { status: 500 }
    );
  }
}
