"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

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
 * - productName: texto livre (o que o usuário digitar)
 * - qty / unitLabel: quantidade e unidade
 * - labelCode: lote/código da etiqueta (label_code)
 * - extraPayload: objeto completo da etiqueta que vamos guardar em JSON no notes
 */
export type CreateInventoryLabelParams = {
  productName: string;
  qty: number;
  unitLabel: string;
  labelCode: string;
  extraPayload: any;
};

/**
 * Salva UMA etiqueta na tabela inventory_labels
 * ✅ NÃO lista produtos
 * ✅ NÃO busca product_id
 * ✅ NÃO cria inventory_movements automaticamente
 * ✅ Campo Insumo/Produto vira 100% LIVRE no front
 */
export async function createInventoryLabel(
  params: CreateInventoryLabelParams
): Promise<InventoryLabelRow> {
  const { productName, qty, unitLabel, labelCode, extraPayload } = params;

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

  const notesJson = extraPayload != null ? JSON.stringify(extraPayload) : null;

  // ✅ SEM VÍNCULO COM products: product_id = null
  const { data: label, error: insertErr } = await supabase
    .from("inventory_labels")
    .insert({
      establishment_id: establishmentId,
      product_id: null,
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
    // Se existir UNIQUE em label_code
    if ((insertErr as any)?.code === "23505") {
      throw new Error(
        "Já existe uma etiqueta com este código/lote. Verifique o lote ou a UNIQUE constraint."
      );
    }

    const msg =
      (insertErr as any)?.message ??
      "Falha ao salvar etiqueta no banco (insert).";
    throw new Error(msg);
  }

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
   ✅ Helpers para leitura do QR na tela de SEPARAÇÃO
   - Extrai label_id (id da etiqueta) e/ou label_code do JSON do QR
   - Suporta:
     - Formato novo (futuro): { "label_id": "...", ... }
     - Formato atual do QR: { v:1, lt:"LOTE", p:"...", q:..., u:"...", dv:"..." }
     - Formato antigo: texto puro (usa como label_code)
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
      typeof rawId === "string" && rawId.trim().length > 0 ? rawId.trim() : null;

    let labelCode: string | null = null;
    if (typeof rawCode === "string" && rawCode.trim().length > 0) {
      labelCode = rawCode.trim();
    }

    // fallback: se não veio code no JSON, usa texto limpo
    if (!labelCode && cleaned.length > 0) labelCode = cleaned;

    return { labelId, labelCode };
  } catch {
    // Não é JSON → texto puro = label_code
    return { labelId: null, labelCode: cleaned };
  }
}

/**
 * Params para vincular UMA etiqueta a um pedido na tela de Separação
 * - orderId: id do pedido
 * - qrText: texto bruto lido do QR (JSON ou texto puro)
 */
export type SeparateLabelForOrderParams = {
  orderId: string;
  qrText: string;
};

/**
 * Lê o QR, extrai o identificador e:
 *  - localiza a etiqueta em inventory_labels
 *  - valida status / estabelecimento
 *  - vincula ao pedido (order_id, status, separated_at/by)
 */
export async function separateLabelForOrder(
  params: SeparateLabelForOrderParams
) {
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

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  // 1) Monta query de busca
  let query = supabase
    .from("inventory_labels")
    .select("*")
    .eq("establishment_id", establishmentId);

  if (labelId) {
    query = query.eq("id", labelId);
  } else if (labelCode) {
    query = query.eq("label_code", labelCode);
  }

  const { data: label, error: labelErr } = await query.maybeSingle();

  if (labelErr) {
    console.error("Erro ao buscar etiqueta via QR:", labelErr);
    throw new Error("Erro ao buscar etiqueta no banco.");
  }

  if (!label) {
    throw new Error("Etiqueta não encontrada (QR inválido).");
  }

  // 2) Valida status / vínculo
  if (label.status !== "available") {
    if (label.order_id && label.order_id !== orderId) {
      throw new Error("Esta etiqueta já está vinculada a outro pedido.");
    }
    throw new Error("Esta etiqueta já foi utilizada na separação.");
  }

  // 3) Atualiza a etiqueta vinculando ao pedido
  const nowIso = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabase
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

  if (updateErr) {
    console.error("Erro ao atualizar etiqueta (vincular ao pedido):", updateErr);
    throw new Error("Falha ao vincular etiqueta ao pedido.");
  }

  return updated as InventoryLabelRow;
}
