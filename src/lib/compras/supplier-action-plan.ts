import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
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
    id: toText(row.id),
    supplierId: toText(row.supplier_id),
    supplierName: toText(row.supplier_name),
    title: toText(row.title),
    description: toText(row.description),
    category: (toText(row.category, "operacional") ??
      "operacional") as SupplierActionPlanItem["category"],
    status: (toText(row.status, "pendente") ??
      "pendente") as SupplierActionPlanItem["status"],
    priority: (toText(row.priority, "media") ??
      "media") as SupplierActionPlanItem["priority"],
    dueDate: toText(row.due_date),
    assignedTo: toText(row.assigned_to),
    createdBy: toText(row.created_by),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

function normalizeContactHistoryItem(
  row: Record<string, unknown>
): SupplierContactHistoryItem {
  return {
    id: toText(row.id),
    supplierId: toText(row.supplier_id),
    supplierName: toText(row.supplier_name),
    contactType: (toText(row.contact_type, "email") ??
      "email") as SupplierContactHistoryItem["contactType"],
    subject: toText(row.subject),
    notes: toText(row.notes),
    contactDate: toText(row.contact_date),
    nextFollowUpDate: toText(row.next_follow_up_date),
    createdBy: toText(row.created_by),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

function normalizeScoreReviewItem(
  row: Record<string, unknown>
): SupplierScoreReviewItem {
  return {
    id: toText(row.id),
    supplierId: toText(row.supplier_id),
    supplierName: toText(row.supplier_name),
    scheduledDate: toText(row.scheduled_date),
    notes: toText(row.notes),
    status: (toText(row.status, "agendada") ??
      "agendada") as SupplierScoreReviewItem["status"],
    createdBy: toText(row.created_by),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

export async function listSupplierActionPlanItems(supplierId: string) {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(ACTION_PLAN_TABLE)
    .select("*")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar o plano de acao do fornecedor");
  return (data ?? []).map((row) =>
    normalizeActionPlanItem(row as Record<string, unknown>)
  );
}

export async function createSupplierActionPlanItem(input: {
  supplierId: string;
  supplierName: string;
  title: string;
  description?: string;
  category: SupplierActionPlanItem["category"];
  status?: SupplierActionPlanItem["status"];
  priority: SupplierActionPlanItem["priority"];
  dueDate?: string;
  assignedTo?: string;
  createdBy?: string;
}) {
  const supabase = getLegacySupabase();
  const id = createLegacyId();

  const { error } = await supabase.from(ACTION_PLAN_TABLE).insert({
    id,
    supplier_id: input.supplierId,
    supplier_name: input.supplierName,
    title: input.title,
    description: input.description ?? "",
    category: input.category,
    status: input.status ?? "pendente",
    priority: input.priority,
    due_date: input.dueDate ?? "",
    assigned_to: input.assignedTo ?? "",
    created_by: input.createdBy ?? "",
  });

  assertSupabaseSuccess(error, "Nao foi possivel criar o plano de acao do fornecedor");
  return id;
}

export async function updateSupplierActionPlanStatus(params: {
  id: string;
  status: SupplierActionPlanItem["status"];
}) {
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(ACTION_PLAN_TABLE)
    .update({ status: params.status })
    .eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar o status do plano de acao");
}

export async function listSupplierContactHistory(supplierId: string) {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(CONTACT_HISTORY_TABLE)
    .select("*")
    .eq("supplier_id", supplierId)
    .order("contact_date", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar o historico de contato");
  return (data ?? []).map((row) =>
    normalizeContactHistoryItem(row as Record<string, unknown>)
  );
}

export async function createSupplierContactHistory(input: {
  supplierId: string;
  supplierName: string;
  contactType: SupplierContactHistoryItem["contactType"];
  subject: string;
  notes?: string;
  contactDate: string;
  nextFollowUpDate?: string;
  createdBy?: string;
}) {
  const supabase = getLegacySupabase();
  const id = createLegacyId();

  const { error } = await supabase.from(CONTACT_HISTORY_TABLE).insert({
    id,
    supplier_id: input.supplierId,
    supplier_name: input.supplierName,
    contact_type: input.contactType,
    subject: input.subject,
    notes: input.notes ?? "",
    contact_date: input.contactDate,
    next_follow_up_date: input.nextFollowUpDate ?? "",
    created_by: input.createdBy ?? "",
  });

  assertSupabaseSuccess(error, "Nao foi possivel registrar o historico de contato");
  return id;
}

export async function listSupplierScoreReviews(supplierId: string) {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(SCORE_REVIEW_TABLE)
    .select("*")
    .eq("supplier_id", supplierId)
    .order("scheduled_date", { ascending: true });

  assertSupabaseSuccess(error, "Nao foi possivel listar as revisoes de score");
  return (data ?? []).map((row) =>
    normalizeScoreReviewItem(row as Record<string, unknown>)
  );
}

export async function createSupplierScoreReview(input: {
  supplierId: string;
  supplierName: string;
  scheduledDate: string;
  notes?: string;
  createdBy?: string;
}) {
  const supabase = getLegacySupabase();
  const id = createLegacyId();

  const { error } = await supabase.from(SCORE_REVIEW_TABLE).insert({
    id,
    supplier_id: input.supplierId,
    supplier_name: input.supplierName,
    scheduled_date: input.scheduledDate,
    notes: input.notes ?? "",
    status: "agendada",
    created_by: input.createdBy ?? "",
  });

  assertSupabaseSuccess(error, "Nao foi possivel criar a revisao de score");
  return id;
}

export async function updateSupplierScoreReviewStatus(params: {
  id: string;
  status: SupplierScoreReviewItem["status"];
}) {
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(SCORE_REVIEW_TABLE)
    .update({ status: params.status })
    .eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar a revisao de score");
}
