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
 * Salva UMA etiqueta na tabela inventory_labels
 * ✅ mantém histórico
 * ✅ mantém separação por QR
 * ✅ cria movimento de estoque automaticamente
 */
export async function createInventoryLabel(
  params: CreateInventoryLabelParams
): Promise<InventoryLabelRow> {
  const {
    productId,
    productName,
    qty,
    unitLabel,
    labelCode,
    extraPayload,
  } = params;

  if (!productId?.trim()) throw new Error("Produto (ID) não informado.");
  if (!productName?.trim()) throw new Error("Produto não informado.");
  if (!qty || qty <= 0) throw new Error("Quantidade inválida.");
  if (!unitLabel?.trim()) throw new Error("Unidade não informada.");
  if (!labelCode?.trim()) throw new Error("Código/Lote da etiqueta vazio.");

  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any).establishment_id;
  const userId = (membership as any).user_id ?? null;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  const notesJson =
    extraPayload != null
      ? JSON.stringify({
          ...extraPayload,
          productName, // preserva texto livre no histórico
        })
      : null;

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
      unit_label: unitLabel,
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
   * 2️⃣ MOVIMENTA ESTOQUE (ENTRADA)
   * Fonte única de verdade do saldo
   */
  await moveStock(supabase, {
    establishment_id: establishmentId,
    product_id: productId,
    unit_label: unitLabel,
    qty_delta: qty, // ➕ ENTRADA
    reason: "etiqueta_manipulacao",
    source: "inventory_labels",
  });

  return label as InventoryLabelRow;
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

  if (label.status !== "available") {
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
    .eq("id", label.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  return updated as InventoryLabelRow;
}
