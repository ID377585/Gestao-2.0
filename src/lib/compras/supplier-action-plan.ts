import {
  assertSupabaseSuccess,
  createLegacyId,
  legacyInsert,
  legacySelect,
  legacyUpdate,
  toIsoString,
  toText,
} from "@/lib/legacy/supabase";
import type {
  SupplierActionPlanItem,
  SupplierContactHistoryItem,
  SupplierScoreReviewItem,
} from "@/types/compras";

const ACTION_PLAN_TABLE = "supplier_action_plans";
const CONTACT_HISTORY_TABLE = "supplier_contact_history";
const SCORE_REVIEW_TABLE = "supplier_score_reviews";

function normalizeActionPlanItem(
  row: Record<string, unknown>
): SupplierActionPlanItem {
  return {
    id: String(row.id ?? ""),
    supplierId: toText(row.supplier_id) ?? "",
    supplierName: toText(row.supplier_name) ?? "",
    title: toText(row.title) ?? "",
    description: toText(row.description) ?? "",
    category:
      (toText(row.category) as SupplierActionPlanItem["category"]) ??
      "operacional",
    status:
      (toText(row.status) as SupplierActionPlanItem["status"]) ?? "pendente",
    priority:
      (toText(row.priority) as SupplierActionPlanItem["priority"]) ?? "media",
    dueDate: toText(row.due_date) ?? "",
    assignedTo: toText(row.assigned_to) ?? "",
    createdBy: toText(row.created_by) ?? "",
    createdAt: toIsoString(toText(row.created_at)) ?? "",
    updatedAt: toIsoString(toText(row.updated_at)) ?? "",
  };
}

function normalizeContactHistoryItem(
  row: Record<string, unknown>
): SupplierContactHistoryItem {
  return {
    id: String(row.id ?? ""),
    supplierId: toText(row.supplier_id) ?? "",
    supplierName: toText(row.supplier_name) ?? "",
    contactType:
      (toText(row.contact_type) as SupplierContactHistoryItem["contactType"]) ??
      "email",
    subject: toText(row.subject) ?? "",
    notes: toText(row.notes) ?? "",
    contactDate: toText(row.contact_date) ?? "",
    nextFollowUpDate: toText(row.next_follow_up_date) ?? "",
    createdBy: toText(row.created_by) ?? "",
    createdAt: toIsoString(toText(row.created_at)) ?? "",
    updatedAt: toIsoString(toText(row.updated_at)) ?? "",
  };
}

function normalizeScoreReviewItem(
  row: Record<string, unknown>
): SupplierScoreReviewItem {
  return {
    id: String(row.id ?? ""),
    supplierId: toText(row.supplier_id) ?? "",
    supplierName: toText(row.supplier_name) ?? "",
    scheduledDate: toText(row.scheduled_date) ?? "",
    notes: toText(row.notes) ?? "",
    status:
      (toText(row.status) as SupplierScoreReviewItem["status"]) ?? "agendada",
    createdBy: toText(row.created_by) ?? "",
    createdAt: toIsoString(toText(row.created_at)) ?? "",
    updatedAt: toIsoString(toText(row.updated_at)) ?? "",
  };
}

export async function listSupplierActionPlanItems(
  supplierId: string
): Promise<SupplierActionPlanItem[]> {
  const { query } = await legacySelect(ACTION_PLAN_TABLE);
  const { data, error } = await query
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(
    error,
    "Nao foi possivel listar o plano de acao do fornecedor"
  );

  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    normalizeActionPlanItem(row as Record<string, unknown>)
  );
}

export async function listSupplierContactHistory(
  supplierId: string
): Promise<SupplierContactHistoryItem[]> {
  const { query } = await legacySelect(CONTACT_HISTORY_TABLE);
  const { data, error } = await query
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(
    error,
    "Nao foi possivel listar o historico de contato do fornecedor"
  );

  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    normalizeContactHistoryItem(row as Record<string, unknown>)
  );
}

export async function listSupplierScoreReviews(
  supplierId: string
): Promise<SupplierScoreReviewItem[]> {
  const { query } = await legacySelect(SCORE_REVIEW_TABLE);
  const { data, error } = await query
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(
    error,
    "Nao foi possivel listar as reavaliacoes do fornecedor"
  );

  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    normalizeScoreReviewItem(row as Record<string, unknown>)
  );
}

export async function createSupplierActionPlanItem(input: {
  supplierId: string;
  supplierName: string;
  title: string;
  description?: string;
  category: SupplierActionPlanItem["category"];
  priority: SupplierActionPlanItem["priority"];
  dueDate?: string;
  assignedTo?: string;
  createdBy?: string;
}): Promise<string> {
  const id = createLegacyId();
  const now = new Date().toISOString();

  const { error } = await legacyInsert(ACTION_PLAN_TABLE, {
    id,
    supplier_id: input.supplierId,
    supplier_name: input.supplierName,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    status: "pendente",
    priority: input.priority,
    due_date: input.dueDate?.trim() || null,
    assigned_to: input.assignedTo?.trim() || null,
    created_by: input.createdBy?.trim() || null,
    created_at: now,
    updated_at: now,
  });

  assertSupabaseSuccess(error, "Nao foi possivel criar a acao do fornecedor");

  return id;
}

export async function createSupplierContactHistory(input: {
  supplierId: string;
  supplierName: string;
  contactType: SupplierContactHistoryItem["contactType"];
  subject: string;
  notes?: string;
  contactDate?: string;
  nextFollowUpDate?: string;
  createdBy?: string;
}): Promise<string> {
  const id = createLegacyId();
  const now = new Date().toISOString();

  const { error } = await legacyInsert(CONTACT_HISTORY_TABLE, {
    id,
    supplier_id: input.supplierId,
    supplier_name: input.supplierName,
    contact_type: input.contactType,
    subject: input.subject.trim(),
    notes: input.notes?.trim() || null,
    contact_date: input.contactDate?.trim() || null,
    next_follow_up_date: input.nextFollowUpDate?.trim() || null,
    created_by: input.createdBy?.trim() || null,
    created_at: now,
    updated_at: now,
  });

  assertSupabaseSuccess(
    error,
    "Nao foi possivel registrar o contato do fornecedor"
  );

  return id;
}

export async function createSupplierScoreReview(input: {
  supplierId: string;
  supplierName: string;
  scheduledDate: string;
  notes?: string;
  createdBy?: string;
}): Promise<string> {
  const id = createLegacyId();
  const now = new Date().toISOString();

  const { error } = await legacyInsert(SCORE_REVIEW_TABLE, {
    id,
    supplier_id: input.supplierId,
    supplier_name: input.supplierName,
    scheduled_date: input.scheduledDate.trim(),
    notes: input.notes?.trim() || null,
    status: "agendada",
    created_by: input.createdBy?.trim() || null,
    created_at: now,
    updated_at: now,
  });

  assertSupabaseSuccess(
    error,
    "Nao foi possivel criar a reavaliacao do fornecedor"
  );

  return id;
}

export async function updateSupplierActionPlanStatus(input: {
  id: string;
  status: SupplierActionPlanItem["status"];
}): Promise<void> {
  const { query } = await legacyUpdate(ACTION_PLAN_TABLE, {
    status: input.status,
    updated_at: new Date().toISOString(),
  });
  const { error } = await query.eq("id", input.id);

  assertSupabaseSuccess(
    error,
    "Nao foi possivel atualizar o status da acao do fornecedor"
  );
}

export async function updateSupplierScoreReviewStatus(input: {
  id: string;
  status: SupplierScoreReviewItem["status"];
}): Promise<void> {
  const { query } = await legacyUpdate(SCORE_REVIEW_TABLE, {
    status: input.status,
    updated_at: new Date().toISOString(),
  });
  const { error } = await query.eq("id", input.id);

  assertSupabaseSuccess(
    error,
    "Nao foi possivel atualizar o status da reavaliacao do fornecedor"
  );
}
