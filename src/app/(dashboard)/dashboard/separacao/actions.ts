"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

function getMembershipScopeId(membership: Record<string, unknown>) {
  if (!membership.establishment_id) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }
  return String(membership.establishment_id);
}

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
};

/**
 * Params vindos do formulário de etiquetas (lado client)
 * - productName: nome do insumo/produto (ex.: "Farinha de trigo")
 * - qty / unitLabel: quantidade e unidade
 * - labelCode: vamos usar o LOTE como código da etiqueta (label_code)
 * - extraPayload: TODO o objeto da etiqueta (datas, lote, local, etc.)
 *   que vamos guardar em JSON no campo notes
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
 * A RPC cria etiqueta, movimento e saldo de forma transacional.
 */
export async function createInventoryLabel(params: CreateInventoryLabelParams) {
  const { productName, qty, unitLabel, labelCode, extraPayload } = params;

  if (!productName?.trim()) throw new Error("Produto não informado.");
  if (!qty || qty <= 0) throw new Error("Quantidade inválida.");
  if (!unitLabel?.trim()) throw new Error("Unidade não informada.");
  if (!labelCode?.trim()) throw new Error("Código/Lote da etiqueta vazio.");

  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any).establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  // 1) Tenta localizar o produto pelo nome na tabela products
  let productId: string | null = null;

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id")
    .eq("establishment_id", establishmentId)
    .ilike("name", productName)
    .maybeSingle();

  if (prodErr) {
    console.error("Erro ao buscar produto em products:", prodErr);
  } else if (product?.id) {
    productId = product.id;
  }

  if (!productId) {
    throw new Error("Produto não encontrado neste estabelecimento.");
  }

  const notesJson =
    extraPayload != null
      ? JSON.stringify({
          ...extraPayload,
          productName,
        })
      : null;

  const { data, error } = await supabase
    .rpc("create_inventory_label", {
      p_establishment_id: establishmentId,
      p_product_id: productId,
      p_label_code: labelCode,
      p_qty: qty,
      p_unit_label: String(unitLabel).trim().toUpperCase(),
      p_notes: notesJson,
      p_label_type: null,
    })
    .single();

  if (error) {
    console.error("Erro ao chamar create_inventory_label:", {
      message: error.message,
      code: (error as any).code,
      details: (error as any).details,
      hint: (error as any).hint,
    });

    // Repassa a mensagem real para o front (alert)
    const code = (error as any).code;
    const msg = error.message || "Falha ao salvar etiqueta no banco.";

    throw new Error(
      code ? `${msg} (código: ${code})` : msg
    );
  }

  // Revalidar a página de etiquetas (para SSR/Server Components)
  revalidatePath("/dashboard/etiquetas");
  revalidatePath("/dashboard/estoque");

  return data as InventoryLabelRow;
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
    .select("id, label_code, qty, unit_label, status, created_at, notes")
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
   =========================================================== */

function extractLabelCodeFromQr(raw: string): string | null {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return null;

  // 1) Tenta JSON.parse até 2 níveis (para casos "\"{...}\"")
  let textToParse: any = cleaned;
  for (let depth = 0; depth < 2; depth++) {
    try {
      const obj = JSON.parse(textToParse);

      // se o primeiro parse devolve string, tenta de novo
      if (typeof obj === "string") {
        textToParse = obj;
        continue;
      }

      const fromLt = (obj as any).lt;
      const fromLabelCode =
        (obj as any).labelCode ||
        (obj as any).label_code ||
        (obj as any).code ||
        (obj as any).lc;

      const code = fromLt ?? fromLabelCode;

      if (typeof code === "string" && code.trim()) {
        return code.trim();
      }

      // se chegou aqui, não tem campo de código → sai do loop
      break;
    } catch {
      // não é JSON → cai para regex
      break;
    }
  }

  // 2) Regex para pegar "lt":"MEU_LOTE"
  const matchLt = cleaned.match(/"lt"\s*:\s*"([^"]+)"/i);
  if (matchLt && matchLt[1]?.trim()) {
    return matchLt[1].trim();
  }

  // 3) Regex para padrão de lote IE-FA-271225-90D dentro do texto
  const matchPattern = cleaned.match(/[A-Z]{2}-[A-Z]{2}-\d{6}-\d+D/);
  if (matchPattern && matchPattern[0]) {
    return matchPattern[0];
  }

  // 4) Último recurso: se não parece JSON e é curto, usa direto
  if (
    cleaned.length <= 64 &&
    !cleaned.includes("{") &&
    !cleaned.includes("}")
  ) {
    return cleaned;
  }

  return null;
}

/**
 * Params para vincular UMA etiqueta a um pedido na tela de Separação
 */
export type SeparateLabelForOrderParams = {
  orderId: string;
  qrText: string;
};

/**
 * Lê o QR, extrai o label_code e:
 *  - chama a função RPC separate_label_for_order no Supabase
 *  - depois busca a etiqueta já atualizada em inventory_labels
 */
export async function separateLabelForOrder(
  params: SeparateLabelForOrderParams
) {
  const { orderId, qrText } = params;

  if (!orderId?.trim()) {
    throw new Error("Pedido não informado.");
  }

  const labelCode = extractLabelCodeFromQr(qrText);

  if (!labelCode) {
    throw new Error("Etiqueta não encontrada (QR inválido)");
  }

  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = getMembershipScopeId(membership);
  const userId = (membership as any).user_id ?? null;

  if (!userId) {
    throw new Error("Usuário não encontrado no membership.");
  }

  // 1) Chama a função RPC que:
  //    - valida etiqueta e pedido
  //    - cria vínculo em order_items_labels
  //    - cria movimento de estoque em inventory_movements
  //    - atualiza qty/status da etiqueta
  const { error: rpcError } = await supabase.rpc(
    "separate_label_for_order",
    {
      p_label_code: labelCode,
      p_order_id: orderId,
      p_user_id: userId,
    }
  );

  if (rpcError) {
    console.error("Erro ao chamar separate_label_for_order:", rpcError);
    throw new Error(
      rpcError.message || "Falha ao vincular etiqueta ao pedido."
    );
  }

  // 2) Busca a etiqueta já atualizada (qty/status/etc.)
  const { data: label, error: labelErr } = await supabase
    .from("inventory_labels")
    .select("id, label_code, qty, unit_label, status, created_at, notes")
    .eq("establishment_id", establishmentId)
    .eq("label_code", labelCode)
    .maybeSingle();

  if (labelErr) {
    console.error(
      "Erro ao buscar etiqueta após separate_label_for_order:",
      labelErr
    );
    throw new Error("Etiqueta vinculada, mas falha ao recarregar dados.");
  }

  if (!label) {
    throw new Error(
      "Etiqueta vinculada, mas não encontrada ao recarregar dados."
    );
  }

  // 3) Revalida as telas relevantes
  revalidatePath("/dashboard/separacao");
  revalidatePath(`/dashboard/pedidos/${orderId}`);

  return label as InventoryLabelRow;
}

/* ===========================================================
   ✅ Finalização da separação
   =========================================================== */

export async function finalizeOrderSeparation(orderId: string) {
  if (!orderId?.trim()) {
    throw new Error("Pedido não informado.");
  }

  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = getMembershipScopeId(membership);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (orderErr || !order) {
    throw new Error("Pedido não encontrado ou fora do seu estabelecimento.");
  }

  if (order.status !== "em_separacao") {
    throw new Error("Só é possível finalizar pedidos que estão em separação.");
  }

  const { data: labels, error: labelsErr } = await supabase
    .from("inventory_labels")
    .select("id")
    .eq("order_id", orderId)
    .eq("establishment_id", establishmentId)
    .in("status", ["separated", "consumed"]);

  if (labelsErr) {
    console.error("Erro ao verificar etiquetas separadas:", labelsErr);
    throw new Error("Erro ao verificar etiquetas do pedido.");
  }

  if (!labels || labels.length === 0) {
    throw new Error(
      "Não há nenhuma etiqueta separada para este pedido. Leia ao menos uma etiqueta antes de finalizar."
    );
  }

  const { error } = await supabase.rpc("advance_order_status", {
    p_order_id: orderId,
    p_to_status: "em_faturamento",
    p_note: "Separação finalizada",
  });

  if (error) {
    console.error("Erro ao finalizar separação do pedido:", error);
    throw new Error("Falha ao finalizar separação do pedido.");
  }

  revalidatePath("/dashboard/separacao");
  revalidatePath(`/dashboard/pedidos/${orderId}`);
}
