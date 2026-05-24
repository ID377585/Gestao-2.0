"use server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { revalidatePath } from "next/cache";

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
 * A RPC cria etiqueta, movimento e saldo de forma transacional.
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
  const supabaseAdmin = createSupabaseAdminClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any).establishment_id;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId =
    (!authError && authData?.user?.id ? authData.user.id : null) ??
    ((membership as any).user_id ?? null);

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  if (!userId) {
    throw new Error("Usuário não encontrado para criar etiqueta.");
  }

  const notesJson =
    extraPayload != null
      ? JSON.stringify({
          ...extraPayload,
          productName, // preserva texto livre no histórico
        })
      : null;

  // ✅ NORMALIZA unidade (mantém padrão do resto do sistema)
  const normalizedUnit = String(unitLabel).trim().toUpperCase();

  const { data, error } = await supabaseAdmin
    .rpc("create_inventory_label", {
      p_establishment_id: establishmentId,
      p_product_id: productId,
      p_label_code: labelCode,
      p_qty: qty,
      p_unit_label: normalizedUnit,
      p_notes: notesJson,
      p_label_type: null,
      p_user_id: userId,
    })
    .single();

  if (error || !data) {
    if ((error as any)?.code === "23505") {
      throw new Error(
        "Já existe uma etiqueta com este código/lote. Verifique o lote."
      );
    }

    const msg =
      (error as any)?.message ?? "Falha ao salvar etiqueta no banco.";
    throw new Error(msg);
  }

  revalidatePath("/dashboard/etiquetas");
  revalidatePath("/dashboard/estoque");

  return data as InventoryLabelRow;
}

/**
 * ✅ Revalida UMA etiqueta existente
 * - Atualiza notes com novas datas (Manipulação/Vencimento etc)
 * - Opcionalmente volta status para "available" e limpa vínculo de separação/pedido
 * - NÃO cria movimento
 * - NÃO move estoque
 */
export async function revalidateInventoryLabel(params: {
  labelId: string;
  newNotes?: unknown;
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

  const notesValue =
    newNotes === undefined || newNotes === null
      ? null
      : typeof newNotes === "string"
        ? newNotes
        : JSON.stringify(newNotes);

  // ✅ Revalidar: mantém "available" e garante que não fique presa em pedido
  const { data: updated, error: upErr } = await supabase
    .from("inventory_labels")
    .update({
      status: "available",
      order_id: null,
      separated_at: null,
      separated_by: null,
      notes: notesValue,
      // ⚠️ não mexe em qty/unit/label_code etc
    })
    .eq("id", labelId)
    .eq("establishment_id", establishmentId)
    .select(
      "id, label_code, qty, unit_label, status, created_at, notes, order_id, separated_at, separated_by"
    )
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
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId =
    (!authError && authData?.user?.id ? authData.user.id : null) ??
    ((membership as any).user_id ?? null);

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  if (!userId) {
    throw new Error("Usuário não encontrado para separar etiqueta.");
  }

  let effectiveLabelCode = labelCode;

  if (!effectiveLabelCode && labelId) {
    const { data: labelById, error: labelByIdError } = await supabase
      .from("inventory_labels")
      .select("label_code")
      .eq("id", labelId)
      .eq("establishment_id", establishmentId)
      .maybeSingle();

    if (labelByIdError) {
      console.error("Erro ao buscar etiqueta por ID:", labelByIdError);
      throw new Error("Erro ao localizar etiqueta.");
    }

    effectiveLabelCode = (labelById as any)?.label_code ?? null;
  }

  if (!effectiveLabelCode) {
    throw new Error("Etiqueta não encontrada (QR sem código válido).");
  }

  const { error: rpcError } = await supabase.rpc("separate_label_for_order", {
    p_label_code: effectiveLabelCode,
    p_order_id: orderId,
    p_user_id: userId,
  });

  if (rpcError) {
    console.error("Erro ao chamar separate_label_for_order:", rpcError);
    throw new Error(
      rpcError.message || "Falha ao vincular etiqueta ao pedido."
    );
  }

  const { data: updated, error: reloadError } = await supabase
    .from("inventory_labels")
    .select(
      "id, label_code, qty, unit_label, status, created_at, notes, order_id, separated_at, separated_by"
    )
    .eq("establishment_id", establishmentId)
    .eq("label_code", effectiveLabelCode)
    .maybeSingle();

  if (reloadError) throw reloadError;

  if (!updated) {
    throw new Error("Etiqueta vinculada, mas não foi recarregada.");
  }

  revalidatePath("/dashboard/etiquetas");
  revalidatePath("/dashboard/separacao");
  revalidatePath(`/dashboard/pedidos/${orderId}`);

  return updated as InventoryLabelRow;
}
