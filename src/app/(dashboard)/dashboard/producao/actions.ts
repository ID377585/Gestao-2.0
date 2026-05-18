"use server";

import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export type Role =
  | "cliente"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "admin"
  | "entrega";

type KdsItem = {
  order_item_id: string;
  order_id: string;
  production_status: "pending" | "in_progress" | "done" | "no_production_needed";
  production_assigned_to: string | null;
  production_start_at: string | null;
  production_end_at: string | null;
};

export type KdsCollaborator = {
  id: string;
  full_name: string;
  role: Role;
  sector: string | null;
};

/**
 * Tipo de retorno básico da função separate_label_for_order
 * (baseado na tabela inventory_labels)
 */
export type InventoryLabel = {
  id: string;
  establishment_id: string;
  product_id: string;
  label_code: string;
  qty: number;
  unit_label: string;
  status: "available" | "separated" | "consumed" | "canceled";
  order_id: string | null;
  separated_at: string | null;
  separated_by: string | null;
  created_at: string;
  created_by: string | null;
  notes: string | null;
};

function getMembershipScopeId(membership: Record<string, unknown>) {
  const scope = membership.establishment_id ?? membership.unit_id;
  if (!scope) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }
  return String(scope);
}

// ----------------------------------------------------
// Helper — localizar item na tabela correta (order_line_items ou order_items)
// ----------------------------------------------------
async function findOrderItem(
  supabase: any,
  orderItemId: string
): Promise<{
  table: "order_line_items" | "order_items" | null;
  item:
    | {
        id: string;
        production_status: string;
        production_assigned_to: string | null;
        production_start_at: string | null;
        production_end_at: string | null;
        product_id: string | null;
        order_qty: number | null;
        default_unit_label: string | null;
      }
    | null;
}> {
  const tablesToTry = ["order_line_items", "order_items"] as const;

  for (const table of tablesToTry) {
    const { data, error } = await supabase
      .from(table)
      .select(
        `
          id,
          production_status,
          production_assigned_to,
          production_start_at,
          production_end_at,
          product_id,
          order_qty,
          default_unit_label
        `
      )
      .eq("id", orderItemId)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar em ${table}:`, error);
      throw error;
    }

    if (data) {
      return {
        table,
        item: {
          id: data.id,
          production_status: data.production_status,
          production_assigned_to: data.production_assigned_to,
          production_start_at: data.production_start_at ?? null,
          production_end_at: data.production_end_at ?? null,
          product_id: data.product_id ?? null,
          order_qty: data.order_qty ?? null,
          default_unit_label: data.default_unit_label ?? null,
        },
      };
    }
  }

  console.warn(
    "⚠️ Nenhum registro encontrado em order_line_items / order_items para id:",
    orderItemId
  );

  return { table: null, item: null };
}

// ---------------------------------------------------------------------
// 1) Buscar dados da view do KDS
// ---------------------------------------------------------------------
export async function getKdsProductionData(): Promise<{ items: KdsItem[] }> {
  const supabase = await createSupabaseServerClient();
  await getActiveMembershipOrRedirect();

  const { data, error } = await supabase
    .from("kds_production_view")
    .select("*")
    .order("order_number", { ascending: true });

  if (error) throw error;

  return { items: (data ?? []) as KdsItem[] };
}

// ---------------------------------------------------------------------
// 2) Lista colaboradores aptos para produção
// ---------------------------------------------------------------------
export async function listKdsCollaborators(): Promise<KdsCollaborator[]> {
  const supabase = await createSupabaseServerClient();
  await getActiveMembershipOrRedirect();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, sector")
    .in("role", ["admin", "operacao", "producao", "estoque", "fiscal", "entrega"])
    .order("full_name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role as Role,
    sector: p.sector ?? null,
  }));
}

// ---------------------------------------------------------------------
// 3) Definir colaborador
// ---------------------------------------------------------------------
export async function assignProductionCollaborator(
  orderItemId: string,
  userId: string
) {
  const { membership } = await getActiveMembershipOrRedirect();

  if (!["admin", "operacao"].includes(membership.role)) {
    throw new Error("Somente líderes podem definir colaborador.");
  }

  const supabase = getSupabaseAdminClient();
  const { table } = await findOrderItem(supabase, orderItemId);

  if (!table) {
    console.error(
      "Item de pedido não encontrado para definir colaborador:",
      orderItemId
    );
    throw new Error("Item de pedido não encontrado para definir colaborador.");
  }

  const { error } = await supabase
    .from(table)
    .update({ production_assigned_to: userId })
    .eq("id", orderItemId);

  if (error) {
    console.error("🔥 Erro ao definir colaborador:", error);
    throw new Error("Falha ao definir colaborador.");
  }

  revalidatePath("/dashboard/producao");
}

// ---------------------------------------------------------------------
// 4) Avançar status da produção por ITEM
// ---------------------------------------------------------------------
export async function advanceProductionStatus(orderItemId: string) {
  const { membership } = await getActiveMembershipOrRedirect();
  const supabase = getSupabaseAdminClient();

  const { table, item } = await findOrderItem(supabase, orderItemId);
  if (!table || !item) {
    console.error(
      "Item não encontrado em nenhuma tabela ao avançar status:",
      orderItemId
    );
    throw new Error("Item de pedido não encontrado.");
  }

  const now = new Date().toISOString();
  const status = item.production_status as
    | "pending"
    | "in_progress"
    | "done"
    | "no_production_needed";

  // 4.1 – PENDING → IN_PROGRESS
  if (status === "pending") {
    if (!["admin", "operacao"].includes(membership.role)) {
      throw new Error("Apenas líderes podem iniciar a produção.");
    }

    if (!item.production_assigned_to) {
      throw new Error("Defina um colaborador antes de avançar o status.");
    }

    const { error: updErr } = await supabase
      .from(table)
      .update({
        production_status: "in_progress",
        production_start_at: now,
        production_end_at: null,
      })
      .eq("id", orderItemId);

    if (updErr) {
      console.error("Erro ao atualizar status para in_progress:", updErr);
      throw updErr;
    }

    revalidatePath("/dashboard/producao");
    return;
  }

  // 4.2 – IN_PROGRESS → DONE
  if (status === "in_progress") {
    if (!["admin", "operacao", "producao"].includes(membership.role)) {
      throw new Error("Sem permissão para finalizar a produção.");
    }

    const { error: updErr } = await supabase
      .from(table)
      .update({
        production_status: "done",
        production_end_at: now,
      })
      .eq("id", orderItemId);

    if (updErr) {
      console.error("Erro ao atualizar status para done:", updErr);
      throw updErr;
    }

    // Registro de produtividade
    try {
      const minutes =
        item.production_start_at != null
          ? Math.round(
              (Date.now() -
                new Date(item.production_start_at).getTime()) / 60000
            )
          : null;

      const { error: prodErr } = await supabase
        .from("production_productivity")
        .insert({
          order_item_id: orderItemId,
          product_id: item.product_id,
          collaborator_id: item.production_assigned_to,
          qty: item.order_qty,
          unit: item.default_unit_label,
          start_at: item.production_start_at,
          end_at: now,
          duration_minutes: minutes,
        });

      if (prodErr) {
        console.error(
          "⚠️ Erro ao registrar produtividade em production_productivity:",
          prodErr
        );
      }
    } catch (e) {
      console.error("⚠️ Exceção ao registrar produtividade:", e);
    }

    revalidatePath("/dashboard/producao");
    return;
  }

  // 4.3 – DONE / NO_PRODUCTION_NEEDED → nada a fazer
  return;
}

// ---------------------------------------------------------------------
// 5) Mover PEDIDO PAI da produção → em_separacao
// ---------------------------------------------------------------------
export async function moveOrderToNextStageFromProduction(orderId: string) {
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = getMembershipScopeId(membership);
  const supabase = await createSupabaseServerClient();

  if (!["admin", "operacao"].includes(membership.role)) {
    throw new Error(
      "Somente líderes podem mover o pedido para a próxima etapa."
    );
  }

  const { data: kdsItems, error: kdsErr } = await supabase
    .from("kds_production_view")
    .select("production_status")
    .eq("order_id", orderId);

  if (kdsErr) {
    console.error(
      "Erro ao verificar itens de produção para o pedido:",
      kdsErr
    );
    throw new Error("Erro ao verificar itens de produção para o pedido.");
  }

  const hasItemsInProduction =
    (kdsItems ?? []).some((i: any) =>
      ["pending", "in_progress"].includes(i.production_status)
    );

  if (hasItemsInProduction) {
    throw new Error(
      "Ainda existem itens deste pedido em produção. Finalize todos antes de avançar o pedido."
    );
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (orderErr) {
    console.error("Erro ao buscar pedido para avançar etapa:", orderErr);
    throw new Error("Erro ao buscar pedido.");
  }

  if (!order) {
    throw new Error("Pedido não encontrado.");
  }

  const currentStatus = order.status as string;

  if (currentStatus !== "em_preparo") {
    console.warn(
      `Pedido ${orderId} em status ${currentStatus}, esperado 'em_preparo' para mover para 'em_separacao'.`
    );
  }

  const nextStatus = "em_separacao";

  const { error: updOrderErr } = await supabase.rpc("advance_order_status", {
    p_order_id: orderId,
    p_to_status: nextStatus,
    p_note: "Produção finalizada",
  });

  if (updOrderErr) {
    console.error("Erro ao atualizar status do pedido:", updOrderErr);
    throw new Error("Erro ao atualizar status do pedido.");
  }

  revalidatePath("/dashboard/producao");
  revalidatePath("/dashboard/pedidos");

  return { id: orderId, status: nextStatus };
}

// =====================================================================
// 6) SEPARAÇÃO – LER ETIQUETA (QR) E VINCULAR AO PEDIDO
// =====================================================================
export async function separateLabelForOrder(params: {
  orderId: string;
  rawQrText: string;
}) {
  const { orderId, rawQrText } = params;

  if (!orderId) {
    throw new Error("ID do pedido não informado.");
  }

  const code = rawQrText.trim();

  if (!code) {
    throw new Error("Nenhum código de etiqueta (QR) informado.");
  }

  // Checa papel do usuário logado
  const { membership } = await getActiveMembershipOrRedirect();

  if (!["admin", "estoque", "operacao"].includes(membership.role)) {
    throw new Error("Você não tem permissão para separar etiquetas.");
  }

  const supabase = await createSupabaseServerClient();

  // Se o membership tiver user_id, usamos para separated_by
  const userId = (membership as any).user_id ?? null;

  // label_code é exatamente o texto colado pelo scanner
  const labelCode = code;

  const { data, error } = await supabase.rpc("separate_label_for_order", {
    p_label_code: labelCode,
    p_order_id: orderId,
    p_user_id: userId,
  });

  if (error) {
    console.error("Erro na RPC separate_label_for_order:", error);
    throw new Error(error.message || "Falha ao separar etiqueta.");
  }

  // Função PL/pgSQL retorna SETOF inventory_labels → array
  const labels = data as InventoryLabel[] | null;
  const label = labels && labels.length > 0 ? labels[0] : null;

  if (!label) {
    throw new Error("Nenhuma etiqueta foi atualizada pela operação.");
  }

  // Revalida páginas importantes
  revalidatePath(`/dashboard/pedidos/${orderId}`);
  revalidatePath("/dashboard/estoque");
  revalidatePath("/dashboard/separacao");

  return label;
}

// =====================================================================
// 7) FINALIZAR SEPARAÇÃO → EM_FATURAMENTO
// =====================================================================
export async function finalizeOrderSeparation(orderId: string) {
  if (!orderId) {
    throw new Error("ID do pedido não informado.");
  }

  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = getMembershipScopeId(membership);

  if (!["admin", "estoque", "operacao"].includes(membership.role)) {
    throw new Error("Você não tem permissão para finalizar a separação.");
  }

  const supabase = await createSupabaseServerClient();

  // 1) Garante que o pedido existe
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (orderErr) {
    console.error("Erro ao buscar pedido em finalizeOrderSeparation:", orderErr);
    throw new Error("Erro ao buscar pedido.");
  }

  if (!order) {
    throw new Error("Pedido não encontrado.");
  }

  // Só permite finalizar se estiver na etapa formal de separação.
  if (order.status !== "em_separacao") {
    throw new Error(
      "Só é possível finalizar separação de pedidos em separação."
    );
  }

  // 2) Verifica se existe ao menos uma etiqueta separada para esse pedido
  const { data: labels, error: labelsErr } = await supabase
    .from("inventory_labels")
    .select("id")
    .eq("order_id", orderId)
    .eq("establishment_id", establishmentId)
    .in("status", ["separated", "consumed"]);

  if (labelsErr) {
    console.error(
      "Erro ao buscar etiquetas em finalizeOrderSeparation:",
      labelsErr
    );
    throw new Error("Erro ao verificar etiquetas do pedido.");
  }

  if (!labels || labels.length === 0) {
    throw new Error(
      "Não há nenhuma etiqueta separada para este pedido. Leia ao menos uma etiqueta antes de finalizar."
    );
  }

  // 3) Avança o pedido usando a regra central de status no banco.
  const { error: updErr } = await supabase.rpc("advance_order_status", {
    p_order_id: orderId,
    p_to_status: "em_faturamento",
    p_note: "Separação finalizada",
  });

  if (updErr) {
    console.error("Erro ao atualizar pedido para em_faturamento:", updErr);
    throw new Error("Falha ao atualizar status do pedido.");
  }

  // 4) Revalidar telas
  revalidatePath(`/dashboard/pedidos/${orderId}`);
  revalidatePath("/dashboard/separacao");
}
