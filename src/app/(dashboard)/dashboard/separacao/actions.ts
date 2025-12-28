"use server";

import { revalidatePath } from "next/cache";
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
 * - Garante establishment_id e created_by a partir do membership
 * - Tenta localizar o produto por NOME na tabela products (se não achar, grava product_id = null)
 * - Guarda o JSON completo da etiqueta em notes
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
  const userId = (membership as any).user_id ?? null;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  // 1) Tenta localizar o produto pelo nome na tabela products
  let productId: string | null = null;

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id")
    .ilike("name", productName)
    .maybeSingle();

  if (prodErr) {
    console.error("Erro ao buscar produto em products:", prodErr);
  } else if (product?.id) {
    productId = product.id;
  }

  const notesJson =
    extraPayload != null ? JSON.stringify(extraPayload) : null;

  // 2) Tenta inserir a etiqueta
  const { data, error } = await supabase
    .from("inventory_labels")
    .insert({
      establishment_id: establishmentId,
      product_id: productId, // pode ser null
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

  if (error) {
    // LOG COMPLETO NO TERMINAL
    console.error("Erro ao criar etiqueta em inventory_labels:", {
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
 *  - chama a função RPC use_label_on_order no Supabase (rastreabilidade completa)
 *  - depois busca a etiqueta já atualizada em inventory_labels
 */
export async function separateLabelForOrder(
  params: SeparateLabelForOrderParams
) {
  const { orderId, qrText } = params;

  if (!orderId?.trim()) {
    throw new Error("Pedido não informado.");
  }

  // LOG de debug para ver exatamente o que está chegando do QR
  console.log("📦 [separacao] QR lido (bruto):", qrText);

  const labelCode = extractLabelCodeFromQr(qrText);

  console.log("📦 [separacao] label_code extraído:", labelCode);

  if (!labelCode) {
    throw new Error("Etiqueta não encontrada (QR inválido)");
  }

  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any).establishment_id;
  const userId = (membership as any).user_id ?? null;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  if (!userId) {
    throw new Error("Usuário não encontrado no membership.");
  }

  // 1) Chama a função RPC que:
  //    - valida etiqueta e pedido
  //    - cria vínculo em order_items_labels
  //    - cria movimento de estoque em inventory_movements
  //    - atualiza qty/status da etiqueta
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "use_label_on_order",
    {
      p_label_code: labelCode,
      p_order_id: orderId,
      p_order_item_id: null, // por enquanto não ligamos a um item específico
      p_user_id: userId,
      p_qty_used: null, // usa 100% da quantidade da etiqueta
    }
  );

  if (rpcError) {
    console.error("Erro ao chamar use_label_on_order:", rpcError);
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
      "Erro ao buscar etiqueta após use_label_on_order:",
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

  const establishmentId = (membership as any).establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  // Se você tiver uma função RPC finalize_order_separation, use-a:
  const { error } = await supabase.rpc("finalize_order_separation", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("Erro ao finalizar separação do pedido:", error);
    throw new Error("Falha ao finalizar separação do pedido.");
  }

  revalidatePath("/dashboard/separacao");
  revalidatePath(`/dashboard/pedidos/${orderId}`);
}
