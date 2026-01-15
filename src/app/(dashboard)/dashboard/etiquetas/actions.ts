// 1) src/app/(dashboard)/dashboard/etiquetas/action.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { moveStock } from "@/lib/stock/moveStock";

/**
 * Linha bruta da tabela inventory_labels
 */
export type InventoryLabelRow = {
  id: string;
  label_code: string;
  qty: number;
  unit_label: string;
  status: string;
  created_at: string;
  notes: string | null;

  // campos extras usados na separação
  order_id?: string | null;
  separated_at?: string | null;
  separated_by?: string | null;
};

/**
 * Params vindos do formulário de etiquetas (lado client)
 * - productId: ID REAL do produto (obrigatório p/ estoque)
 * - productName: texto livre (mantido p/ histórico/visual)
 * - qty / unitLabel: quantidade e unidade
 * - labelCode: lote/código da etiqueta (label_code)
 * - extraPayload: objeto completo da etiqueta (JSON no notes)
 */
export type CreateInventoryLabelParams = {
  productId: string; // 🔥 NOVO (obrigatório)
  productName: string;
  qty: number;
  unitLabel: string;
  labelCode: string;
  extraPayload: any;
};

/**
 * ✅ NOVO: garante que existe um movimento de entrada (LABEL_IN) para a etiqueta
 * - Idempotente: se já existir, não duplica
 * - Fonte de verdade: inventory_movements (p/ view current_stock)
 */
async function ensureLabelInMovement(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  establishmentId: string;
  userId: string | null;
  label: {
    id: string;
    product_id: string | null;
    unit_label: string | null;
    qty: any;
    label_code?: string | null;
  };
}) {
  const { supabase, establishmentId, userId, label } = params;

  const qty = Number(label.qty ?? 0);
  const unit_label = String(label.unit_label ?? "").trim().toUpperCase();

  if (!label?.id) throw new Error("Etiqueta sem ID.");
  if (!label?.product_id) throw new Error("Etiqueta sem product_id.");
  if (!unit_label) throw new Error("Etiqueta sem unit_label.");
  if (!Number.isFinite(qty) || qty <= 0) return;

  // ✅ Idempotência: se já existe LABEL_IN para essa etiqueta, não duplica
  const { data: existing, error: exErr } = await supabase
    .from("inventory_movements")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("label_id", label.id)
    .eq("movement_type", "LABEL_IN")
    .maybeSingle();

  if (exErr) {
    console.error("Erro ao checar LABEL_IN existente:", exErr);
    throw new Error("Falha ao validar movimento de entrada da etiqueta.");
  }

  if (existing?.id) return;

  const { error: insErr } = await supabase.from("inventory_movements").insert({
    establishment_id: establishmentId,
    product_id: label.product_id,
    label_id: label.id,
    qty,
    unit_label,
    direction: "IN",
    movement_type: "LABEL_IN",
    reason: "LABEL_CREATED",
    created_by: userId,
    details: {
      label_code: label.label_code ?? null,
      from: "LABEL_CREATION",
    },
  });

  if (insErr) {
    console.error("Erro ao inserir LABEL_IN:", insErr);
    throw new Error("Falha ao registrar entrada da etiqueta no estoque.");
  }
}

/**
 * Salva UMA etiqueta na tabela inventory_labels
 * ✅ mantém histórico
 * ✅ mantém separação por QR
 * ✅ cria movimento de estoque automaticamente
 */
export async function createInventoryLabel(
  params: CreateInventoryLabelParams
): Promise<InventoryLabelRow> {
  const { productId, productName, qty, unitLabel, labelCode, extraPayload } =
    params;

  if (!productId?.trim()) throw new Error("Produto (ID) não informado.");
  if (!productName?.trim()) throw new Error("Produto não informado.");
  if (!qty || qty <= 0) throw new Error("Quantidade inválida.");
  if (!unitLabel?.trim()) throw new Error("Unidade não informada.");
  if (!labelCode?.trim()) throw new Error("Código/Lote da etiqueta vazio.");

  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any).establishment_id;

  // ✅ Preferir usuário autenticado (mais confiável que membership.user_id)
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const userId =
    (!authErr && authData?.user?.id ? authData.user.id : null) ??
    ((membership as any).user_id ?? null);

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  // =========================================================
  // 🔒 AJUSTE ESTRUTURAL (CRÍTICO)
  // Garante que o produto pertence ao mesmo establishment
  // =========================================================
  const { data: product, error: productErr } = await supabase
    .from("products")
    .select("id, establishment_id")
    .eq("id", productId)
    .maybeSingle();

  if (productErr || !product) {
    throw new Error("Produto não encontrado.");
  }

  if ((product as any).establishment_id !== establishmentId) {
    throw new Error("Produto não pertence ao estabelecimento atual.");
  }
  // =========================================================

  const notesJson =
    extraPayload != null
      ? JSON.stringify({
          ...extraPayload,
          productName, // preserva texto livre no histórico
        })
      : null;

  // ✅ NORMALIZA unidade (mantém padrão do resto do sistema)
  const normalizedUnit = String(unitLabel).trim().toUpperCase();

  /**
   * 1️⃣ CRIA A ETIQUETA
   */
  const { data: label, error: insertErr } = await supabase
    .from("inventory_labels")
    .insert({
      establishment_id: establishmentId,
      product_id: productId, // 🔥 AGORA VINCULADO
      label_code: labelCode,
      qty,
      unit_label: normalizedUnit, // ✅ NORMALIZA
      status: "available",
      order_id: null,
      separated_at: null,
      separated_by: null,
      created_by: userId,
      notes: notesJson,
    })
    .select("*")
    .single();

  if (insertErr || !label) {
    if ((insertErr as any)?.code === "23505") {
      throw new Error(
        "Já existe uma etiqueta com este código/lote. Verifique o lote."
      );
    }

    const msg =
      (insertErr as any)?.message ??
      "Falha ao salvar etiqueta no banco (insert).";
    throw new Error(msg);
  }

  /**
   * 2️⃣ MOVIMENTO DE ENTRADA DA ETIQUETA (LABEL_IN)
   * ✅ Garante que current_stock consiga refletir a entrada conforme convenção final
   * ✅ Idempotente
   */
  await ensureLabelInMovement({
    supabase,
    establishmentId,
    userId,
    label: {
      id: (label as any).id,
      product_id: (label as any).product_id ?? productId,
      unit_label: (label as any).unit_label ?? normalizedUnit,
      qty: (label as any).qty ?? qty,
      label_code: (label as any).label_code ?? labelCode,
    },
  });

  /**
   * 3️⃣ (MANTIDO) moveStock
   * ⚠️ IMPORTANTE:
   * - Se o seu moveStock também insere em inventory_movements, ele pode duplicar a entrada.
   * - Se você CONFIRMAR que moveStock não duplica (ex.: escreve em outra tabela),
   *   mantenha como está. Caso contrário, comente/remova este bloco.
   *
   * Como você reportou que não existia LABEL_IN, este bloco provavelmente não está
   * gerando movement_type='LABEL_IN'. Por isso deixamos o ensureLabelInMovement como
   * fonte de verdade.
   */
  await moveStock(supabase, {
    establishment_id: establishmentId,
    product_id: productId,
    unit_label: normalizedUnit,
    qty_delta: qty, // ➕ ENTRADA
    reason: "etiqueta_manipulacao",
    source: "inventory_labels",
  });

  return label as InventoryLabelRow;
}

/**
 * ✅ NOVO: Revalida UMA etiqueta existente
 * - Atualiza notes com novas datas (Manipulação/Vencimento)
 * - NÃO cria movimento
 * - NÃO move estoque
 */
export async function revalidateInventoryLabel(params: {
  labelId: string;
  newNotes: any;
}): Promise<InventoryLabelRow> {
  const { labelId, newNotes } = params;

  if (!labelId?.trim()) throw new Error("Etiqueta (ID) não informada.");

  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any).establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  // Busca a etiqueta (garante que é do estabelecimento e checa status)
  const { data: current, error: curErr } = await supabase
    .from("inventory_labels")
    .select("id, establishment_id, status, notes")
    .eq("id", labelId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (curErr || !current) throw new Error("Etiqueta não encontrada.");

  // (Opcional) bloqueia se já foi usada/separada
  if ((current as any).status !== "available") {
    throw new Error("Só é possível revalidar etiquetas com status 'available'.");
  }

  const notesJson = newNotes != null ? JSON.stringify(newNotes) : null;

  const { data: updated, error: upErr } = await supabase
    .from("inventory_labels")
    .update({
      notes: notesJson,
      // ⚠️ não mexe em qty/unit/status/order_id etc
    })
    .eq("id", labelId)
    .eq("establishment_id", establishmentId)
    .select("*")
    .single();

  if (upErr || !updated) {
    console.error("Erro ao revalidar etiqueta:", upErr);
    throw new Error("Falha ao revalidar etiqueta no banco.");
  }

  return updated as InventoryLabelRow;
}

/**
 * Lista as etiquetas já salvas no banco para o estabelecimento atual
 * (usado no client para montar o "Histórico de Etiquetas")
 */
export async function listInventoryLabels(): Promise<InventoryLabelRow[]> {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any).establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  const { data, error } = await supabase
    .from("inventory_labels")
    .select(
      "id, label_code, qty, unit_label, status, created_at, notes, order_id, separated_at, separated_by"
    )
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar inventory_labels:", error);
    throw new Error("Erro ao carregar etiquetas do banco.");
  }

  return (data ?? []) as InventoryLabelRow[];
}

/* ===========================================================
   Helpers para leitura do QR (INALTERADO)
   =========================================================== */

type ParsedLabelFromQr = {
  labelId: string | null;
  labelCode: string | null;
};

function parseLabelFromQr(raw: string): ParsedLabelFromQr {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return { labelId: null, labelCode: null };

  try {
    const obj = JSON.parse(cleaned) as any;

    const rawId = obj.label_id || obj.labelId || obj.id || obj.lid;
    const rawCode =
      obj.lt || obj.labelCode || obj.label_code || obj.code || obj.lc;

    const labelId =
      typeof rawId === "string" && rawId.trim().length > 0
        ? rawId.trim()
        : null;

    let labelCode: string | null = null;
    if (typeof rawCode === "string" && rawCode.trim().length > 0) {
      labelCode = rawCode.trim();
    }

    if (!labelCode && cleaned.length > 0) labelCode = cleaned;

    return { labelId, labelCode };
  } catch {
    return { labelId: null, labelCode: cleaned };
  }
}

/**
 * Vincula etiqueta a pedido (separação)
 * ❗ NÃO mexe em estoque aqui (correto)
 */
export async function separateLabelForOrder(params: {
  orderId: string;
  qrText: string;
}) {
  const { orderId, qrText } = params;

  if (!orderId?.trim()) {
    throw new Error("Pedido não informado.");
  }

  const { labelId, labelCode } = parseLabelFromQr(qrText);

  if (!labelId && !labelCode) {
    throw new Error("Etiqueta não encontrada (QR inválido).");
  }

  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any).establishment_id;
  const userId = (membership as any).user_id ?? null;

  let query = supabase
    .from("inventory_labels")
    .select("*")
    .eq("establishment_id", establishmentId);

  if (labelId) query = query.eq("id", labelId);
  else query = query.eq("label_code", labelCode);

  const { data: label } = await query.maybeSingle();

  if (!label) throw new Error("Etiqueta não encontrada.");

  if ((label as any).status !== "available") {
    throw new Error("Etiqueta já utilizada.");
  }

  const nowIso = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("inventory_labels")
    .update({
      status: "separated",
      order_id: orderId,
      separated_at: nowIso,
      separated_by: userId,
    })
    .eq("id", (label as any).id)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  return updated as InventoryLabelRow;
}

export async function revalidateInventoryLabel(params: {
  labelId: string;
  newNotes: string | null;
}): Promise<InventoryLabelRow> {
  const { labelId, newNotes } = params;

  if (!labelId?.trim()) throw new Error("labelId não informado.");

  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any).establishment_id;
  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  // (Opcional) garante que a etiqueta pertence ao establishment atual
  const { data: current, error: curErr } = await supabase
    .from("inventory_labels")
    .select("id, establishment_id")
    .eq("id", labelId)
    .maybeSingle();

  if (curErr) {
    console.error("Erro ao buscar etiqueta:", curErr);
    throw new Error("Falha ao localizar etiqueta.");
  }

  if (!current) throw new Error("Etiqueta não encontrada.");

  if ((current as any).establishment_id !== establishmentId) {
    throw new Error("Etiqueta não pertence ao estabelecimento atual.");
  }

  const { data: updated, error: updErr } = await supabase
    .from("inventory_labels")
    .update({
      notes: newNotes ?? null,
    })
    .eq("id", labelId)
    .select(
      "id, label_code, qty, unit_label, status, created_at, notes, order_id, separated_at, separated_by"
    )
    .single();

  if (updErr || !updated) {
    console.error("Erro ao atualizar notes da etiqueta:", updErr);
    throw new Error("Falha ao revalidar etiqueta.");
  }

  return updated as InventoryLabelRow;
}

// src/app/(dashboard)/dashboard/etiquetas/actions.ts
// ✅ COLE ESTE BLOCO NO FINAL DO ARQUIVO (NÃO ALTERE O RESTO)

export async function revalidateInventoryLabel(params: {
  labelId: string;
  newNotes?: unknown;
}): Promise<InventoryLabelRow> {
  const { labelId, newNotes } = params;

  if (!labelId?.trim()) throw new Error("labelId não informado.");

  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any).establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  const notesJson =
    newNotes === undefined
      ? null
      : typeof newNotes === "string"
        ? newNotes
        : JSON.stringify(newNotes);

  // ✅ Revalidar: volta para "available" e limpa vínculo de separação/pedido
  const { data: updated, error } = await supabase
    .from("inventory_labels")
    .update({
      status: "available",
      order_id: null,
      separated_at: null,
      separated_by: null,
      notes: notesJson,
    })
    .eq("id", labelId)
    .eq("establishment_id", establishmentId)
    .select(
      "id, label_code, qty, unit_label, status, created_at, notes, order_id, separated_at, separated_by"
    )
    .maybeSingle();

  if (error) {
    console.error("Erro ao revalidar etiqueta:", error);
    throw new Error("Falha ao revalidar etiqueta no banco.");
  }

  if (!updated) {
    throw new Error("Etiqueta não encontrada para revalidar.");
  }

  return updated as InventoryLabelRow;
}
