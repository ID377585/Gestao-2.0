import {
  assertSupabaseSuccess,
  legacySelect,
  legacyUpdate,
  legacyUpsert,
  toIsoString,
  toText,
} from "@/lib/legacy/supabase";
import type { PurchaseAlertActionItem } from "@/types/compras";

const TABLE_NAME = "purchase_action_queue";

function normalizeItem(row: Record<string, unknown>): PurchaseAlertActionItem {
  return {
    id: toText(row.id),
    alertId: toText(row.alert_id),
    alertType: (toText(row.alert_type, "fornecedor_critico") ??
      "fornecedor_critico") as PurchaseAlertActionItem["alertType"],
    title: toText(row.title),
    description: toText(row.description),
    severity: (toText(row.severity, "media") ??
      "media") as PurchaseAlertActionItem["severity"],
    supplierId: toText(row.supplier_id),
    supplierName: toText(row.supplier_name),
    purchaseOrderId: toText(row.purchase_order_id),
    purchaseOrderNumber: toText(row.purchase_order_number),
    status: (toText(row.status, "pendente") ??
      "pendente") as PurchaseAlertActionItem["status"],
    observacaoTratativa: toText(row.observacao_tratativa),
    treatedAt: toText(row.treated_at),
    treatedBy: toText(row.treated_by),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

export async function listPurchaseActionQueue() {
  const { query } = await legacySelect(TABLE_NAME);
  const { data, error } = await query.order("updated_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar a fila de acoes");
  return ((data ?? []) as Record<string, unknown>[]).map((row) => normalizeItem(row as Record<string, unknown>));
}

export async function upsertPurchaseActionItem(input: {
  alertId: string;
  alertType: PurchaseAlertActionItem["alertType"];
  title: string;
  description: string;
  severity: PurchaseAlertActionItem["severity"];
  supplierId?: string;
  supplierName?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
}) {
  const payload = {
    id: input.alertId,
    alert_id: input.alertId,
    alert_type: input.alertType,
    title: input.title,
    description: input.description,
    severity: input.severity,
    supplier_id: input.supplierId ?? "",
    supplier_name: input.supplierName ?? "",
    purchase_order_id: input.purchaseOrderId ?? "",
    purchase_order_number: input.purchaseOrderNumber ?? "",
    status: "pendente",
    observacao_tratativa: "",
    treated_at: "",
    treated_by: "",
  };

  const { error } = await legacyUpsert(TABLE_NAME, payload, {
    onConflict: "id",
  });

  assertSupabaseSuccess(error, "Nao foi possivel registrar o item da fila");
  return input.alertId;
}

export async function markPurchaseActionAsDone(params: {
  id: string;
  observacaoTratativa?: string;
  treatedBy?: string;
}) {
  const { error } = await (
    await legacyUpdate(TABLE_NAME, {
      status: "tratado",
      observacao_tratativa: params.observacaoTratativa ?? "",
      treated_at: new Date().toISOString(),
      treated_by: params.treatedBy ?? "",
    })
  ).eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel concluir a acao");
}

export async function reopenPurchaseAction(params: { id: string }) {
  const { error } = await (
    await legacyUpdate(TABLE_NAME, {
      status: "pendente",
      observacao_tratativa: "",
      treated_at: "",
      treated_by: "",
    })
  ).eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel reabrir a acao");
}
