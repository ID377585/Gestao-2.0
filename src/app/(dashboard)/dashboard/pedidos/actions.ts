"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

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

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * ✅ O seu getActiveMembershipOrRedirect() (pelo erro do TS) está retornando algo como:
 * { user, membership, role, orgId, unitId }
 *
 * Então aqui normalizamos SEM quebrar seu código:
 * - role: vem de ctx.role (preferência) ou ctx.membership.role
 * - establishment_id: vem de ctx.membership.establishment_id (se existir) e, se não existir,
 *   caímos para unitId (útil enquanto você migra o modelo).
 */
type MembershipCtx = {
  user?: any;
  membership?: any;
  role?: Role;
  orgId?: string | null;
  unitId?: string | null;
};

function getRoleFromCtx(ctx: MembershipCtx): Role {
  const r = (ctx.role ?? ctx.membership?.role) as Role | undefined;
  if (!r) throw new Error("Membership sem role (inconsistência).");
  return r;
}

function getScopeIdFromCtx(ctx: MembershipCtx): string {
  // 1) modelo antigo: establishment_id dentro do membership
  const est =
    ctx.membership?.establishment_id ??
    ctx.membership?.establishmentId ??
    null;

  if (typeof est === "string" && est.length > 0) return est;

  // 2) fallback para unitId (modelo novo). Serve enquanto você migra.
  const unit =
    ctx.unitId ?? ctx.membership?.unit_id ?? ctx.membership?.unitId ?? null;

  if (typeof unit === "string" && unit.length > 0) return unit;

  throw new Error(
    "Membership sem establishment_id e sem unitId. Verifique seu get-membership e o cadastro na tabela."
  );
}

/** registra evento na timeline oficial (order_status_events) */
async function logStatusEvent(params: {
  supabase: SupabaseServerClient;
  order_id: string;
  from_status: string | null;
  to_status: string;
  note?: string | null;
  client_label?: string | null;
  visible_to_client?: boolean;
}) {
  const { supabase, ...payload } = params;

  const { error } = await supabase.from("order_status_events").insert({
    order_id: payload.order_id,
    from_status: payload.from_status,
    to_status: payload.to_status,
    note: payload.note ?? null,
    client_label: payload.client_label ?? null,
    visible_to_client: payload.visible_to_client ?? false,
  });

  if (error) throw new Error(error.message);
}

/** membership do usuário logado */
export async function getMyMembership() {
  const ctx = (await getActiveMembershipOrRedirect()) as MembershipCtx;
  return ctx;
}

/** cria pedido */
export async function createOrder(): Promise<CreateOrderResult> {
  const supabase = await createSupabaseServerClient();

  // ✅ garante auth + membership ativo
  const ctx = (await getActiveMembershipOrRedirect()) as MembershipCtx;

  // ✅ se você ainda quiser pegar o user_id para created_by:
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error("Not authenticated");

  // ✅ escopo (preferindo establishment_id; fallback unitId)
  const establishmentId = getScopeIdFromCtx(ctx);

  const { data, error } = await supabase
    .from("orders")
    .insert({
      // ⚠️ Mantém o nome da coluna do seu banco (establishment_id)
      establishment_id: establishmentId,
      created_by: userData.user.id,
      customer_user_id: userData.user.id,
      status: "pedido_criado",
      notes: "Pedido criado via sistema",
    })
    .select("id, order_number, status, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as CreateOrderResult;
}

/** lista pedidos */
export async function listOrders(): Promise<OrderListItem[]> {
  const supabase = await createSupabaseServerClient();
  const ctx = (await getActiveMembershipOrRedirect()) as MembershipCtx;

  const establishmentId = getScopeIdFromCtx(ctx);

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, created_at, notes")
    .eq("establishment_id", establishmentId) // ok manter (mesmo com RLS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderListItem[];
}

/** detalhe do pedido */
export async function getOrderById(orderId: string): Promise<OrderDetails> {
  const supabase = await createSupabaseServerClient();
  const ctx = (await getActiveMembershipOrRedirect()) as MembershipCtx;

  const establishmentId = getScopeIdFromCtx(ctx);

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, notes, accepted_by, accepted_at, canceled_by, canceled_at, cancel_reason, reopened_by, reopened_at"
    )
    .eq("id", orderId)
    .eq("establishment_id", establishmentId)
    .single();

  if (error || !data) throw new Error("Pedido não encontrado ou sem acesso.");
  return data as OrderDetails;
}

/** timeline */
export async function getOrderTimeline(
  orderId: string
): Promise<OrderTimelineEvent[]> {
  const supabase = await createSupabaseServerClient();
  const ctx = (await getActiveMembershipOrRedirect()) as MembershipCtx;

  const establishmentId = getScopeIdFromCtx(ctx);

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
  return (data ?? []) as OrderTimelineEvent[];
}

/** aceitar pedido */
export async function acceptOrder(orderId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const ctx = (await getActiveMembershipOrRedirect()) as MembershipCtx;

  const role = getRoleFromCtx(ctx);
  const establishmentId = getScopeIdFromCtx(ctx);

  if (!["admin", "operacao", "producao"].includes(role)) {
    throw new Error("Sem permissão para aceitar pedido.");
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const order = await getOrderById(orderId);
  if (order.status !== "pedido_criado") {
    throw new Error("Só é possível aceitar pedidos com status 'pedido_criado'.");
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "aceitou_pedido",
      accepted_by: userData.user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("establishment_id", establishmentId);

  if (error) throw new Error(error.message);

  await logStatusEvent({
    supabase,
    order_id: orderId,
    from_status: "pedido_criado",
    to_status: "aceitou_pedido",
    note: "Pedido aceito",
    client_label: "Pedido aceito",
    visible_to_client: true,
  });
}

/** avançar status */
export async function advanceOrder(orderId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const ctx = (await getActiveMembershipOrRedirect()) as MembershipCtx;

  const role = getRoleFromCtx(ctx);
  const isAdmin = role === "admin";
  const establishmentId = getScopeIdFromCtx(ctx);

  const order = await getOrderById(orderId);

  const canAdvance =
    (["aceitou_pedido", "em_preparo"].includes(order.status) &&
      (isAdmin || ["operacao", "producao"].includes(role))) ||
    (order.status === "em_separacao" &&
      (isAdmin || ["operacao", "producao", "estoque"].includes(role))) ||
    (order.status === "em_faturamento" &&
      (isAdmin || ["estoque", "fiscal"].includes(role))) ||
    (order.status === "em_transporte" &&
      (isAdmin || ["entrega", "fiscal"].includes(role)));

  if (!canAdvance) {
    throw new Error("Sem permissão para avançar o status neste momento.");
  }

  const next = nextStatus(order.status);
  if (!next) {
    throw new Error(
      "Este pedido não pode ser avançado a partir do status atual."
    );
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: next })
    .eq("id", orderId)
    .eq("establishment_id", establishmentId);

  if (error) throw new Error(error.message);

  await logStatusEvent({
    supabase,
    order_id: orderId,
    from_status: order.status,
    to_status: next,
    note: "Status avançado via sistema",
  });
}

/** cancelar pedido */
export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const ctx = (await getActiveMembershipOrRedirect()) as MembershipCtx;

  const role = getRoleFromCtx(ctx);
  const establishmentId = getScopeIdFromCtx(ctx);

  if (role === "cliente") {
    throw new Error("Sem permissão para cancelar pedido.");
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const order = await getOrderById(orderId);
  if (["entregue", "cancelado"].includes(order.status)) {
    throw new Error("Não é possível cancelar nesta etapa.");
  }

  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Informe o motivo do cancelamento.");

  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelado",
      canceled_by: userData.user.id,
      canceled_at: new Date().toISOString(),
      cancel_reason: trimmed,
    })
    .eq("id", orderId)
    .eq("establishment_id", establishmentId);

  if (error) throw new Error(error.message);

  await logStatusEvent({
    supabase,
    order_id: orderId,
    from_status: order.status,
    to_status: "cancelado",
    note: `Cancelado: ${trimmed}`,
    client_label: "Pedido cancelado",
    visible_to_client: true,
  });
}

/** 🔁 reabrir pedido (cancelado -> aceitou_pedido) */
export async function reopenOrder(
  orderId: string,
  note?: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const ctx = (await getActiveMembershipOrRedirect()) as MembershipCtx;

  const role = getRoleFromCtx(ctx);
  const establishmentId = getScopeIdFromCtx(ctx);

  if (!["admin", "operacao", "producao"].includes(role)) {
    throw new Error("Sem permissão para reabrir pedido.");
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Not authenticated");

  const order = await getOrderById(orderId);
  if (order.status !== "cancelado") {
    throw new Error("Só é possível reabrir pedidos com status 'cancelado'.");
  }

  const trimmed = (note ?? "").trim();

  const { error } = await supabase
    .from("orders")
    .update({
      status: "aceitou_pedido",
      reopened_by: userData.user.id,
      reopened_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("establishment_id", establishmentId);

  if (error) throw new Error(error.message);

  await logStatusEvent({
    supabase,
    order_id: orderId,
    from_status: "cancelado",
    to_status: "aceitou_pedido",
    note: trimmed ? `Reaberto: ${trimmed}` : "Pedido reaberto",
    client_label: "Pedido reaberto",
    visible_to_client: true,
  });
}
