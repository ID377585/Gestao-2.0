// pedidos/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveMembershipOrRedirect,
  type MembershipContext,
} from "@/lib/auth/get-membership";

import {
  dispatchLowStockAlertsForProducts,
  dispatchOrderLifecycleAlert,
} from "@/lib/alerts/domain-triggers";

export type Role =
  | "cliente"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "admin"
  | "entrega";

export type CreateOrderResult = {
  id: string;
  order_number: number | null;
  status: string;
  created_at: string;
};

export type OrderListItem = {
  id: string;
  order_number: number | null;
  status: string;
  created_at: string;
  notes: string | null;
};

export type OrderDetails = {
  id: string;
  order_number: number | null;
  status: string;
  created_at: string;
  notes: string | null;

  accepted_by: string | null;
  accepted_at: string | null;

  canceled_by: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;

  reopened_by: string | null;
  reopened_at: string | null;
};

export type OrderTimelineEvent = {
  id: string;
  from_status: string | null;
  to_status: string;
  client_label: string | null;
  visible_to_client: boolean;
  created_at: string;
  note: string | null;
};

export type OrderLineItem = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  unit_label: string;
};

/**
 * Itens que chegam na criação de pedido com itens
 */
export type NewOrderItemInput = {
  product_name: string;
  quantity: number;
  unit_label: string;
};

/**
 * Input para vincular etiqueta a pedido (via QR)
 */
export type LinkLabelToOrderInput = {
  orderId: string;
  labelCode: string; // texto lido do QR (JSON ou código puro)
  qtyToUse?: number; // opcional: se quiser usar parcial
};

/**
 * Resumo da coleta (separação) por produto
 * - usado para mostrar no pedido o que já foi coletado
 */
export type OrderCollectedSummaryItem = {
  product_name: string;
  total_qty: number;
  unit_label: string;
  unit_cost: number | null;
  total_cost: number | null;
};

export type OrderCollectedSummary = {
  order_id: string;
  items: OrderCollectedSummaryItem[];
  total_qty: number;
  total_cost: number | null;
};

/**
 * Rascunho de pré-nota (order_billing_drafts)
 * Agora contempla também frete e transportadora
 */
export type OrderBillingDraft = {
  id: string;
  order_id: string;
  establishment_id: string;
  subtotal: number;
  markup_percent: number;
  total_with_markup: number;
  freight_value: number | null;
  carrier_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Transportadora (carriers)
 */
export type Carrier = {
  id: string;
  name: string;
  is_active: boolean;
};

/**
 * Fluxo oficial (FRONT) — usado apenas para sugerir "próximo status"
 * A validação real (anti-pulo + role + establishment) acontece no banco via RPC.
 */
function nextStatus(current: string) {
  const flow: Record<string, string> = {
    aceitou_pedido: "em_preparo",
    em_preparo: "em_separacao",
    em_separacao: "em_faturamento",
    em_faturamento: "em_transporte",
    em_transporte: "entregue",
  };
  return flow[current] ?? null;
}

// escopo final para filtrar pedidos (coluna do banco: orders.establishment_id)
function getScopeId(ctx: MembershipContext): string {
  const scope = ctx.establishmentId ?? ctx.unitId;
  if (!scope) {
    throw new Error(
      "Membership sem establishmentId/unitId. Verifique sua tabela memberships."
    );
  }
  return scope;
}

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

function normalizePgError(err: any) {
  const message = err?.message || "Erro desconhecido";
  const code = err?.code as string | undefined;

  // Exceptions levantadas no SQL (raise exception)
  if (message.includes("Transition not allowed")) {
    return new Error("Você não tem permissão para avançar para esse status.");
  }
  if (message.includes("Order not found or outside establishment")) {
    return new Error("Pedido não encontrado ou fora do seu estabelecimento.");
  }
  if (message.includes("Only admin can reopen")) {
    return new Error("Somente admin pode reabrir pedidos.");
  }
  if (message.includes("Only admin/operacao can cancel")) {
    return new Error("Você não tem permissão para cancelar pedido.");
  }
  if (message.includes("Direct status update is not allowed")) {
    return new Error(
      "Atualização direta de status bloqueada. Use o fluxo do sistema."
    );
  }

  return new Error(message);
}

/** membership do usuário logado */
export async function getMyMembership() {
  const ctx = await getActiveMembershipOrRedirect();
  return ctx;
}

/** cria pedido (versão simples, já usada na lista) */
export async function createOrder(): Promise<CreateOrderResult> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("orders")
    .insert({
      establishment_id: establishmentId,
      created_by: userData.user.id,
      customer_user_id: userData.user.id,
      status: "pedido_criado",
      notes: "Pedido criado via sistema",
    })
    .select("id, order_number, status, created_at")
    .single();

  if (error) throw new Error(error.message);

  // revalida lista
  revalidatePath("/dashboard/pedidos");

  return data as CreateOrderResult;
}

/**
 * ✅ cria pedido + itens de uma vez
 * usado na caixa de diálogo "Novo Pedido" com insumos
 */
export async function createOrderWithItems(
  params: {
    notes?: string | null;
    items: NewOrderItemInput[];
  }
): Promise<CreateOrderResult> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error("Not authenticated");

  const safeNotes =
    (params.notes ?? "").trim() ||
    "Pedido criado via sistema (itens adicionados na criação)";

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      establishment_id: establishmentId,
      created_by: userData.user.id,
      customer_user_id: userData.user.id,
      status: "pedido_criado",
      notes: safeNotes,
    })
    .select("id, order_number, status, created_at")
    .single();

  if (orderErr || !order) {
    throw new Error(orderErr?.message ?? "Erro ao criar pedido");
  }

  const rawValidItems =
    params.items?.filter(
      (it) =>
        it.product_name?.trim() &&
        it.unit_label?.trim() &&
        typeof it.quantity === "number" &&
        Number.isFinite(it.quantity) &&
        it.quantity > 0
    ) ?? [];

  const consolidated = new Map<
    string,
    { product_name: string; unit_label: string; quantity: number }
  >();

  for (const it of rawValidItems) {
    const product_name = it.product_name.trim();
    const unit_label = it.unit_label.trim().toUpperCase();
    const quantity = Number(it.quantity);

    const key = `${product_name.toLowerCase().trim()}__${unit_label}`;
    const existing = consolidated.get(key);

    if (!existing) {
      consolidated.set(key, { product_name, unit_label, quantity });
    } else {
      consolidated.set(key, {
        ...existing,
        quantity: Number(existing.quantity ?? 0) + quantity,
      });
    }
  }

  const validItems = Array.from(consolidated.values());

  if (validItems.length > 0) {
    const payload = validItems.map((it) => ({
      order_id: order.id,
      establishment_id: establishmentId,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_label: it.unit_label,
    }));

    const { error: itemsErr } = await supabase
      .from("order_line_items")
      .insert(payload);

    if (itemsErr) {
      console.error("Erro ao criar itens do pedido:", itemsErr);
      throw new Error(
        "Pedido criado, mas houve erro ao salvar os itens: " + itemsErr.message
      );
    }
  }

  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${order.id}`);

  await dispatchOrderLifecycleAlert({
    establishmentId,
    orderId: String(order.id),
    orderNumber: order.order_number ?? null,
    title: "Novo pedido criado",
    message: `O pedido #${order.order_number ?? "—"} foi criado e está aguardando aceite.`,
    type: "info",
    toStatus: "pedido_criado",
  });

  return order as CreateOrderResult;
}

/** lista pedidos */
export async function listOrders(): Promise<OrderListItem[]> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, created_at, notes")
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderListItem[];
}

/** detalhe do pedido */
export async function getOrderById(
  orderId: string
): Promise<OrderDetails | null> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, notes, accepted_by, accepted_at, canceled_by, canceled_at, cancel_reason, reopened_by, reopened_at"
    )
    .eq("id", orderId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (error) {
    console.error("getOrderById: erro ao buscar pedido:", {
      error,
      orderId,
      establishmentId,
    });
    return null;
  }

  if (!data) {
    console.warn("getOrderById: pedido não encontrado ou sem acesso", {
      orderId,
      establishmentId,
    });
    return null;
  }

  return data as OrderDetails;
}

/** timeline */
export async function getOrderTimeline(
  orderId: string
): Promise<OrderTimelineEvent[]> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("establishment_id", establishmentId)
    .single();

  if (orderErr || !order) throw new Error("Pedido não encontrado ou sem acesso.");

  const { data, error } = await supabase
    .from("order_status_events")
    .select(
      "id, from_status, to_status, client_label, visible_to_client, created_at, note"
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as OrderTimelineEvent[];

  const seen = new Set<string>();
  const unique = rows.filter((ev) => {
    const key = [
      ev.from_status ?? "",
      ev.to_status ?? "",
      ev.note ?? "",
      ev.created_at ?? "",
      ev.client_label ?? "",
      ev.visible_to_client ? "1" : "0",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique as OrderTimelineEvent[];
}

/** lista itens do pedido (tabela antiga, usada na tela de detalhes) */
export async function listOrderItems(
  orderId: string
): Promise<OrderLineItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("order_line_items")
    .select("id, order_id, product_name, quantity, unit_label")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderLineItem[];
}

/**
 * ✅ Adicionar item ao pedido (apenas enquanto o pedido está em rascunho)
 */
export async function addOrderItem(data: {
  order_id: string;
  product_name: string;
  quantity: number;
  unit_label: string;
}) {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status, establishment_id")
    .eq("id", data.order_id)
    .eq("establishment_id", establishmentId)
    .single();

  if (orderErr || !order) {
    throw new Error("Pedido não encontrado ou fora do seu estabelecimento.");
  }

  if (order.status !== "pedido_criado") {
    throw new Error(
      "Só é possível adicionar itens enquanto o pedido está em rascunho."
    );
  }

  const { error } = await supabase.from("order_line_items").insert({
    order_id: data.order_id,
    establishment_id: establishmentId,
    product_name: data.product_name,
    quantity: data.quantity,
    unit_label: String(data.unit_label ?? "").trim().toUpperCase(),
  });

  if (error) {
    console.error(error);
    throw new Error("Erro ao adicionar item ao pedido");
  }

  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${data.order_id}`);

  return { ok: true };
}

/**
 * ✅ Aceitar pedido
 *
 * Agora:
 *  - Copia itens de order_line_items -> order_items
 *  - Consulta Estoque Atual (current_stock) para decidir:
 *      * se quantity > estoque -> production_status = 'pending' (vai para Pendentes)
 *      * se quantity <= estoque -> production_status = 'done'   (vai para Pós-preparo)
 *  - Avança status do pedido para "aceitou_pedido" via RPC
 *  - Atualiza accepted_by / accepted_at
 */
export async function acceptOrder(orderId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  if (!["admin", "operacao", "producao"].includes(ctx.role)) {
    throw new Error("Sem permissão para aceitar pedido.");
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error("Not authenticated");

  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error("Pedido não encontrado ou sem acesso.");
  }

  if (order.status !== "pedido_criado") {
    throw new Error("Só é possível aceitar pedidos com status 'pedido_criado'.");
  }

  const { data: lineItems, error: itemsErr } = await supabase
    .from("order_line_items")
    .select("id, product_name, quantity")
    .eq("order_id", orderId);

  if (itemsErr) throw new Error(itemsErr.message);

  const consolidatedLineItemsMap = new Map<
    string,
    { product_name: string; quantity: number }
  >();

  for (const it of lineItems ?? []) {
    const pname = String((it as any).product_name ?? "").trim();
    const qty = Number((it as any).quantity ?? 0);

    if (!pname || !Number.isFinite(qty) || qty <= 0) continue;

    const key = pname.toLowerCase().trim();
    const existing = consolidatedLineItemsMap.get(key);

    if (!existing) {
      consolidatedLineItemsMap.set(key, { product_name: pname, quantity: qty });
    } else {
      consolidatedLineItemsMap.set(key, {
        product_name: existing.product_name,
        quantity: Number(existing.quantity ?? 0) + qty,
      });
    }
  }

  const safeLineItems = Array.from(consolidatedLineItemsMap.values());

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true);

  if (prodErr) {
    throw new Error(prodErr.message);
  }

  const productIdToName = new Map<string, string>(
    (products ?? []).map((p: any) => [String(p.id), String(p.name ?? "")])
  );

  const { data: stockRows, error: stockErr } = await supabase
    .from("current_stock")
    .select("product_id, qty_balance")
    .eq("establishment_id", establishmentId);

  if (stockErr) {
    throw new Error(stockErr.message);
  }

  const stockMap = new Map<string, number>();

  for (const row of stockRows ?? []) {
    const pid = String((row as any)?.product_id ?? "");
    const pname = String(productIdToName.get(pid) ?? "")
      .trim()
      .toLowerCase();

    if (!pname) continue;

    const qty = Number((row as any)?.qty_balance ?? 0);
    const safeQty = Number.isFinite(qty) ? qty : 0;

    stockMap.set(pname, (stockMap.get(pname) ?? 0) + safeQty);
  }

  const { error: delErr } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId);

  if (delErr && (delErr as any).code !== "PGRST116") {
    console.warn("Erro ao limpar order_items antigos:", (delErr as any).message);
  }

  const orderItemsPayload =
    safeLineItems.length === 0
      ? []
      : safeLineItems.map((item) => {
          const orderQty = Number(item.quantity);

          const currentStock =
            stockMap.get(String(item.product_name ?? "").trim().toLowerCase()) ??
            0;

          let production_status: string;
          let missing = 0;

          if (orderQty > currentStock) {
            missing = orderQty - currentStock;
            production_status = "pending";
          } else {
            production_status = "done";
          }

          return {
            order_id: orderId,
            product_name: item.product_name,
            qty: orderQty,
            production_status,
            production_missing_qty: missing,
          };
        });

  if (orderItemsPayload.length > 0) {
    const { error: insertErr } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (insertErr) throw new Error(insertErr.message);
  }

  const { error: rpcErr } = await supabase.rpc("advance_order_status", {
    p_order_id: orderId,
    p_to_status: "aceitou_pedido",
    p_note: "Pedido aceito",
  });

  if (rpcErr) throw normalizePgError(rpcErr);

  const { error: metaErr } = await supabase
    .from("orders")
    .update({
      accepted_by: userData.user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("establishment_id", establishmentId);

  if (metaErr) throw new Error(metaErr.message);

  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${orderId}`);
  revalidatePath("/dashboard/producao");

  await dispatchOrderLifecycleAlert({
    establishmentId,
    orderId,
    orderNumber: order.order_number ?? null,
    title: "Pedido aceito",
    message: `O pedido #${order.order_number ?? "—"} foi aceito e entrou no fluxo operacional.`,
    type: "success",
    fromStatus: "pedido_criado",
    toStatus: "aceitou_pedido",
  });
}

/**
 * ✅ Avançar status
 * Agora: chama RPC advance_order_status
 * Front sugere o próximo, banco valida anti-pulo + role + establishment
 */
export async function advanceOrder(orderId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const order = await getOrderById(orderId);

  if (!order) {
    throw new Error("Pedido não encontrado ou sem acesso.");
  }

  const next = nextStatus(order.status);
  if (!next) {
    throw new Error("Este pedido não pode ser avançado a partir do status atual.");
  }

  const { error: rpcErr } = await supabase.rpc("advance_order_status", {
    p_order_id: orderId,
    p_to_status: next,
    p_note: "Status avançado via sistema",
  });

  if (rpcErr) throw normalizePgError(rpcErr);

  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${orderId}`);

  await dispatchOrderLifecycleAlert({
    establishmentId,
    orderId,
    orderNumber: order.order_number ?? null,
    title: "Status do pedido avançado",
    message: `O pedido #${order.order_number ?? "—"} avançou de ${order.status} para ${next}.`,
    type: "info",
    fromStatus: order.status,
    toStatus: next,
  });
}

/**
 * ✅ Cancelar pedido
 * Agora: chama RPC cancel_order (status + timeline)
 * Depois: atualiza canceled_by/canceled_at/cancel_reason (sem mudar status)
 */
export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const role = ctx.role as Role;
  if (role === "cliente") {
    throw new Error("Sem permissão para cancelar pedido.");
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error("Not authenticated");

  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error("Pedido não encontrado ou sem acesso.");
  }

  if (["entregue", "cancelado"].includes(order.status)) {
    throw new Error("Não é possível cancelar nesta etapa.");
  }

  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Informe o motivo do cancelamento.");

  const { error: rpcErr } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_reason: trimmed,
  });

  if (rpcErr) throw normalizePgError(rpcErr);

  const { error: metaErr } = await supabase
    .from("orders")
    .update({
      canceled_by: userData.user.id,
      canceled_at: new Date().toISOString(),
      cancel_reason: trimmed,
    })
    .eq("id", orderId)
    .eq("establishment_id", establishmentId);

  if (metaErr) throw new Error(metaErr.message);

  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${orderId}`);

  await dispatchOrderLifecycleAlert({
    establishmentId,
    orderId,
    orderNumber: order.order_number ?? null,
    title: "Pedido cancelado",
    message: `O pedido #${order.order_number ?? "—"} foi cancelado. Motivo: ${trimmed}`,
    type: "error",
    fromStatus: order.status,
    toStatus: "cancelado",
  });
}

/**
 * ✅ Reabrir pedido (cancelado -> aceitou_pedido)
 * Agora: chama RPC reopen_order (status + timeline)
 * Depois: atualiza reopened_by/reopened_at (sem mudar status)
 *
 * OBS: no banco deixamos "só admin". Aqui também deixo só admin pra UX.
 */
export async function reopenOrder(
  orderId: string,
  note?: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  if (ctx.role !== "admin") {
    throw new Error("Sem permissão para reabrir pedido.");
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error("Not authenticated");

  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error("Pedido não encontrado ou sem acesso.");
  }

  if (order.status !== "cancelado") {
    throw new Error("Só é possível reabrir pedidos com status 'cancelado'.");
  }

  const trimmed = (note ?? "").trim();

  const { error: rpcErr } = await supabase.rpc("reopen_order", {
    p_order_id: orderId,
    p_note: trimmed ? `Reaberto: ${trimmed}` : "Pedido reaberto",
  });

  if (rpcErr) throw normalizePgError(rpcErr);

  const { error: metaErr } = await supabase
    .from("orders")
    .update({
      reopened_by: userData.user.id,
      reopened_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("establishment_id", establishmentId);

  if (metaErr) throw new Error(metaErr.message);

  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${orderId}`);

  await dispatchOrderLifecycleAlert({
    establishmentId,
    orderId,
    orderNumber: order.order_number ?? null,
    title: "Pedido reaberto",
    message: `O pedido #${order.order_number ?? "—"} foi reaberto e voltou ao fluxo.`,
    type: "warning",
    fromStatus: "cancelado",
    toStatus: "aceitou_pedido",
  });
}

/* ===========================================================
   ✅ RESUMO DE ITENS COLETADOS PARA O PEDIDO
   - Lê order_items_labels + inventory_labels + products
   - Agrupa por produto + unidade
   - Agora já traz custo padrão (products.standard_cost)
=========================================================== */

export async function getOrderCollectedSummary(
  orderId: string
): Promise<OrderCollectedSummary> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, establishment_id")
    .eq("id", orderId)
    .eq("establishment_id", establishmentId)
    .single();

  if (orderErr || !order) {
    throw new Error("Pedido não encontrado ou fora do seu estabelecimento.");
  }

  const { data: links, error: linksErr } = await supabase
    .from("order_items_labels")
    .select(
      `
      qty_used,
      unit_label,
      inventory_labels (
        id,
        product_id,
        unit_label,
        products (
          name,
          standard_cost,
          default_unit_label
        )
      )
    `
    )
    .eq("order_id", orderId);

  if (linksErr) {
    console.error(
      "getOrderCollectedSummary: erro ao carregar vínculos:",
      linksErr
    );
    throw new Error("Erro ao carregar itens coletados do pedido.");
  }

  const rows = (links ?? []) as any[];

  type GroupKey = string;
  const groups = new Map<
    GroupKey,
    {
      product_name: string;
      unit_label: string;
      total_qty: number;
      unit_cost: number | null;
      total_cost: number | null;
    }
  >();

  for (const row of rows) {
    const inv = row.inventory_labels as any;
    const prod = inv?.products as any | undefined;

    const productName =
      prod?.name ?? inv?.product_name ?? "(Produto não identificado)";

    const labelUnit =
      row.unit_label ?? inv?.unit_label ?? inv?.default_unit_label ?? "";

    const qtyRaw = Number(row.qty_used ?? 0);
    const qty = Number.isFinite(qtyRaw) ? qtyRaw : 0;

    const standardCostRaw = prod?.standard_cost;
    const standardCost =
      typeof standardCostRaw === "number"
        ? standardCostRaw
        : standardCostRaw !== null && standardCostRaw !== undefined
          ? Number(standardCostRaw)
          : null;

    const safeUnit = String(labelUnit ?? "").trim().toUpperCase();

    const key =
      productName.toLowerCase().trim() + "|" + safeUnit.toLowerCase().trim();

    const existing = groups.get(key);

    if (!existing) {
      const unitCost = standardCost;
      const totalCost = unitCost !== null ? unitCost * qty : null;

      groups.set(key, {
        product_name: productName,
        unit_label: safeUnit,
        total_qty: qty,
        unit_cost: unitCost,
        total_cost: totalCost,
      });
    } else {
      existing.total_qty += qty;

      if (existing.unit_cost !== null) {
        existing.total_cost = existing.unit_cost * existing.total_qty;
      } else {
        existing.total_cost = null;
      }
    }
  }

  const items: OrderCollectedSummaryItem[] = [];

  for (const g of groups.values()) {
    items.push({
      product_name: g.product_name,
      unit_label: g.unit_label,
      total_qty: g.total_qty,
      unit_cost: g.unit_cost,
      total_cost: g.total_cost,
    });
  }

  const total_qty = items.reduce((acc, it) => acc + it.total_qty, 0);

  const total_cost =
    items.length > 0
      ? items.reduce((acc, it) => {
          if (it.total_cost === null || isNaN(it.total_cost)) return acc;
          return acc + it.total_cost;
        }, 0)
      : null;

  return {
    order_id: orderId,
    items,
    total_qty,
    total_cost,
  };
}

/* ===========================================================
   ✅ Helpers para leitura do QR da ETIQUETA na tela de PEDIDOS
   - O campo recebe o texto bruto do QR (JSON ou apenas o código)
   - Aqui extraímos somente o label_code (lt) para consultar o banco
=========================================================== */

function extractLabelCodeFromQr(raw: string): string {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "";

  try {
    const obj = JSON.parse(cleaned) as any;
    const rawCode =
      obj.label_code ||
      obj.labelCode ||
      obj.lt ||
      obj.code ||
      obj.lc;

    if (typeof rawCode === "string" && rawCode.trim().length > 0) {
      return rawCode.trim();
    }
  } catch {
    // se não for JSON, seguimos com o texto puro
  }

  return cleaned;
}

/* ===========================================================
   ✅ VINCULAR ETIQUETA AO PEDIDO (SEPARAÇÃO / ESTOQUE)
   - Lê a etiqueta (inventory_labels) pelo label_code
   - Garante estabelecimento
   - Verifica saldo (qty - used_qty)
   - Cria movimento de estoque (inventory_movements, OUT_ORDER)
   - Cria vínculo em order_items_labels
   - Atualiza used_qty/status da etiqueta
=========================================================== */

export async function linkLabelToOrder(
  input: LinkLabelToOrderInput
): Promise<{
  ok: true;
  message: string;
  movementId: string;
  label: any;
  orderItemId: string | null;
  availableQtyBefore: number;
  availableQtyAfter: number;
  collectedSummary: OrderCollectedSummary;
}> {
  const { orderId, labelCode, qtyToUse } = input;

  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  if (!["admin", "operacao", "estoque", "producao"].includes(ctx.role)) {
    throw new Error("Sem permissão para vincular etiqueta ao pedido.");
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    throw new Error("Not authenticated");
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, establishment_id, order_number")
    .eq("id", orderId)
    .eq("establishment_id", establishmentId)
    .single();

  if (orderErr || !order) {
    throw new Error("Pedido não encontrado ou fora do seu estabelecimento.");
  }

  const finalLabelCode = extractLabelCodeFromQr(labelCode);
  if (!finalLabelCode) {
    throw new Error("Código de etiqueta inválido (QR vazio).");
  }

  const { data: label, error: labelError } = await supabase
    .from("inventory_labels")
    .select(
      `
      *,
      products (
        name
      )
    `
    )
    .eq("label_code", finalLabelCode)
    .eq("establishment_id", establishmentId)
    .single();

  if (labelError || !label) {
    throw new Error("Etiqueta não encontrada ou fora do seu estabelecimento.");
  }

  const status = (label as any).status as string;
  if (!["available", "ACTIVE"].includes(status)) {
    throw new Error("Etiqueta já utilizada ou cancelada.");
  }

  const totalQty = Number((label as any).qty);
  const usedQty = Number((label as any).used_qty ?? 0);
  const availableQty = totalQty - usedQty;

  if (availableQty <= 0) {
    throw new Error("Etiqueta sem saldo disponível.");
  }

  const qty = qtyToUse ? Number(qtyToUse) : availableQty;

  if (qty <= 0) {
    throw new Error("Quantidade informada para uso é inválida.");
  }

  if (qty > availableQty) {
    throw new Error(
      `Quantidade (${qty}) maior que o saldo disponível da etiqueta (${availableQty}).`
    );
  }

  const productNameFromLabel =
    ((label as any).products?.name as string | undefined) ?? null;

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("id, product_name, qty")
    .eq("order_id", orderId);

  const matchingItem =
    orderItems && productNameFromLabel
      ? orderItems.find(
          (it) =>
            it.product_name?.toLowerCase().trim() ===
            productNameFromLabel.toLowerCase().trim()
        ) ?? null
      : null;

  const { data: movement, error: movError } = await supabase
    .from("inventory_movements")
    .insert({
      establishment_id: establishmentId,
      product_id: (label as any).product_id ?? null,
      label_id: (label as any).id,
      order_id: orderId,
      movement_type: "OUT_ORDER",
      direction: "OUT",
      qty,
      unit_label: String((label as any).unit_label ?? "").trim().toUpperCase(),
      details: {
        label_code: (label as any).label_code,
        from: "ORDER_SEPARATION",
        order_number: order.order_number,
      },
      created_by: userData.user.id,
    })
    .select("id")
    .single();

  if (movError || !movement) {
    throw new Error("Erro ao registrar movimento de estoque.");
  }

  const { error: linkError } = await supabase
    .from("order_items_labels")
    .insert({
      order_id: orderId,
      order_item_id: matchingItem?.id ?? null,
      label_id: (label as any).id,
      qty_used: qty,
      unit_label: String((label as any).unit_label ?? "").trim().toUpperCase(),
    });

  if (linkError) {
    throw new Error("Erro ao vincular etiqueta ao pedido.");
  }

  const newUsed = usedQty + qty;
  const newStatus = newUsed >= totalQty ? "used" : "available";

  const { error: updError } = await supabase
    .from("inventory_labels")
    .update({
      used_qty: newUsed,
      status: newStatus,
    })
    .eq("id", (label as any).id);

  if (updError) {
    throw new Error("Erro ao atualizar status da etiqueta.");
  }

  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${orderId}`);

  const collectedSummary = await getOrderCollectedSummary(orderId);

  if ((label as any).product_id) {
    await dispatchLowStockAlertsForProducts({
      establishmentId,
      productIds: [String((label as any).product_id)],
      source: "order_separation",
    });
  }

  return {
    ok: true,
    message: "Produto coletado!",
    movementId: movement.id as string,
    label: {
      ...label,
      used_qty: newUsed,
      status: newStatus,
    },
    orderItemId: matchingItem?.id ?? null,
    availableQtyBefore: availableQty,
    availableQtyAfter: availableQty - qty,
    collectedSummary,
  };
}

/* ===========================================================
   🧾 PRÉ-FATURAMENTO / PRÉ-NOTA
   - Lê e salva rascunhos na tabela order_billing_drafts
   - Agora com frete e transportadora
   - Usado quando o pedido está em "em_faturamento"
=========================================================== */

/**
 * Lê rascunho da pré-nota para um pedido (se existir)
 */
export async function getOrderBillingDraft(
  orderId: string
): Promise<OrderBillingDraft | null> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("establishment_id", establishmentId)
    .single();

  if (orderErr || !order) {
    throw new Error("Pedido não encontrado ou fora do seu estabelecimento.");
  }

  const { data, error } = await supabase
    .from("order_billing_drafts")
    .select(
      `
      id,
      order_id,
      establishment_id,
      subtotal,
      markup_percent,
      total_with_markup,
      freight_value,
      carrier_id,
      created_at,
      updated_at
    `
    )
    .eq("order_id", orderId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (error) {
    console.error("getOrderBillingDraft erro:", error);
    throw new Error("Erro ao carregar rascunho de pré-nota.");
  }

  if (!data) return null;

  return data as OrderBillingDraft;
}

/**
 * Salva / atualiza rascunho da pré-nota para o pedido
 * Agora aceita também frete e transportadora
 */
export async function saveOrderBillingDraft(input: {
  orderId: string;
  subtotal: number;
  markupPercent: number;
  totalWithMarkup: number;
  freightValue?: number | null;
  carrierId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", input.orderId)
    .eq("establishment_id", establishmentId)
    .single();

  if (orderErr || !order) {
    throw new Error("Pedido não encontrado ou fora do seu estabelecimento.");
  }

  if (order.status !== "em_faturamento") {
    throw new Error(
      "Rascunho de pré-nota só pode ser salvo quando o pedido estiver em faturamento."
    );
  }

  const payload = {
    order_id: input.orderId,
    establishment_id: establishmentId,
    subtotal: input.subtotal ?? 0,
    markup_percent: input.markupPercent ?? 0,
    total_with_markup: input.totalWithMarkup ?? 0,
    freight_value:
      input.freightValue !== undefined && input.freightValue !== null
        ? input.freightValue
        : null,
    carrier_id:
      input.carrierId !== undefined && input.carrierId !== null
        ? input.carrierId
        : null,
  };

  const { error } = await supabase
    .from("order_billing_drafts")
    .upsert(payload, { onConflict: "order_id" });

  if (error) {
    console.error("saveOrderBillingDraft erro:", error);
    throw new Error("Erro ao salvar rascunho de pré-nota.");
  }

  revalidatePath(`/dashboard/pedidos/${input.orderId}`);

  return { ok: true };
}

/* ===========================================================
   🚚 LISTAR TRANSPORTADORAS (CARRIERS)
   - Usado para preencher o select de transportadora no faturamento
=========================================================== */

export async function listCarriers(): Promise<Carrier[]> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data, error } = await supabase
    .from("carriers")
    .select("id, name, is_active")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    const code = (error as any)?.code;

    if (code === "PGRST205") {
      console.warn(
        "listCarriers: tabela public.carriers não existe ainda; retornando lista vazia."
      );
      return [];
    }

    console.error("listCarriers erro:", error);
    throw new Error("Erro ao carregar transportadoras.");
  }

  return (data ?? []) as Carrier[];
}