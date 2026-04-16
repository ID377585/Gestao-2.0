import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  buildAlertEventKey,
  dispatchAlert,
  resolveAdminAndOperationRecipients,
  resolveRecipientsByRoles,
} from "@/lib/alerts/dispatch";

type StockAlertStatus = "critico" | "baixo" | "normal";

type StockAlertRow = {
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  unitLabel: string;
  minQty: number;
  medQty: number;
  maxQty: number;
  location: string | null;
  status: StockAlertStatus;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "ENV ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeUnit(value: unknown, fallback = "UN") {
  const unit = String(value ?? "").trim().toUpperCase();
  return unit || fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getStockStatus(quantity: number, minQty: number, medQty: number): StockAlertStatus {
  if (quantity < minQty) return "critico";
  if (quantity < medQty) return "baixo";
  return "normal";
}

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    ""
  );
}

function buildAbsoluteAppUrl(path?: string | null) {
  const base = getAppBaseUrl();
  const safePath = String(path ?? "").trim();

  if (!safePath) return null;
  if (!base) return safePath;

  return `${base}${safePath.startsWith("/") ? safePath : `/${safePath}`}`;
}

async function listStockAlertRows(params: {
  establishmentId: string;
  productIds?: string[];
}): Promise<StockAlertRow[]> {
  const supabaseAdmin = getSupabaseAdmin();

  let balancesQuery = supabaseAdmin
    .from("stock_balances")
    .select(
      `
      product_id,
      unit_label,
      min_qty,
      med_qty,
      max_qty,
      location,
      product:products!stock_balances_product_id_fkey (
        id,
        name,
        sku,
        default_unit_label
      )
    `
    )
    .eq("establishment_id", params.establishmentId);

  if (params.productIds?.length) {
    balancesQuery = balancesQuery.in("product_id", params.productIds);
  }

  const { data: balances, error: balancesError } = await balancesQuery;

  if (balancesError) {
    console.error("Erro ao buscar saldos/metadados para alerta de estoque:", balancesError);
    throw new Error("Não foi possível carregar os dados de estoque para alertas.");
  }

  let currentStockQuery = supabaseAdmin
    .from("current_stock")
    .select("product_id, unit_label, qty_balance")
    .eq("establishment_id", params.establishmentId);

  if (params.productIds?.length) {
    currentStockQuery = currentStockQuery.in("product_id", params.productIds);
  }

  const { data: currentStock, error: currentStockError } = await currentStockQuery;

  if (currentStockError) {
    console.error("Erro ao buscar current_stock para alerta de estoque:", currentStockError);
    throw new Error("Não foi possível carregar o saldo real do estoque para alertas.");
  }

  const currentByProduct = new Map<
    string,
    { total: number; byUnit: Map<string, number> }
  >();

  for (const row of currentStock ?? []) {
    const productId = String((row as any).product_id);
    const unit = normalizeUnit((row as any).unit_label, "");
    const qty = toNumber((row as any).qty_balance, 0);

    if (!currentByProduct.has(productId)) {
      currentByProduct.set(productId, {
        total: 0,
        byUnit: new Map<string, number>(),
      });
    }

    const current = currentByProduct.get(productId)!;
    current.total += qty;
    current.byUnit.set(unit, (current.byUnit.get(unit) ?? 0) + qty);
  }

  return (balances ?? []).map((row: any) => {
    const rawProduct = row?.product;
    const product = Array.isArray(rawProduct) ? rawProduct[0] ?? null : rawProduct ?? null;

    const productId = String(row.product_id);
    const unitLabel = normalizeUnit(
      row.unit_label ?? product?.default_unit_label,
      "UN"
    );

    const stockEntry = currentByProduct.get(productId);
    const quantity =
      stockEntry?.byUnit.get(unitLabel) ??
      stockEntry?.total ??
      0;

    const minQty = toNumber(row.min_qty, 0);
    const medQty = toNumber(row.med_qty, 0);
    const maxQty = toNumber(row.max_qty, 0);

    return {
      productId,
      productName: String(product?.name ?? "Produto"),
      sku: product?.sku ? String(product.sku) : null,
      quantity,
      unitLabel,
      minQty,
      medQty,
      maxQty,
      location: row.location ? String(row.location) : null,
      status: getStockStatus(quantity, minQty, medQty),
    };
  });
}

export async function dispatchCollaboratorCreatedOrUpdatedAlert(params: {
  establishmentId: string;
  actorUserId: string;
  targetUserId: string;
  targetName: string;
  targetEmail?: string | null;
  role: string;
  sector?: string | null;
  mode: "created" | "updated";
}) {
  const recipients = await resolveAdminAndOperationRecipients(params.establishmentId);

  if (params.targetUserId && params.targetEmail) {
    recipients.push({
      userId: params.targetUserId,
      email: params.targetEmail ?? null,
      name: params.targetName ?? null,
    });
  }

  const titulo =
    params.mode === "created"
      ? "Colaborador criado"
      : "Colaborador alterado";

  const mensagem =
    params.mode === "created"
      ? `O colaborador ${params.targetName} foi cadastrado com papel ${params.role}${params.sector ? ` no setor ${params.sector}` : ""}.`
      : `O cadastro do colaborador ${params.targetName} foi atualizado para o papel ${params.role}${params.sector ? ` no setor ${params.sector}` : ""}.`;

  await dispatchAlert({
    recipients,
    titulo,
    mensagem,
    tipo: "info",
    href: buildAbsoluteAppUrl("/dashboard/admin/usuarios"),
    eventKey: buildAlertEventKey(
      "collaborator",
      params.mode,
      params.targetUserId
    ),
    entityType: "collaborator",
    entityId: params.targetUserId,
    metadata: {
      actorUserId: params.actorUserId,
      role: params.role,
      sector: params.sector ?? null,
    },
    sendEmail: true,
    emailSubject: titulo,
  });
}

export async function dispatchLowStockAlertsForProducts(params: {
  establishmentId: string;
  productIds?: string[];
  source:
    | "stock_movement"
    | "inventory_finalize"
    | "threshold_update"
    | "bulk_meta_update"
    | "order_separation";
}) {
  const recipients = await resolveRecipientsByRoles({
    establishmentId: params.establishmentId,
    roles: ["admin", "operacao", "estoque"],
  });

  const rows = await listStockAlertRows({
    establishmentId: params.establishmentId,
    productIds: params.productIds?.length ? params.productIds : undefined,
  });

  const alertRows = rows.filter((row) => row.status !== "normal");

  for (const row of alertRows) {
    const titulo =
      row.status === "critico"
        ? "Estoque crítico"
        : "Estoque baixo";

    const mensagem =
      row.status === "critico"
        ? `${row.productName} está abaixo do mínimo. Saldo: ${row.quantity} ${row.unitLabel}. Mínimo: ${row.minQty}.`
        : `${row.productName} está abaixo do nível médio. Saldo: ${row.quantity} ${row.unitLabel}. Médio: ${row.medQty}.`;

    await dispatchAlert({
      recipients,
      titulo,
      mensagem,
      tipo: row.status === "critico" ? "error" : "warning",
      href: buildAbsoluteAppUrl("/dashboard/estoque"),
      eventKey: buildAlertEventKey(
        "stock",
        row.status,
        row.productId
      ),
      entityType: "product",
      entityId: row.productId,
      metadata: {
        source: params.source,
        sku: row.sku,
        quantity: row.quantity,
        unitLabel: row.unitLabel,
        minQty: row.minQty,
        medQty: row.medQty,
        maxQty: row.maxQty,
        location: row.location,
      },
      sendEmail: true,
      emailSubject: titulo,
    });
  }

  return {
    checked: rows.length,
    alerted: alertRows.length,
  };
}

export async function dispatchOrderLifecycleAlert(params: {
  establishmentId: string;
  orderId: string;
  orderNumber?: number | null;
  title: string;
  message: string;
  type?: "info" | "warning" | "success" | "error";
  fromStatus?: string | null;
  toStatus?: string | null;
}) {
  const recipients = await resolveRecipientsByRoles({
    establishmentId: params.establishmentId,
    roles: ["admin", "operacao", "producao", "estoque", "fiscal", "entrega"],
  });

  await dispatchAlert({
    recipients,
    titulo: params.title,
    mensagem: params.message,
    tipo: params.type ?? "info",
    href: buildAbsoluteAppUrl(`/dashboard/pedidos/${params.orderId}`),
    eventKey: buildAlertEventKey(
      "order",
      params.orderId,
      params.toStatus ?? params.title
    ),
    entityType: "order",
    entityId: params.orderId,
    metadata: {
      orderNumber: params.orderNumber ?? null,
      fromStatus: params.fromStatus ?? null,
      toStatus: params.toStatus ?? null,
    },
    sendEmail: true,
    emailSubject: params.title,
  });
}

export async function dispatchOverdueOrderAlerts(params: {
  establishmentId: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, created_at, notes")
    .eq("establishment_id", params.establishmentId)
    .not("status", "in", '("cancelado","entregue")');

  if (error) {
    console.error("Erro ao buscar pedidos para atraso:", error);
    throw new Error("Não foi possível verificar pedidos atrasados.");
  }

  /**
   * REGRA TEMPORÁRIA:
   * como o fluxo atual não possui deadline_at / expected_delivery_at,
   * usamos SLA por status a partir de created_at.
   */
  const slaHoursByStatus: Record<string, number> = {
    pedido_criado: 2,
    aceitou_pedido: 4,
    em_preparo: 8,
    em_separacao: 12,
    em_faturamento: 16,
    em_transporte: 24,
  };

  let alerted = 0;

  for (const order of orders ?? []) {
    const status = String((order as any).status ?? "");
    const createdAt = String((order as any).created_at ?? "");

    if (!slaHoursByStatus[status] || !createdAt) continue;

    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) continue;

    const elapsedHours =
      (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);

    const allowedHours = slaHoursByStatus[status];

    if (elapsedHours < allowedHours) continue;

    await dispatchOrderLifecycleAlert({
      establishmentId: params.establishmentId,
      orderId: String((order as any).id),
      orderNumber:
        (order as any).order_number !== null &&
        (order as any).order_number !== undefined
          ? Number((order as any).order_number)
          : null,
      title: "Pedido atrasado",
      message: `O pedido #${(order as any).order_number ?? "—"} está em ${status} há mais de ${allowedHours}h. Revise o fluxo operacional.`,
      type: "warning",
      toStatus: "overdue",
    });

    alerted += 1;
  }

  return {
    checked: (orders ?? []).length,
    alerted,
  };
}