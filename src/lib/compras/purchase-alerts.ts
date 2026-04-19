import { calculateSupplierScore } from "@/lib/compras/supplier-score";
import { upsertPurchaseActionItem } from "@/lib/compras/purchase-action-queue";
import type {
  GoodsReceipt,
  PurchaseOrder,
  Supplier,
} from "@/types/compras";

export type PurchaseAlertType =
  | "fornecedor_critico"
  | "fornecedor_divergencia"
  | "fornecedor_sem_compra"
  | "pedido_atrasado";

export type PurchaseAlert = {
  id: string;
  type: PurchaseAlertType;
  severity: "alta" | "media" | "baixa";
  title: string;
  description: string;
  supplierId?: string;
  supplierName?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  days?: number;
};

function diffDays(from?: string, to?: string) {
  if (!from || !to) return null;

  const start = new Date(from);
  const end = new Date(to);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function buildPurchaseAlerts(params: {
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  receipts: GoodsReceipt[];
}) {
  const alerts: PurchaseAlert[] = [];
  const today = new Date().toISOString();

  for (const supplier of params.suppliers) {
    const supplierOrders = params.orders.filter(
      (item) => item.supplierId === supplier.id
    );

    const orderIds = supplierOrders.map((item) => item.id);

    const supplierReceipts = params.receipts.filter((item) =>
      orderIds.includes(item.purchaseOrderId)
    );

    const divergencias = supplierReceipts.filter(
      (item) => item.status === "divergencia"
    ).length;

    const leadTimes: number[] = [];

    for (const order of supplierOrders) {
      const firstReceipt = supplierReceipts
        .filter((item) => item.purchaseOrderId === order.id)
        .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))[0];

      const diff = diffDays(order.createdAt, firstReceipt?.createdAt);

      if (diff !== null) {
        leadTimes.push(diff);
      }
    }

    const leadTimeMedio =
      leadTimes.length > 0
        ? Math.round(leadTimes.reduce((acc, item) => acc + item, 0) / leadTimes.length)
        : 0;

    const score = calculateSupplierScore({
      totalPedidos: supplierOrders.length,
      valorTotalComprado: supplierOrders.reduce(
        (acc, item) => acc + Number(item.valorTotal || 0),
        0
      ),
      recebimentosComDivergencia: divergencias,
      totalRecebimentos: supplierReceipts.length,
      leadTimeMedio,
    });

    if (score.selo === "critico") {
      alerts.push({
        id: `fornecedor_critico_${supplier.id}`,
        type: "fornecedor_critico",
        severity: "alta",
        title: "Fornecedor com score crítico",
        description: `${supplier.razaoSocial} está com score ${score.score}.`,
        supplierId: supplier.id,
        supplierName: supplier.razaoSocial,
      });
    }

    if (supplierReceipts.length >= 3 && divergencias >= 2) {
      alerts.push({
        id: `fornecedor_divergencia_${supplier.id}`,
        type: "fornecedor_divergencia",
        severity: divergencias >= 4 ? "alta" : "media",
        title: "Fornecedor com aumento de divergências",
        description: `${supplier.razaoSocial} teve ${divergencias} recebimento(s) com divergência.`,
        supplierId: supplier.id,
        supplierName: supplier.razaoSocial,
      });
    }

    const ultimoPedido = supplierOrders
      .map((item) => item.createdAt || "")
      .sort((a, b) => b.localeCompare(a))[0];

    const diasSemCompra = diffDays(ultimoPedido, today);

    if (supplierOrders.length > 0 && diasSemCompra !== null && diasSemCompra >= 60) {
      alerts.push({
        id: `fornecedor_sem_compra_${supplier.id}`,
        type: "fornecedor_sem_compra",
        severity: diasSemCompra >= 120 ? "media" : "baixa",
        title: "Fornecedor sem compra há muito tempo",
        description: `${supplier.razaoSocial} está há ${diasSemCompra} dia(s) sem novos pedidos.`,
        supplierId: supplier.id,
        supplierName: supplier.razaoSocial,
        days: diasSemCompra,
      });
    }
  }

  for (const order of params.orders) {
    const hasReceipt = params.receipts.some(
      (item) => item.purchaseOrderId === order.id
    );

    const overdue =
      order.previsaoEntrega &&
      order.previsaoEntrega < todayYmd() &&
      !hasReceipt &&
      order.status !== "recebido" &&
      order.status !== "cancelado";

    if (!overdue) continue;

    const atraso = diffDays(order.previsaoEntrega, today);

    alerts.push({
      id: `pedido_atrasado_${order.id}`,
      type: "pedido_atrasado",
      severity: (atraso ?? 0) >= 7 ? "alta" : "media",
      title: "Pedido atrasado sem recebimento",
      description: `Pedido ${order.numero} do fornecedor ${order.supplierName} está atrasado.`,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      purchaseOrderId: order.id,
      purchaseOrderNumber: order.numero,
      days: atraso ?? 0,
    });
  }

  return alerts.sort((a, b) => {
    const weight = { alta: 3, media: 2, baixa: 1 };
    return weight[b.severity] - weight[a.severity];
  });
}

export async function syncPurchaseAlertsToQueue(alerts: PurchaseAlert[]) {
  for (const item of alerts) {
    await upsertPurchaseActionItem({
      alertId: item.id,
      alertType: item.type,
      title: item.title,
      description: item.description,
      severity: item.severity,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      purchaseOrderId: item.purchaseOrderId,
      purchaseOrderNumber: item.purchaseOrderNumber,
    });
  }
}