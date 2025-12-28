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

  // campos extras usados na separação
  order_id?: string | null;
  separated_at?: string | null;
  separated_by?: string | null;
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
 * - Cria também um movimento de ENTRADA em inventory_movements
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

  // Tenta localizar o produto pelo nome na tabela products
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

  try {
    // 1️⃣ Insere a etiqueta em inventory_labels
    const { data, error: insertErr } = await supabase
      .from("inventory_labels")
      .insert({
        establishment_id: establishmentId,
        product_id: productId,
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

    if (insertErr || !data) {
      console.error(
        "Erro ao inserir etiqueta em inventory_labels:",
        insertErr
      );

      // Se ainda existir algum UNIQUE em label_code em algum ambiente
      if ((insertErr as any)?.code === "23505") {
        throw new Error(
          "Já existe uma etiqueta com este código/lote. Remova a UNIQUE constraint de label_code no Supabase ou altere o lote."
        );
      }

      const msg =
        (insertErr as any)?.message ??
        "Falha ao salvar etiqueta no banco (insert).";
      throw new Error(msg);
    }

    const label = data as InventoryLabelRow;

    // 2️⃣ Cria movimento de ENTRADA no estoque (se soubermos o product_id)
    if (productId) {
      const movementDetails = {
        source: "create_label",
        label_id: label.id,
        label_code: labelCode,
        payload: extraPayload ?? null,
      };

      // 🔍 Antes de inserir, checa se já existe movimento de entrada para esta etiqueta
      const { data: existingMov, error: existingCheckErr } = await supabase
        .from("inventory_movements")
        .select("id")
        .eq("establishment_id", establishmentId)
        .eq("product_id", productId)
        .eq("label_id", label.id)
        .eq("movement_type", "entrada_etiqueta")
        .eq("direction", "IN")
        .maybeSingle();

      if (existingCheckErr) {
        console.error(
          "Erro ao verificar movimento existente para etiqueta:",
          existingCheckErr
        );
      }

      if (!existingMov) {
        const { error: movErr } = await supabase
          .from("inventory_movements")
          .insert({
            establishment_id: establishmentId,
            product_id: productId,
            label_id: label.id,
            order_id: null,
            movement_type: "entrada_etiqueta",
            direction: "IN",
            qty,
            unit_label: unitLabel,
            reason: "etiqueta_criada",
            notes: "Movimento gerado automaticamente ao criar etiqueta.",
            details: movementDetails, // supabase converte object -> jsonb
            created_by: userId,
          });

        if (movErr) {
          console.error(
            "Erro ao inserir movimento em inventory_movements:",
            movErr
          );

          const msg =
            (movErr as any)?.message ??
            "Etiqueta criada, mas houve falha ao registrar o movimento de estoque.";
          throw new Error(msg);
        }
      } else {
        console.warn(
          "[createInventoryLabel] Movimento de entrada já existe para esta etiqueta; não será duplicado."
        );
      }
    } else {
      console.warn(
        "[createInventoryLabel] Etiqueta criada sem product_id vinculado. Movimento de estoque não foi gerado."
      );
    }

    // 3️⃣ Revalidar a página de etiquetas
    revalidatePath("/dashboard/etiquetas");

    return label;
  } catch (err) {
    console.error("Erro geral ao criar etiqueta + movimento:", err);
    throw err;
  }
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
     - Formato novo: { "label_id": "...", "qty": 3, ... }
     - Formato antigo: apenas texto (usa como label_code)
   =========================================================== */

type ParsedLabelFromQr = {
  labelId: string | null;
  labelCode: string | null;
};

function parseLabelFromQr(raw: string): ParsedLabelFromQr {
  const cleaned = String(raw || "").trim();
  if (!cleaned) {
    return { labelId: null, labelCode: null };
  }

  // 1) Tenta interpretar como JSON
  try {
    const obj = JSON.parse(cleaned) as any;

    const rawId = obj.label_id || obj.labelId || obj.id || obj.lid;
    const rawCode =
      obj.labelCode || obj.label_code || obj.code || obj.lc || obj.lt;

    const labelId =
      typeof rawId === "string" && rawId.trim().length > 0
        ? rawId.trim()
        : null;

    let labelCode: string | null = null;

    if (typeof rawCode === "string" && rawCode.trim().length > 0) {
      labelCode = rawCode.trim();
    }

    // Se não tiver code no JSON, usamos o próprio texto limpo como code
    if (!labelCode && cleaned.length > 0) {
      labelCode = cleaned;
    }

    return { labelId, labelCode };
  } catch (e) {
    // Não é JSON → consideramos texto puro = label_code
    console.warn("QR não é JSON, usando texto puro como label_code:", e);
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
    // Preferimos buscar pelo ID da etiqueta (modelo novo)
    query = query.eq("id", labelId);
  } else if (labelCode) {
    // Fallback: buscar pelo código da etiqueta (modelo antigo)
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
      throw new Error(
        "Esta etiqueta já está vinculada a outro pedido."
      );
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
    console.error(
      "Erro ao atualizar etiqueta (vincular ao pedido):",
      updateErr
    );
    throw new Error("Falha ao vincular etiqueta ao pedido.");
  }

  // 4) Revalida as telas relevantes
  revalidatePath("/dashboard/separacao");
  revalidatePath(`/dashboard/pedidos/${orderId}`);

  // Retorna a etiqueta atualizada (caso o front queira usar)
  return updated as InventoryLabelRow;
}
