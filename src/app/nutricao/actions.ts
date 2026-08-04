"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenantOrRedirect } from "@/lib/tenant/guards";
import { assertTenantCanAccessModule } from "@/lib/tenant/module-access";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

export type NutritionModuleStatus = "ready" | "migration_pending" | "error";

export type NutritionSummary = {
  status: NutritionModuleStatus;
  inspectionsToday: number;
  inspectionsInProgress: number;
  inspectionsCompleted: number;
  openNonconformities: number;
  criticalNonconformities: number;
  overdueActions: number;
  pendingTemperatureRecords: number;
  expiringDocuments: number;
  message?: string;
};

export type InspectionListItem = {
  id: string;
  title: string;
  inspectionCode: string | null;
  inspectionType: string;
  status: string;
  sector: string | null;
  scheduledFor: string | null;
  inspectorUserId: string | null;
  createdAt: string;
};

export type NonconformityListItem = {
  id: string;
  code: string | null;
  title: string;
  severity: string;
  status: string;
  sector: string | null;
  location: string | null;
  dueAt: string | null;
  openedAt: string;
};

export type TemperaturePointItem = {
  id: string;
  name: string;
  controlType: string;
  sector: string | null;
  equipmentOrProduct: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string;
  isActive: boolean;
  latestRecord?: {
    measuredValue: number;
    status: string;
    measuredAt: string;
  } | null;
};

export type PopItem = {
  id: string;
  code: string | null;
  title: string;
  status: string;
  nextReviewAt: string | null;
  sectors: string[];
};

export type SanitationPlanItem = {
  id: string;
  name: string;
  sector: string | null;
  targetItem: string;
  productName: string | null;
  status: string;
  evidenceRequired: boolean;
};

export type DocumentItem = {
  id: string;
  documentType: string;
  title: string;
  documentNumber: string | null;
  issuer: string | null;
  validUntil: string | null;
  status: string;
  visibility: string;
};

export type TrainingItem = {
  id: string;
  title: string;
  instructor: string | null;
  workloadMinutes: number | null;
  validityDays: number | null;
  status: string;
};

export type SupplierAssessmentItem = {
  id: string;
  supplierName: string;
  assessmentDate: string;
  qualityScore: number | null;
  sanitaryStatus: string;
};

export type NutritionReportItem = {
  id: string;
  title: string;
  reportType: string;
  format: string;
  status: string;
  generatedAt: string | null;
};

function isMissingNutritionTableError(error: unknown) {
  const candidate = error as SupabaseErrorLike | null;
  const message = String(candidate?.message ?? "").toLowerCase();

  return (
    candidate?.code === "42P01" ||
    candidate?.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

function serializeError(error: unknown) {
  if (!error || typeof error !== "object") return String(error ?? "");
  const candidate = error as SupabaseErrorLike & { details?: unknown; hint?: unknown };

  return {
    code: candidate.code,
    message: candidate.message,
    details: candidate.details,
    hint: candidate.hint,
  };
}

async function getNutritionContext() {
  const tenant = await getActiveTenantOrRedirect();
  await assertTenantCanAccessModule(tenant, "nutricao");

  return {
    tenant,
    supabase: await createSupabaseServerClient(),
  };
}

function emptySummary(message?: string): NutritionSummary {
  return {
    status: message ? "migration_pending" : "ready",
    inspectionsToday: 0,
    inspectionsInProgress: 0,
    inspectionsCompleted: 0,
    openNonconformities: 0,
    criticalNonconformities: 0,
    overdueActions: 0,
    pendingTemperatureRecords: 0,
    expiringDocuments: 0,
    message,
  };
}

export async function getNutritionSummary(): Promise<NutritionSummary> {
  const { tenant, supabase } = await getNutritionContext();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextThirtyDays = new Date(today);
  nextThirtyDays.setDate(nextThirtyDays.getDate() + 30);

  const [
    inspectionsToday,
    inspectionsInProgress,
    inspectionsCompleted,
    openNonconformities,
    criticalNonconformities,
    overdueActions,
    expiringDocuments,
  ] = await Promise.all([
    supabase
      .from("nutrition_inspections")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", tenant.establishmentId)
      .gte("scheduled_for", today.toISOString())
      .lt("scheduled_for", tomorrow.toISOString()),
    supabase
      .from("nutrition_inspections")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", tenant.establishmentId)
      .in("status", ["in_progress", "paused"]),
    supabase
      .from("nutrition_inspections")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", tenant.establishmentId)
      .eq("status", "completed"),
    supabase
      .from("nutrition_nonconformities")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", tenant.establishmentId)
      .not("status", "in", "(closed,canceled)"),
    supabase
      .from("nutrition_nonconformities")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", tenant.establishmentId)
      .eq("severity", "critical")
      .not("status", "in", "(closed,canceled)"),
    supabase
      .from("nutrition_action_items")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", tenant.establishmentId)
      .lt("due_at", new Date().toISOString())
      .not("status", "in", "(completed,canceled)"),
    supabase
      .from("nutrition_documents")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", tenant.establishmentId)
      .lte("valid_until", nextThirtyDays.toISOString().slice(0, 10))
      .not("status", "in", "(canceled,replaced)"),
  ]);

  const firstError = [
    inspectionsToday.error,
    inspectionsInProgress.error,
    inspectionsCompleted.error,
    openNonconformities.error,
    criticalNonconformities.error,
    overdueActions.error,
    expiringDocuments.error,
  ].find(Boolean);

  if (firstError) {
    if (isMissingNutritionTableError(firstError)) {
      return emptySummary("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] summary error:", serializeError(firstError));
    return {
      ...emptySummary("Não foi possível carregar os indicadores de Nutrição."),
      status: "error",
    };
  }

  return {
    status: "ready",
    inspectionsToday: inspectionsToday.count ?? 0,
    inspectionsInProgress: inspectionsInProgress.count ?? 0,
    inspectionsCompleted: inspectionsCompleted.count ?? 0,
    openNonconformities: openNonconformities.count ?? 0,
    criticalNonconformities: criticalNonconformities.count ?? 0,
    overdueActions: overdueActions.count ?? 0,
    pendingTemperatureRecords: 0,
    expiringDocuments: expiringDocuments.count ?? 0,
  };
}

export async function listNutritionInspections(): Promise<InspectionListItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_inspections")
    .select(
      "id,title,inspection_code,inspection_type,status,sector,scheduled_for,inspector_user_id,created_at"
    )
    .eq("establishment_id", tenant.establishmentId)
    .order("scheduled_for", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] inspections list error:", serializeError(error));
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    inspectionCode: row.inspection_code ? String(row.inspection_code) : null,
    inspectionType: String(row.inspection_type ?? "vistoria"),
    status: String(row.status ?? "scheduled"),
    sector: row.sector ? String(row.sector) : null,
    scheduledFor: row.scheduled_for ? String(row.scheduled_for) : null,
    inspectorUserId: row.inspector_user_id ? String(row.inspector_user_id) : null,
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function createNutritionInspection(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const title = String(formData.get("title") ?? "").trim();
  const inspectionType = String(formData.get("inspection_type") ?? "vistoria").trim();
  const sector = String(formData.get("sector") ?? "").trim();
  const scheduledFor = String(formData.get("scheduled_for") ?? "").trim();
  const expectedDuration = Number(formData.get("expected_duration_minutes") ?? 0);

  if (!title) throw new Error("Informe o título da vistoria.");

  const { error } = await supabase.from("nutrition_inspections").insert({
    establishment_id: tenant.establishmentId,
    title,
    inspection_type: inspectionType || "vistoria",
    sector: sector || null,
    scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    expected_duration_minutes:
      Number.isFinite(expectedDuration) && expectedDuration > 0
        ? expectedDuration
        : null,
    status: "scheduled",
    inspector_user_id: tenant.userId,
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create inspection error:", serializeError(error));
    throw new Error("Não foi possível criar a vistoria.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/vistorias");
}

export async function listNutritionNonconformities(): Promise<
  NonconformityListItem[]
> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_nonconformities")
    .select("id,code,title,severity,status,sector,location,due_at,opened_at")
    .eq("establishment_id", tenant.establishmentId)
    .order("opened_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] nonconformities list error:", serializeError(error));
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    code: row.code ? String(row.code) : null,
    title: String(row.title ?? ""),
    severity: String(row.severity ?? "medium"),
    status: String(row.status ?? "open"),
    sector: row.sector ? String(row.sector) : null,
    location: row.location ? String(row.location) : null,
    dueAt: row.due_at ? String(row.due_at) : null,
    openedAt: String(row.opened_at ?? ""),
  }));
}

export async function createNutritionNonconformity(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sector = String(formData.get("sector") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const severity = String(formData.get("severity") ?? "medium").trim();
  const dueAt = String(formData.get("due_at") ?? "").trim();
  const immediateContainment = String(
    formData.get("immediate_containment") ?? ""
  ).trim();

  if (!title) throw new Error("Informe o título da não conformidade.");

  const { error } = await supabase.from("nutrition_nonconformities").insert({
    establishment_id: tenant.establishmentId,
    source_type: "manual",
    title,
    description: description || null,
    sector: sector || null,
    location: location || null,
    category: category || null,
    severity: ["low", "medium", "high", "critical"].includes(severity)
      ? severity
      : "medium",
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
    immediate_containment: immediateContainment || null,
    status: "open",
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create nonconformity error:", serializeError(error));
    throw new Error("Não foi possível abrir a não conformidade.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/nao-conformidades");
}

export async function listTemperaturePoints(): Promise<TemperaturePointItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_temperature_points")
    .select(
      "id,name,control_type,sector,equipment_or_product,min_value,max_value,unit,is_active"
    )
    .eq("establishment_id", tenant.establishmentId)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] temperature points list error:", serializeError(error));
    return [];
  }

  const points = data ?? [];
  const pointIds = points.map((row: any) => String(row.id)).filter(Boolean);
  const latestRecordByPointId = new Map<
    string,
    { measuredValue: number; status: string; measuredAt: string }
  >();

  if (pointIds.length > 0) {
    const { data: records, error: recordsError } = await supabase
      .from("nutrition_temperature_records")
      .select("point_id,measured_value,status,measured_at")
      .eq("establishment_id", tenant.establishmentId)
      .in("point_id", pointIds)
      .order("measured_at", { ascending: false })
      .limit(100);

    if (recordsError && !isMissingNutritionTableError(recordsError)) {
      console.error(
        "[nutrition] temperature records list error:",
        serializeError(recordsError)
      );
    }

    for (const record of records ?? []) {
      const pointId = String((record as any).point_id ?? "");
      if (!pointId || latestRecordByPointId.has(pointId)) continue;

      latestRecordByPointId.set(pointId, {
        measuredValue: Number((record as any).measured_value),
        status: String((record as any).status ?? "within_limits"),
        measuredAt: String((record as any).measured_at ?? ""),
      });
    }
  }

  return points.map((row: any) => {
    return {
      id: String(row.id),
      name: String(row.name ?? ""),
      controlType: String(row.control_type ?? ""),
      sector: row.sector ? String(row.sector) : null,
      equipmentOrProduct: row.equipment_or_product
        ? String(row.equipment_or_product)
        : null,
      minValue: row.min_value == null ? null : Number(row.min_value),
      maxValue: row.max_value == null ? null : Number(row.max_value),
      unit: String(row.unit ?? "C"),
      isActive: Boolean(row.is_active),
      latestRecord: latestRecordByPointId.get(String(row.id)) ?? null,
    };
  });
}

export async function createTemperaturePoint(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const name = String(formData.get("name") ?? "").trim();
  const controlType = String(formData.get("control_type") ?? "").trim();
  const sector = String(formData.get("sector") ?? "").trim();
  const equipmentOrProduct = String(
    formData.get("equipment_or_product") ?? ""
  ).trim();
  const minValue = String(formData.get("min_value") ?? "").trim();
  const maxValue = String(formData.get("max_value") ?? "").trim();
  const unit = String(formData.get("unit") ?? "C").trim();
  const defaultCorrectiveAction = String(
    formData.get("default_corrective_action") ?? ""
  ).trim();

  if (!name) throw new Error("Informe o nome do ponto de controle.");
  if (!controlType) throw new Error("Informe o tipo de controle.");

  const { error } = await supabase.from("nutrition_temperature_points").insert({
    establishment_id: tenant.establishmentId,
    name,
    control_type: controlType,
    sector: sector || null,
    equipment_or_product: equipmentOrProduct || null,
    min_value: minValue ? Number(minValue) : null,
    max_value: maxValue ? Number(maxValue) : null,
    unit: unit || "C",
    default_corrective_action: defaultCorrectiveAction || null,
    is_active: true,
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create temperature point error:", serializeError(error));
    throw new Error("Não foi possível criar o ponto de temperatura.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/temperaturas");
}

export async function createTemperatureRecord(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const pointId = String(formData.get("point_id") ?? "").trim();
  const measuredValue = Number(formData.get("measured_value") ?? NaN);
  const observation = String(formData.get("observation") ?? "").trim();
  const immediateAction = String(formData.get("immediate_action") ?? "").trim();

  if (!pointId) throw new Error("Selecione o ponto de controle.");
  if (!Number.isFinite(measuredValue)) throw new Error("Informe a temperatura.");

  const { data: point, error: pointError } = await supabase
    .from("nutrition_temperature_points")
    .select("id,min_value,max_value,unit")
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", pointId)
    .single();

  if (pointError) {
    if (isMissingNutritionTableError(pointError)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    throw new Error("Ponto de controle não encontrado.");
  }

  const minValue = point?.min_value == null ? null : Number(point.min_value);
  const maxValue = point?.max_value == null ? null : Number(point.max_value);
  const outOfLimits =
    (minValue != null && measuredValue < minValue) ||
    (maxValue != null && measuredValue > maxValue);

  const { error } = await supabase.from("nutrition_temperature_records").insert({
    establishment_id: tenant.establishmentId,
    point_id: pointId,
    measured_value: measuredValue,
    unit: point?.unit ?? "C",
    status: outOfLimits ? "out_of_limits" : "within_limits",
    observed_by: tenant.userId,
    observation: observation || null,
    immediate_action: immediateAction || null,
  });

  if (error) {
    console.error("[nutrition] create temperature record error:", serializeError(error));
    throw new Error("Não foi possível registrar a temperatura.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/temperaturas");
}

export async function listPops(): Promise<PopItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_pops")
    .select("id,code,title,status,next_review_at,applicable_sectors")
    .eq("establishment_id", tenant.establishmentId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] pops list error:", serializeError(error));
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    code: row.code ? String(row.code) : null,
    title: String(row.title ?? ""),
    status: String(row.status ?? "draft"),
    nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
    sectors: Array.isArray(row.applicable_sectors)
      ? row.applicable_sectors.map(String)
      : [],
  }));
}

export async function createPop(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const code = String(formData.get("code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const scope = String(formData.get("scope") ?? "").trim();
  const nextReviewAt = String(formData.get("next_review_at") ?? "").trim();
  const sectors = String(formData.get("applicable_sectors") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!title) throw new Error("Informe o título do POP.");

  const { error } = await supabase.from("nutrition_pops").insert({
    establishment_id: tenant.establishmentId,
    code: code || null,
    title,
    objective: objective || null,
    scope: scope || null,
    applicable_sectors: sectors,
    next_review_at: nextReviewAt || null,
    status: "draft",
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create pop error:", serializeError(error));
    throw new Error("Não foi possível criar o POP.");
  }

  revalidatePath("/nutricao/pops");
}

export async function listSanitationPlans(): Promise<SanitationPlanItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_sanitation_plans")
    .select("id,name,sector,target_item,product_name,status,evidence_required")
    .eq("establishment_id", tenant.establishmentId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] sanitation list error:", serializeError(error));
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    sector: row.sector ? String(row.sector) : null,
    targetItem: String(row.target_item ?? ""),
    productName: row.product_name ? String(row.product_name) : null,
    status: String(row.status ?? "active"),
    evidenceRequired: Boolean(row.evidence_required),
  }));
}

export async function createSanitationPlan(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const name = String(formData.get("name") ?? "").trim();
  const sector = String(formData.get("sector") ?? "").trim();
  const targetItem = String(formData.get("target_item") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const productName = String(formData.get("product_name") ?? "").trim();
  const dilutionOrConcentration = String(
    formData.get("dilution_or_concentration") ?? ""
  ).trim();
  const contactTime = String(formData.get("contact_time") ?? "").trim();
  const requiredPpe = String(formData.get("required_ppe") ?? "").trim();
  const evidenceRequired = formData.get("evidence_required") === "on";

  if (!name) throw new Error("Informe o nome do plano de higienização.");
  if (!targetItem) throw new Error("Informe o ambiente, superfície ou equipamento.");

  const { error } = await supabase.from("nutrition_sanitation_plans").insert({
    establishment_id: tenant.establishmentId,
    name,
    sector: sector || null,
    target_item: targetItem,
    method: method || null,
    product_name: productName || null,
    dilution_or_concentration: dilutionOrConcentration || null,
    contact_time: contactTime || null,
    required_ppe: requiredPpe || null,
    evidence_required: evidenceRequired,
    status: "active",
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create sanitation plan error:", serializeError(error));
    throw new Error("Não foi possível criar o plano de higienização.");
  }

  revalidatePath("/nutricao/higienizacao");
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_documents")
    .select("id,document_type,title,document_number,issuer,valid_until,status,visibility")
    .eq("establishment_id", tenant.establishmentId)
    .order("valid_until", { ascending: true, nullsFirst: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] documents list error:", serializeError(error));
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    documentType: String(row.document_type ?? ""),
    title: String(row.title ?? ""),
    documentNumber: row.document_number ? String(row.document_number) : null,
    issuer: row.issuer ? String(row.issuer) : null,
    validUntil: row.valid_until ? String(row.valid_until) : null,
    status: String(row.status ?? "active"),
    visibility: String(row.visibility ?? "internal"),
  }));
}

export async function createDocument(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const documentType = String(formData.get("document_type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const documentNumber = String(formData.get("document_number") ?? "").trim();
  const issuer = String(formData.get("issuer") ?? "").trim();
  const issuedAt = String(formData.get("issued_at") ?? "").trim();
  const validUntil = String(formData.get("valid_until") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "internal").trim();

  if (!documentType) throw new Error("Informe o tipo do documento.");
  if (!title) throw new Error("Informe o título do documento.");

  const { error } = await supabase.from("nutrition_documents").insert({
    establishment_id: tenant.establishmentId,
    document_type: documentType,
    title,
    document_number: documentNumber || null,
    issuer: issuer || null,
    issued_at: issuedAt || null,
    valid_until: validUntil || null,
    visibility: ["internal", "restricted", "external_share"].includes(visibility)
      ? visibility
      : "internal",
    status: "active",
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create document error:", serializeError(error));
    throw new Error("Não foi possível cadastrar o documento.");
  }

  revalidatePath("/nutricao/documentos");
}

export async function listTrainings(): Promise<TrainingItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_trainings")
    .select("id,title,instructor,workload_minutes,validity_days,status")
    .eq("establishment_id", tenant.establishmentId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] trainings list error:", serializeError(error));
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    instructor: row.instructor ? String(row.instructor) : null,
    workloadMinutes:
      row.workload_minutes == null ? null : Number(row.workload_minutes),
    validityDays: row.validity_days == null ? null : Number(row.validity_days),
    status: String(row.status ?? "active"),
  }));
}

export async function createTraining(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const instructor = String(formData.get("instructor") ?? "").trim();
  const workloadMinutes = Number(formData.get("workload_minutes") ?? 0);
  const validityDays = Number(formData.get("validity_days") ?? 0);

  if (!title) throw new Error("Informe o título do treinamento.");

  const { error } = await supabase.from("nutrition_trainings").insert({
    establishment_id: tenant.establishmentId,
    title,
    description: description || null,
    instructor: instructor || null,
    workload_minutes:
      Number.isFinite(workloadMinutes) && workloadMinutes > 0
        ? workloadMinutes
        : null,
    validity_days:
      Number.isFinite(validityDays) && validityDays > 0 ? validityDays : null,
    status: "active",
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create training error:", serializeError(error));
    throw new Error("Não foi possível cadastrar o treinamento.");
  }

  revalidatePath("/nutricao/treinamentos");
}

export async function listSupplierAssessments(): Promise<SupplierAssessmentItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_supplier_assessments")
    .select("id,supplier_name,assessment_date,quality_score,sanitary_status")
    .eq("establishment_id", tenant.establishmentId)
    .order("assessment_date", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] supplier assessments list error:", serializeError(error));
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    supplierName: String(row.supplier_name ?? ""),
    assessmentDate: String(row.assessment_date ?? ""),
    qualityScore: row.quality_score == null ? null : Number(row.quality_score),
    sanitaryStatus: String(row.sanitary_status ?? "pending"),
  }));
}

export async function createSupplierAssessment(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const supplierName = String(formData.get("supplier_name") ?? "").trim();
  const assessmentDate = String(formData.get("assessment_date") ?? "").trim();
  const qualityScore = Number(formData.get("quality_score") ?? NaN);
  const sanitaryStatus = String(formData.get("sanitary_status") ?? "pending").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!supplierName) throw new Error("Informe o fornecedor.");

  const { error } = await supabase.from("nutrition_supplier_assessments").insert({
    establishment_id: tenant.establishmentId,
    supplier_name: supplierName,
    assessment_date: assessmentDate || new Date().toISOString().slice(0, 10),
    quality_score: Number.isFinite(qualityScore) ? qualityScore : null,
    sanitary_status: [
      "pending",
      "approved",
      "approved_with_restriction",
      "suspended",
      "rejected",
    ].includes(sanitaryStatus)
      ? sanitaryStatus
      : "pending",
    notes: notes || null,
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create supplier assessment error:", serializeError(error));
    throw new Error("Não foi possível cadastrar a avaliação sanitária.");
  }

  revalidatePath("/nutricao/fornecedores");
}

export async function listReports(): Promise<NutritionReportItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_reports")
    .select("id,title,report_type,format,status,generated_at")
    .eq("establishment_id", tenant.establishmentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] reports list error:", serializeError(error));
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    reportType: String(row.report_type ?? ""),
    format: String(row.format ?? "pdf"),
    status: String(row.status ?? "draft"),
    generatedAt: row.generated_at ? String(row.generated_at) : null,
  }));
}

export async function createReportDraft(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const title = String(formData.get("title") ?? "").trim();
  const reportType = String(formData.get("report_type") ?? "").trim();
  const format = String(formData.get("format") ?? "pdf").trim();

  if (!title) throw new Error("Informe o título do relatório.");
  if (!reportType) throw new Error("Informe o tipo de relatório.");

  const { error } = await supabase.from("nutrition_reports").insert({
    establishment_id: tenant.establishmentId,
    title,
    report_type: reportType,
    source_type: "manual",
    format: ["pdf", "docx", "xlsx", "html"].includes(format) ? format : "pdf",
    status: "draft",
    generated_by: tenant.userId,
  });

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create report draft error:", serializeError(error));
    throw new Error("Não foi possível preparar o relatório.");
  }

  revalidatePath("/nutricao/relatorios");
}
