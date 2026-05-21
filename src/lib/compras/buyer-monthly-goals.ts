import {
  assertSupabaseSuccess,
  createLegacyId,
  legacyInsert,
  legacySelect,
  legacyUpdate,
  toIsoString,
  toNumber,
  toText,
} from "@/lib/legacy/supabase";
import type { BuyerMonthlyGoal } from "@/types/compras";

const TABLE_NAME = "buyer_monthly_goals";

function normalizeGoal(row: Record<string, unknown>): BuyerMonthlyGoal {
  return {
    id: toText(row.id),
    buyer: toText(row.buyer),
    referenceMonth: toText(row.reference_month),
    targetContacts: toNumber(row.target_contacts),
    targetActionsCompleted: toNumber(row.target_actions_completed),
    targetReviewsDone: toNumber(row.target_reviews_done),
    notes: toText(row.notes),
    createdBy: toText(row.created_by),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

export async function listBuyerMonthlyGoals(referenceMonth?: string) {
  let { query } = await legacySelect(TABLE_NAME);

  if (referenceMonth) {
    query = query.eq("reference_month", referenceMonth);
  }

  const { data, error } = await query
    .order("reference_month", { ascending: false })
    .order("buyer", { ascending: true });

  assertSupabaseSuccess(error, "Nao foi possivel listar as metas mensais");
  return ((data ?? []) as Record<string, unknown>[]).map((row) => normalizeGoal(row as Record<string, unknown>));
}

export async function createBuyerMonthlyGoal(input: {
  buyer: string;
  referenceMonth: string;
  targetContacts: number;
  targetActionsCompleted: number;
  targetReviewsDone: number;
  notes?: string;
  createdBy?: string;
}) {
  const id = createLegacyId();

  const { error } = await legacyInsert(TABLE_NAME, {
    id,
    buyer: input.buyer,
    reference_month: input.referenceMonth,
    target_contacts: Number(input.targetContacts || 0),
    target_actions_completed: Number(input.targetActionsCompleted || 0),
    target_reviews_done: Number(input.targetReviewsDone || 0),
    notes: input.notes ?? "",
    created_by: input.createdBy ?? "",
  });

  assertSupabaseSuccess(error, "Nao foi possivel criar a meta mensal");
  return id;
}

export async function updateBuyerMonthlyGoal(params: {
  id: string;
  targetContacts: number;
  targetActionsCompleted: number;
  targetReviewsDone: number;
  notes?: string;
}) {
  const { error } = await (
    await legacyUpdate(TABLE_NAME, {
      target_contacts: Number(params.targetContacts || 0),
      target_actions_completed: Number(params.targetActionsCompleted || 0),
      target_reviews_done: Number(params.targetReviewsDone || 0),
      notes: params.notes ?? "",
    })
  ).eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar a meta mensal");
}
