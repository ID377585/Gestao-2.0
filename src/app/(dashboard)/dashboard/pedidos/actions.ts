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

function normalizeTimelineFingerprintValue(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function getTimelineEventFingerprint(event: {
  from_status: string | null;
  to_status: string;
  note: string | null;
  visible_to_client: boolean;
  created_at: string;
}) {
  return [
    normalizeTimelineFingerprintValue(event.from_status),
    normalizeTimelineFingerprintValue(event.to_status),
    normalizeTimelineFingerprintValue(event.note),
    event.visible_to_client ? "1" : "0",
    normalizeTimelineFingerprintValue(event.created_at),
  ].join("|");
}

function preferTimelineEvent(
  current: OrderTimelineEvent,
  incoming: OrderTimelineEvent
) {
  const currentLabel = normalizeTimelineFingerprintValue(current.client_label);
  const incomingLabel = normalizeTimelineFingerprintValue(incoming.client_label);

  if (!currentLabel && incomingLabel) return incoming;
  if (currentLabel && !incomingLabel) return current;

  if (incomingLabel.length > currentLabel.length) return incoming;
  return current;
}

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
  base_cost: number;
  items: any;
  subtotal: number;
  markup_percent: number;
  total_value: number;
  total_with_markup: number;
  freight_value: number | null;
  carrier_id: string | null;
  created_by: string;
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

  const { data, error } = await supabase
    .rpc("create_order_with_items", {
      p_establishment_id: establishmentId,
      p_notes: "Pedido criado via sistema",
      p_items: [],
    })
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

  const safeNotes =
    (params.notes ?? "").trim() ||
    "Pedido criado via sistema (itens adicionados na criação)";

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

  const { data: createdOrders, error: createErr } = await supabase.rpc(
    "create_order_with_items",
    {
      p_establishment_id: establishmentId,
      p_notes: safeNotes,
      p_items: validItems,
    }
  );

  if (createErr) {
    throw normalizePgError(createErr);
  }

  const order = Array.isArray(createdOrders) ? createdOrders[0] : createdOrders;

  if (!order) {
    throw new Error("Erro ao criar pedido.");
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
  const dedupedByFingerprint = new Map<string, OrderTimelineEvent>();

  for (const row of rows) {
    const fingerprint = getTimelineEventFingerprint(row);
    const existing = dedupedByFingerprint.get(fingerprint);

    if (!existing) {
      dedupedByFingerprint.set(fingerprint, row);
      continue;
    }

    dedupedByFingerprint.set(
      fingerprint,
      preferTimelineEvent(existing, row)
    );
  }

  return Array.from(dedupedByFingerprint.values()).sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
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
 *  - Chama a RPC transacional accept_order(_order_id)
 *  - O banco centraliza cópia de itens, estoque, unidade, status e metadados
 */
export async function acceptOrder(orderId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  if (!["admin", "operacao", "producao"].includes(ctx.role)) {
    throw new Error("Sem permissão para aceitar pedido.");
  }

  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error("Pedido não encontrado ou sem acesso.");
  }

  if (order.status !== "pedido_criado") {
    throw new Error("Só é possível aceitar pedidos com status 'pedido_criado'.");
  }

  const { error: rpcErr } = await supabase.rpc("accept_order", {
    _order_id: orderId,
  });

  if (rpcErr) throw normalizePgError(rpcErr);

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
   - Extrai o label_code
   - Delega vínculo, movimento e saldo para separate_label_for_order
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

  if (qtyToUse !== undefined && qtyToUse !== null) {
    throw new Error(
      "Separação parcial de etiqueta deve ser implementada na RPC antes de ser usada pelo app."
    );
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

  const { data: labels, error: rpcError } = await supabase.rpc(
    "separate_label_for_order",
    {
      p_label_code: finalLabelCode,
      p_order_id: orderId,
      p_user_id: userData.user.id,
    }
  );

  if (rpcError) {
    throw normalizePgError(rpcError);
  }

  const label = Array.isArray(labels) ? labels[0] : labels;

  if (!label) {
    throw new Error("Nenhuma etiqueta foi atualizada pela operação.");
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
    movementId: String((label as any).movement_id ?? ""),
    label,
    orderItemId: null,
    availableQtyBefore: Number((label as any).qty ?? 0),
    availableQtyAfter: Number((label as any).qty_balance ?? 0),
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
      base_cost,
      items,
      subtotal,
      markup_percent,
      total_value,
      total_with_markup,
      freight_value,
      carrier_id,
      created_by,
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
  const { data: userData, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userData?.user) {
    throw new Error("Not authenticated");
  }

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

  const collectedSummary = await getOrderCollectedSummary(input.orderId);
  const freightValue =
    input.freightValue !== undefined && input.freightValue !== null
      ? input.freightValue
      : 0;
  const totalWithMarkup = input.totalWithMarkup ?? 0;

  const payload = {
    order_id: input.orderId,
    establishment_id: establishmentId,
    subtotal: input.subtotal ?? 0,
    base_cost: collectedSummary.total_cost ?? input.subtotal ?? 0,
    items: collectedSummary.items,
    markup_percent: input.markupPercent ?? 0,
    total_with_markup: totalWithMarkup,
    total_value: totalWithMarkup + freightValue,
    freight_value: freightValue,
    carrier_id:
      input.carrierId !== undefined && input.carrierId !== null
        ? input.carrierId
        : null,
    created_by: userData.user.id,
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
   🚚 LISTAR TRANSPORTADORAS (SHIPPING_CARRIERS)
   - Usado para preencher o select de transportadora no faturamento
=========================================================== */

export async function listCarriers(): Promise<Carrier[]> {
  const supabase = await createSupabaseServerClient();
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = getScopeId(ctx);

  const { data, error } = await supabase
    .from("shipping_carriers")
    .select("id, name")
    .eq("establishment_id", establishmentId)
    .order("name", { ascending: true });

  if (error) {
    const code = (error as any)?.code;

    if (code === "PGRST205") {
      console.warn(
        "listCarriers: tabela public.shipping_carriers não existe ainda; retornando lista vazia."
      );
      return [];
    }

    console.error("listCarriers erro:", error);
    throw new Error("Erro ao carregar transportadoras.");
  }

  return (data ?? []).map((carrier) => ({
    id: carrier.id,
    name: carrier.name,
    is_active: true,
  }));
}
