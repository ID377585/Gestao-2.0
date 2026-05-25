"use server";

import { revalidatePath } from "next/cache";

import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CHECKLIST_PATH = "/dashboard/check-list";

export type ChecklistShift = "opening" | "closing" | "any" | "morning" | "afternoon" | "night";
export type ChecklistItemStatus = "pending" | "ok" | "not_ok" | "not_applicable" | "corrected";

const VALID_SHIFTS: ChecklistShift[] = ["opening", "closing", "any", "morning", "afternoon", "night"];
const VALID_ITEM_STATUSES: ChecklistItemStatus[] = ["pending", "ok", "not_ok", "not_applicable", "corrected"];
const ACTIVE_RUN_STATUSES = ["open", "in_progress", "blocked"];

export type KitchenChecklistTemplate = {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  area: string;
  status: string;
};

export type KitchenChecklistTemplateItem = {
  id: string;
  template_id: string;
  category: string;
  title: string;
  instructions: string | null;
  frequency: string;
  shift: ChecklistShift;
  requires_temperature: boolean;
  min_temperature: number | null;
  max_temperature: number | null;
  requires_photo: boolean;
  requires_quantity: boolean;
  requires_notes: boolean;
  sort_order: number;
  is_active: boolean;
};

export type KitchenChecklistRun = {
  id: string;
  template_id: string;
  establishment_id: string;
  run_date: string;
  shift: ChecklistShift;
  status: string;
  opened_at: string;
  completed_at: string | null;
  notes: string | null;
};

export type KitchenChecklistRunItem = {
  id: string;
  run_id: string;
  template_item_id: string | null;
  status: ChecklistItemStatus;
  measured_temperature: number | null;
  quantity: number | null;
  notes: string | null;
  corrective_action: string | null;
  checked_at: string | null;
  template_item?: KitchenChecklistTemplateItem | null;
};

export type ChecklistDashboardData = {
  establishmentId: string;
  templates: KitchenChecklistTemplate[];
  templateItems: KitchenChecklistTemplateItem[];
  recentRuns: KitchenChecklistRun[];
  activeRun: KitchenChecklistRun | null;
  activeRunItems: KitchenChecklistRunItem[];
};

export type UpdateChecklistRunItemInput = {
  runItemId: string;
  status: ChecklistItemStatus;
  measured_temperature?: unknown;
  quantity?: unknown;
  notes?: string | null;
  corrective_action?: string | null;
};

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function assertValidShift(shift: ChecklistShift) {
  if (!VALID_SHIFTS.includes(shift)) {
    throw new Error("Turno inválido para Check-List.");
  }
}

function assertValidItemStatus(status: ChecklistItemStatus) {
  if (!VALID_ITEM_STATUSES.includes(status)) {
    throw new Error("Status inválido para item da Check-List.");
  }
}

function getRelationRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function getContext() {
  const supabase = await createSupabaseServerClient();
  const membership = await getActiveMembershipOrRedirect();
  const establishmentId = membership.establishmentId;

  if (!establishmentId) {
    throw new Error("Membership sem estabelecimento ativo.");
  }

  return {
    supabase,
    db: supabase as any,
    userId: membership.user.id as string,
    establishmentId,
  };
}

export async function getChecklistDashboard(): Promise<ChecklistDashboardData> {
  const { db, establishmentId } = await getContext();

  const { data: templates, error: templatesError } = await db
    .from("kitchen_checklist_templates")
    .select("id, establishment_id, name, description, area, status")
    .eq("establishment_id", establishmentId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (templatesError) throw new Error(templatesError.message);

  const templateIds = (templates ?? []).map((template: KitchenChecklistTemplate) => template.id);

  let templateItems: KitchenChecklistTemplateItem[] = [];
  if (templateIds.length > 0) {
    const { data: items, error: itemsError } = await db
      .from("kitchen_checklist_template_items")
      .select(
        "id, template_id, category, title, instructions, frequency, shift, requires_temperature, min_temperature, max_temperature, requires_photo, requires_quantity, requires_notes, sort_order, is_active"
      )
      .in("template_id", templateIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (itemsError) throw new Error(itemsError.message);
    templateItems = items ?? [];
  }

  const { data: recentRuns, error: runsError } = await db
    .from("kitchen_checklist_runs")
    .select("id, template_id, establishment_id, run_date, shift, status, opened_at, completed_at, notes")
    .eq("establishment_id", establishmentId)
    .order("opened_at", { ascending: false })
    .limit(20);

  if (runsError) throw new Error(runsError.message);

  const activeRun =
    (recentRuns ?? []).find((run: KitchenChecklistRun) => ACTIVE_RUN_STATUSES.includes(run.status)) ?? null;

  let activeRunItems: KitchenChecklistRunItem[] = [];
  if (activeRun) {
    const { data: runItems, error: runItemsError } = await db
      .from("kitchen_checklist_run_items")
      .select(
        "id, run_id, template_item_id, status, measured_temperature, quantity, notes, corrective_action, checked_at, template_item:kitchen_checklist_template_items(id, template_id, category, title, instructions, frequency, shift, requires_temperature, min_temperature, max_temperature, requires_photo, requires_quantity, requires_notes, sort_order, is_active)"
      )
      .eq("run_id", activeRun.id)
      .order("created_at", { ascending: true });

    if (runItemsError) throw new Error(runItemsError.message);
    activeRunItems = runItems ?? [];
  }

  return {
    establishmentId,
    templates: templates ?? [],
    templateItems,
    recentRuns: recentRuns ?? [],
    activeRun,
    activeRunItems,
  };
}

export async function createChecklistRun(templateId: string, shift: ChecklistShift) {
  const { db, userId, establishmentId } = await getContext();
  assertValidShift(shift);

  if (!templateId) {
    throw new Error("Selecione um template para abrir a Check-List.");
  }

  const { data: existingRun, error: existingRunError } = await db
    .from("kitchen_checklist_runs")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("shift", shift)
    .in("status", ACTIVE_RUN_STATUSES)
    .limit(1)
    .maybeSingle();

  if (existingRunError) throw new Error(existingRunError.message);
  if (existingRun) {
    throw new Error("Já existe uma Check-List aberta para este estabelecimento e turno.");
  }

  const { data: template, error: templateError } = await db
    .from("kitchen_checklist_templates")
    .select("id, establishment_id, status")
    .eq("id", templateId)
    .eq("establishment_id", establishmentId)
    .eq("status", "active")
    .single();

  if (templateError || !template) {
    throw new Error(templateError?.message ?? "Template de checklist não encontrado.");
  }

  const { data: run, error: runError } = await db
    .from("kitchen_checklist_runs")
    .insert({
      template_id: template.id,
      establishment_id: establishmentId,
      shift,
      status: "in_progress",
      opened_by: userId,
    })
    .select("id")
    .single();

  if (runError || !run) {
    throw new Error(runError?.message ?? "Não foi possível abrir a checklist.");
  }

  const { data: templateItems, error: itemsError } = await db
    .from("kitchen_checklist_template_items")
    .select("id, shift")
    .eq("template_id", template.id)
    .eq("is_active", true)
    .or(`shift.eq.any,shift.eq.${shift}`)
    .order("sort_order", { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  const runItems = (templateItems ?? []).map((item: { id: string }) => ({
    run_id: run.id,
    template_item_id: item.id,
    status: "pending",
  }));

  if (runItems.length > 0) {
    const { error: insertItemsError } = await db.from("kitchen_checklist_run_items").insert(runItems);
    if (insertItemsError) throw new Error(insertItemsError.message);
  }

  revalidatePath(CHECKLIST_PATH);
  return run.id as string;
}

export async function updateChecklistRunItem(input: UpdateChecklistRunItemInput) {
  const { db, userId, establishmentId } = await getContext();
  assertValidItemStatus(input.status);

  const { data: existing, error: existingError } = await db
    .from("kitchen_checklist_run_items")
    .select(
      "id, run:kitchen_checklist_runs(id, establishment_id), template_item:kitchen_checklist_template_items(requires_notes, requires_temperature, min_temperature, max_temperature)"
    )
    .eq("id", input.runItemId)
    .single();

  if (existingError || !existing) {
    throw new Error(existingError?.message ?? "Item da checklist não encontrado.");
  }

  const run = getRelationRow<{ establishment_id: string }>(existing.run);
  if (run?.establishment_id !== establishmentId) {
    throw new Error("Item da checklist pertence a outro estabelecimento.");
  }

  const templateItem = getRelationRow<{
    requires_notes: boolean;
    requires_temperature: boolean;
    min_temperature: number | null;
    max_temperature: number | null;
  }>(existing.template_item);

  const notes = input.notes?.trim() || null;
  const correctiveAction = input.corrective_action?.trim() || null;
  const measuredTemperature = toNumberOrNull(input.measured_temperature);
  const quantity = toNumberOrNull(input.quantity);

  if ((templateItem?.requires_notes || input.status === "not_ok") && !notes) {
    throw new Error("Informe uma observação para este item.");
  }

  if ((input.status === "not_ok" || input.status === "corrected") && !correctiveAction) {
    throw new Error("Informe a ação corretiva para itens não OK ou corrigidos.");
  }

  if (templateItem?.requires_temperature && measuredTemperature === null && input.status !== "not_applicable") {
    throw new Error("Informe a temperatura medida para este item.");
  }

  const { error } = await db
    .from("kitchen_checklist_run_items")
    .update({
      status: input.status,
      measured_temperature: measuredTemperature,
      quantity,
      notes,
      corrective_action: correctiveAction,
      checked_by: userId,
      checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.runItemId);

  if (error) throw new Error(error.message);

  revalidatePath(CHECKLIST_PATH);
}

async function updateChecklistRunStatus(runId: string, status: "blocked" | "cancelled", notes?: string) {
  const { db, userId, establishmentId } = await getContext();

  const finalNotes = notes?.trim() || null;
  if (!finalNotes) {
    throw new Error("Informe uma observação para bloquear ou cancelar a Check-List.");
  }

  const { data: run, error: runError } = await db
    .from("kitchen_checklist_runs")
    .select("id, establishment_id, status")
    .eq("id", runId)
    .eq("establishment_id", establishmentId)
    .single();

  if (runError || !run) {
    throw new Error(runError?.message ?? "Checklist não encontrada.");
  }

  if (!ACTIVE_RUN_STATUSES.includes(run.status)) {
    throw new Error("Somente Check-Lists abertas podem ser bloqueadas ou canceladas.");
  }

  const { error } = await db
    .from("kitchen_checklist_runs")
    .update({
      status,
      completed_by: status === "cancelled" ? userId : null,
      completed_at: status === "cancelled" ? new Date().toISOString() : null,
      notes: finalNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) throw new Error(error.message);

  revalidatePath(CHECKLIST_PATH);
}

export async function blockChecklistRun(runId: string, notes?: string) {
  await updateChecklistRunStatus(runId, "blocked", notes);
}

export async function cancelChecklistRun(runId: string, notes?: string) {
  await updateChecklistRunStatus(runId, "cancelled", notes);
}

export async function completeChecklistRun(runId: string, notes?: string) {
  const { db, userId, establishmentId } = await getContext();

  const { data: run, error: runError } = await db
    .from("kitchen_checklist_runs")
    .select("id, establishment_id, status")
    .eq("id", runId)
    .eq("establishment_id", establishmentId)
    .single();

  if (runError || !run) {
    throw new Error(runError?.message ?? "Checklist não encontrada.");
  }

  if (!ACTIVE_RUN_STATUSES.includes(run.status)) {
    throw new Error("Somente Check-Lists abertas podem ser concluídas.");
  }

  const { count, error: pendingError } = await db
    .from("kitchen_checklist_run_items")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("status", "pending");

  if (pendingError) throw new Error(pendingError.message);
  if ((count ?? 0) > 0) {
    throw new Error("Ainda existem itens pendentes antes da conclusão.");
  }

  const { error } = await db
    .from("kitchen_checklist_runs")
    .update({
      status: "completed",
      completed_by: userId,
      completed_at: new Date().toISOString(),
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) throw new Error(error.message);

  revalidatePath(CHECKLIST_PATH);
}
