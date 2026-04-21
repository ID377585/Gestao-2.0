import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
  toIsoString,
  toText,
} from "@/lib/legacy/supabase";
import type {
  PurchaseHistoryAction,
  PurchaseHistoryEntry,
  PurchaseHistoryEntityType,
} from "@/types/compras";

const TABLE_NAME = "purchase_history";

function normalizeEntry(row: Record<string, unknown>): PurchaseHistoryEntry {
  return {
    id: toText(row.id),
    entityType: (toText(row.entity_type, "pedido") ??
      "pedido") as PurchaseHistoryEntityType,
    entityId: toText(row.entity_id),
    action: (toText(row.action, "pedido_criado") ??
      "pedido_criado") as PurchaseHistoryAction,
    title: toText(row.title),
    description: toText(row.description),
    relatedEntityType: toText(row.related_entity_type) as PurchaseHistoryEntityType,
    relatedEntityId: toText(row.related_entity_id),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    createdBy: toText(row.created_by),
  };
}

export async function createPurchaseHistoryEntry(input: {
  entityType: PurchaseHistoryEntityType;
  entityId: string;
  action: PurchaseHistoryAction;
  title: string;
  description?: string;
  relatedEntityType?: PurchaseHistoryEntityType;
  relatedEntityId?: string;
  createdBy?: string;
}) {
  const supabase = getLegacySupabase();
  const id = createLegacyId();

  const { error } = await supabase.from(TABLE_NAME).insert({
    id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    title: input.title,
    description: input.description ?? "",
    related_entity_type: input.relatedEntityType ?? "",
    related_entity_id: input.relatedEntityId ?? "",
    created_by: input.createdBy ?? "",
  });

  assertSupabaseSuccess(error, "Nao foi possivel registrar o historico de compras");
  return id;
}

export async function listPurchaseHistory(params: {
  entityType: PurchaseHistoryEntityType;
  entityId: string;
}) {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("entity_type", params.entityType)
    .eq("entity_id", params.entityId)
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar o historico de compras");
  return (data ?? []).map((row) => normalizeEntry(row as Record<string, unknown>));
}

export async function listAllPurchaseHistory() {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar a auditoria de compras");
  return (data ?? []).map((row) => normalizeEntry(row as Record<string, unknown>));
}
