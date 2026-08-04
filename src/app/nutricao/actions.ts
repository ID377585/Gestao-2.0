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
  startedAt?: string | null;
  completedAt?: string | null;
  totalItems?: number;
  compliancePercent?: number | null;
  createdAt: string;
};

export type InspectionTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  inspectionType: string;
  status: string;
  currentVersion: number;
  expectedDurationMinutes: number | null;
  itemCount: number;
  updatedAt: string;
};

export type InspectionExecutionItem = {
  id: string;
  sectionId: string | null;
  sectionTitle: string;
  title: string;
  instruction: string | null;
  responseType: string;
  orderIndex: number;
  defaultSeverity: string;
  commentRequired: boolean;
  createNonconformityOnFailure: boolean;
  answer: {
    id: string;
    conformityStatus: string | null;
    comment: string | null;
    answeredAt: string;
  } | null;
};

export type InspectionExecutionSnapshot = {
  id: string;
  title: string;
  inspectionCode: string | null;
  inspectionType: string;
  status: string;
  sector: string | null;
  scheduledFor: string | null;
  expectedDurationMinutes: number | null;
  startedAt: string | null;
  completedAt: string | null;
  totalItems: number;
  compliantItems: number;
  noncompliantItems: number;
  notApplicableItems: number;
  compliancePercent: number | null;
  result: string | null;
  templateName: string | null;
  items: InspectionExecutionItem[];
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

export type NonconformityDetail = NonconformityListItem & {
  description: string | null;
  sourceType: string;
  category: string | null;
  foodSafetyRisk: string | null;
  immediateContainment: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  correctionEvidenceSummary: string | null;
  validationResult: string | null;
  validationComment: string | null;
  validationAt: string | null;
  needsReinspection: boolean;
  reinspectionDueAt: string | null;
  reinspectionResult: string | null;
  closedAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  version: number;
  evidences: Array<{
    id: string;
    caption: string | null;
    category: string | null;
    fileName: string | null;
    createdAt: string;
  }>;
  reinspections: Array<{
    id: string;
    scheduledFor: string | null;
    scope: string | null;
    status: string;
    result: string | null;
    resultComment: string | null;
    completedAt: string | null;
  }>;
  timeline: Array<{
    id: string;
    action: string;
    reason: string | null;
    createdAt: string;
  }>;
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

export type ActionPlanItem = {
  id: string;
  title: string;
  description: string | null;
  sector: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  items: Array<{
    id: string;
    what: string;
    whereText: string | null;
    howText: string | null;
    status: string;
    priority: string;
    dueAt: string | null;
    progressPercent: number;
  }>;
};

export type NutritionSettingsItem = {
  status: NutritionModuleStatus;
  timezone: string;
  requireGeolocation: boolean;
  allowGeolocationRefusalWithReason: boolean;
  defaultLowDueDays: number;
  defaultMediumDueDays: number;
  defaultHighDueDays: number;
  defaultCriticalDueHours: number;
  message?: string;
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

function normalizePriority(value: string) {
  return ["low", "medium", "high", "critical"].includes(value)
    ? value
    : "medium";
}

function normalizeNonconformityStatus(value: string) {
  return [
    "open",
    "awaiting_acceptance",
    "in_correction",
    "awaiting_evidence",
    "awaiting_validation",
    "reinspection_scheduled",
    "in_reinspection",
    "failed_reinspection",
    "closed",
    "canceled",
  ].includes(value)
    ? value
    : "open";
}

function parseLineItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80);
}

function inspectionResultFromPercent(percent: number | null) {
  if (percent == null) return null;
  if (percent >= 90) return "approved";
  if (percent >= 70) return "approved_with_restrictions";
  return "failed";
}

async function appendNutritionAuditEvent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  params: {
    establishmentId: string;
    actorUserId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    beforeData?: Record<string, unknown> | null;
    afterData?: Record<string, unknown> | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("nutrition_audit_events").insert({
    establishment_id: params.establishmentId,
    actor_user_id: params.actorUserId,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    before_data: params.beforeData ?? null,
    after_data: params.afterData ?? null,
    reason: params.reason ?? null,
    metadata: params.metadata ?? {},
  });

  if (error && !isMissingNutritionTableError(error)) {
    console.error("[nutrition] audit event error:", serializeError(error));
  }
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

export async function listInspectionTemplates(): Promise<
  InspectionTemplateListItem[]
> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_inspection_templates")
    .select("id,name,description,inspection_type,status,current_version,expected_duration_minutes,updated_at")
    .eq("establishment_id", tenant.establishmentId)
    .neq("status", "canceled")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] templates list error:", serializeError(error));
    return [];
  }

  const templates = data ?? [];
  const templateIds = templates.map((row: any) => String(row.id));
  const itemCountByTemplate = new Map<string, number>();

  if (templateIds.length > 0) {
    const { data: versions, error: versionsError } = await supabase
      .from("nutrition_inspection_template_versions")
      .select("id,template_id,version")
      .eq("establishment_id", tenant.establishmentId)
      .in("template_id", templateIds);

    if (versionsError && !isMissingNutritionTableError(versionsError)) {
      console.error("[nutrition] template versions count error:", serializeError(versionsError));
    }

    const latestVersionByTemplate = new Map<string, string>();
    for (const version of versions ?? []) {
      const templateId = String((version as any).template_id ?? "");
      const versionId = String((version as any).id ?? "");
      const versionNumber = Number((version as any).version ?? 0);
      const current = latestVersionByTemplate.get(templateId);
      const currentVersion = versions?.find((item: any) => String(item.id) === current);

      if (!current || versionNumber > Number((currentVersion as any)?.version ?? 0)) {
        latestVersionByTemplate.set(templateId, versionId);
      }
    }

    const versionIds = Array.from(latestVersionByTemplate.values());
    if (versionIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from("nutrition_inspection_items")
        .select("template_version_id")
        .eq("establishment_id", tenant.establishmentId)
        .in("template_version_id", versionIds);

      if (itemsError && !isMissingNutritionTableError(itemsError)) {
        console.error("[nutrition] template items count error:", serializeError(itemsError));
      }

      const templateByVersion = new Map(
        Array.from(latestVersionByTemplate.entries()).map(([templateId, versionId]) => [
          versionId,
          templateId,
        ])
      );

      for (const item of items ?? []) {
        const templateId = templateByVersion.get(String((item as any).template_version_id ?? ""));
        if (!templateId) continue;
        itemCountByTemplate.set(templateId, (itemCountByTemplate.get(templateId) ?? 0) + 1);
      }
    }
  }

  return templates.map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : null,
    inspectionType: String(row.inspection_type ?? "vistoria"),
    status: String(row.status ?? "active"),
    currentVersion: Number(row.current_version ?? 1),
    expectedDurationMinutes:
      row.expected_duration_minutes == null
        ? null
        : Number(row.expected_duration_minutes),
    itemCount: itemCountByTemplate.get(String(row.id)) ?? 0,
    updatedAt: String(row.updated_at ?? ""),
  }));
}

export async function createInspectionTemplate(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const inspectionType = String(formData.get("inspection_type") ?? "vistoria").trim();
  const technicalReference = String(formData.get("technical_reference") ?? "").trim();
  const expectedDuration = Number(formData.get("expected_duration_minutes") ?? 0);
  const minimumApproval = Number(formData.get("minimum_approval_percent") ?? 0);
  const sectionTitle = String(formData.get("section_title") ?? "Geral").trim();
  const items = parseLineItems(String(formData.get("items") ?? ""));

  if (!name) throw new Error("Informe o nome do modelo.");
  if (items.length === 0) {
    throw new Error("Informe ao menos um item do checklist, um por linha.");
  }

  const snapshot = {
    name,
    description: description || null,
    inspection_type: inspectionType || "vistoria",
    technical_reference: technicalReference || null,
    items,
  };

  const { data: template, error: templateError } = await supabase
    .from("nutrition_inspection_templates")
    .insert({
      establishment_id: tenant.establishmentId,
      name,
      description: description || null,
      inspection_type: inspectionType || "vistoria",
      technical_reference: technicalReference || null,
      expected_duration_minutes:
        Number.isFinite(expectedDuration) && expectedDuration > 0
          ? expectedDuration
          : null,
      minimum_approval_percent:
        Number.isFinite(minimumApproval) && minimumApproval > 0
          ? minimumApproval
          : null,
      status: "active",
      current_version: 1,
      created_by: tenant.userId,
      updated_by: tenant.userId,
      approved_by: tenant.userId,
      approved_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (templateError) {
    if (isMissingNutritionTableError(templateError)) {
      throw new Error("A migration de execução de vistorias ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create template error:", serializeError(templateError));
    throw new Error("Não foi possível criar o modelo de vistoria.");
  }

  const { data: version, error: versionError } = await supabase
    .from("nutrition_inspection_template_versions")
    .insert({
      establishment_id: tenant.establishmentId,
      template_id: template.id,
      version: 1,
      status: "active",
      snapshot,
      created_by: tenant.userId,
      approved_by: tenant.userId,
      approved_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (versionError) {
    console.error("[nutrition] create template version error:", serializeError(versionError));
    throw new Error("O modelo foi criado, mas não foi possível versioná-lo.");
  }

  const { data: section, error: sectionError } = await supabase
    .from("nutrition_inspection_sections")
    .insert({
      establishment_id: tenant.establishmentId,
      template_version_id: version.id,
      title: sectionTitle || "Geral",
      order_index: 0,
    })
    .select("id")
    .single();

  if (sectionError) {
    console.error("[nutrition] create template section error:", serializeError(sectionError));
    throw new Error("O modelo foi criado, mas não foi possível criar a seção.");
  }

  const { error: itemsError } = await supabase
    .from("nutrition_inspection_items")
    .insert(
      items.map((title, index) => ({
        establishment_id: tenant.establishmentId,
        template_version_id: version.id,
        section_id: section.id,
        title,
        response_type: "conformity",
        order_index: index,
        default_severity: "medium",
        comment_required: false,
        create_nonconformity_on_failure: true,
      }))
    );

  if (itemsError) {
    console.error("[nutrition] create template items error:", serializeError(itemsError));
    throw new Error("O modelo foi criado, mas não foi possível cadastrar os itens.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/vistorias");
}

export async function listNutritionInspections(): Promise<InspectionListItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_inspections")
    .select(
      "id,title,inspection_code,inspection_type,status,sector,scheduled_for,inspector_user_id,started_at,completed_at,total_items,compliance_percent,created_at"
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
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    totalItems: row.total_items == null ? 0 : Number(row.total_items),
    compliancePercent:
      row.compliance_percent == null ? null : Number(row.compliance_percent),
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
  const templateId = String(formData.get("template_id") ?? "").trim();

  if (!title) throw new Error("Informe o título da vistoria.");

  let templatePayload: Record<string, unknown> = {};

  if (templateId) {
    const { data: template, error: templateError } = await supabase
      .from("nutrition_inspection_templates")
      .select("id,name,inspection_type,expected_duration_minutes,current_version")
      .eq("establishment_id", tenant.establishmentId)
      .eq("id", templateId)
      .neq("status", "canceled")
      .single();

    if (templateError || !template) {
      if (templateError && isMissingNutritionTableError(templateError)) {
        throw new Error("A migration de execução de vistorias ainda precisa ser aplicada.");
      }

      throw new Error("Modelo de vistoria não encontrado para este estabelecimento.");
    }

    const { data: version, error: versionError } = await supabase
      .from("nutrition_inspection_template_versions")
      .select("id,version,snapshot")
      .eq("establishment_id", tenant.establishmentId)
      .eq("template_id", templateId)
      .eq("version", Number((template as any).current_version ?? 1))
      .single();

    if (versionError || !version) {
      throw new Error("Versão ativa do modelo não encontrada.");
    }

    const { count, error: countError } = await supabase
      .from("nutrition_inspection_items")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", tenant.establishmentId)
      .eq("template_version_id", version.id);

    if (countError) {
      console.error("[nutrition] count template items error:", serializeError(countError));
      throw new Error("Não foi possível carregar os itens do modelo.");
    }

    templatePayload = {
      template_id: templateId,
      template_version_id: version.id,
      template_snapshot: version.snapshot ?? {},
      total_items: count ?? 0,
      inspection_type: String(
        (template as any).inspection_type ?? (inspectionType || "vistoria")
      ),
      expected_duration_minutes:
        Number.isFinite(expectedDuration) && expectedDuration > 0
          ? expectedDuration
          : ((template as any).expected_duration_minutes ?? null),
    };
  }

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
    ...templatePayload,
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

export async function getInspectionExecution(
  inspectionId: string
): Promise<InspectionExecutionSnapshot | null> {
  const { tenant, supabase } = await getNutritionContext();
  const { data: inspection, error } = await supabase
    .from("nutrition_inspections")
    .select(
      "id,title,inspection_code,inspection_type,status,sector,scheduled_for,expected_duration_minutes,started_at,completed_at,total_items,compliant_items,noncompliant_items,not_applicable_items,compliance_percent,result,template_id,template_version_id"
    )
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", inspectionId)
    .single();

  if (error) {
    if (isMissingNutritionTableError(error)) return null;
    console.error("[nutrition] inspection execution load error:", serializeError(error));
    return null;
  }

  if (!inspection) return null;

  let templateName: string | null = null;
  if ((inspection as any).template_id) {
    const { data: template } = await supabase
      .from("nutrition_inspection_templates")
      .select("name")
      .eq("establishment_id", tenant.establishmentId)
      .eq("id", String((inspection as any).template_id))
      .maybeSingle();
    templateName = template?.name ? String(template.name) : null;
  }

  const templateVersionId = (inspection as any).template_version_id
    ? String((inspection as any).template_version_id)
    : "";

  const { data: items, error: itemsError } = templateVersionId
    ? await supabase
        .from("nutrition_inspection_items")
        .select(
          "id,section_id,title,instruction,response_type,order_index,default_severity,comment_required,create_nonconformity_on_failure,nutrition_inspection_sections(title,order_index)"
        )
        .eq("establishment_id", tenant.establishmentId)
        .eq("template_version_id", templateVersionId)
        .order("order_index", { ascending: true })
    : { data: [], error: null };

  if (itemsError) {
    console.error("[nutrition] inspection items load error:", serializeError(itemsError));
  }

  const itemIds = (items ?? []).map((row: any) => String(row.id));
  const answerByItemId = new Map<
    string,
    {
      id: string;
      conformityStatus: string | null;
      comment: string | null;
      answeredAt: string;
    }
  >();

  if (itemIds.length > 0) {
    const { data: answers, error: answersError } = await supabase
      .from("nutrition_inspection_answers")
      .select("id,item_id,conformity_status,comment,answered_at")
      .eq("establishment_id", tenant.establishmentId)
      .eq("inspection_id", inspectionId)
      .in("item_id", itemIds);

    if (answersError && !isMissingNutritionTableError(answersError)) {
      console.error("[nutrition] inspection answers load error:", serializeError(answersError));
    }

    for (const answer of answers ?? []) {
      const itemId = String((answer as any).item_id ?? "");
      if (!itemId) continue;
      answerByItemId.set(itemId, {
        id: String((answer as any).id),
        conformityStatus: (answer as any).conformity_status
          ? String((answer as any).conformity_status)
          : null,
        comment: (answer as any).comment ? String((answer as any).comment) : null,
        answeredAt: String((answer as any).answered_at ?? ""),
      });
    }
  }

  return {
    id: String((inspection as any).id),
    title: String((inspection as any).title ?? ""),
    inspectionCode: (inspection as any).inspection_code
      ? String((inspection as any).inspection_code)
      : null,
    inspectionType: String((inspection as any).inspection_type ?? "vistoria"),
    status: String((inspection as any).status ?? "scheduled"),
    sector: (inspection as any).sector ? String((inspection as any).sector) : null,
    scheduledFor: (inspection as any).scheduled_for
      ? String((inspection as any).scheduled_for)
      : null,
    expectedDurationMinutes:
      (inspection as any).expected_duration_minutes == null
        ? null
        : Number((inspection as any).expected_duration_minutes),
    startedAt: (inspection as any).started_at
      ? String((inspection as any).started_at)
      : null,
    completedAt: (inspection as any).completed_at
      ? String((inspection as any).completed_at)
      : null,
    totalItems: Number((inspection as any).total_items ?? itemIds.length),
    compliantItems: Number((inspection as any).compliant_items ?? 0),
    noncompliantItems: Number((inspection as any).noncompliant_items ?? 0),
    notApplicableItems: Number((inspection as any).not_applicable_items ?? 0),
    compliancePercent:
      (inspection as any).compliance_percent == null
        ? null
        : Number((inspection as any).compliance_percent),
    result: (inspection as any).result ? String((inspection as any).result) : null,
    templateName,
    items: (items ?? []).map((row: any) => {
      const section = Array.isArray(row.nutrition_inspection_sections)
        ? row.nutrition_inspection_sections[0]
        : row.nutrition_inspection_sections;

      return {
        id: String(row.id),
        sectionId: row.section_id ? String(row.section_id) : null,
        sectionTitle: section?.title ? String(section.title) : "Geral",
        title: String(row.title ?? ""),
        instruction: row.instruction ? String(row.instruction) : null,
        responseType: String(row.response_type ?? "conformity"),
        orderIndex: Number(row.order_index ?? 0),
        defaultSeverity: String(row.default_severity ?? "medium"),
        commentRequired: Boolean(row.comment_required),
        createNonconformityOnFailure: Boolean(row.create_nonconformity_on_failure),
        answer: answerByItemId.get(String(row.id)) ?? null,
      };
    }),
  };
}

export async function startInspection(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const inspectionId = String(formData.get("inspection_id") ?? "").trim();
  if (!inspectionId) throw new Error("Vistoria não informada.");

  const { error } = await supabase
    .from("nutrition_inspections")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
      updated_by: tenant.userId,
    })
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", inspectionId)
    .in("status", ["scheduled", "paused", "overdue"]);

  if (error) {
    console.error("[nutrition] start inspection error:", serializeError(error));
    throw new Error("Não foi possível iniciar a vistoria.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/vistorias");
  revalidatePath(`/nutricao/vistorias/${inspectionId}`);
}

export async function saveInspectionAnswer(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const inspectionId = String(formData.get("inspection_id") ?? "").trim();
  const itemId = String(formData.get("item_id") ?? "").trim();
  const sectionId = String(formData.get("section_id") ?? "").trim();
  const responseType = String(formData.get("response_type") ?? "conformity").trim();
  const conformityStatus = String(formData.get("conformity_status") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const itemTitle = String(formData.get("item_title") ?? "Item de vistoria").trim();
  const severity = normalizePriority(String(formData.get("severity") ?? "medium").trim());
  const createNonconformity = formData.get("create_nonconformity") === "true";

  if (!inspectionId || !itemId) throw new Error("Item de vistoria não informado.");
  if (!["compliant", "noncompliant", "not_applicable"].includes(conformityStatus)) {
    throw new Error("Informe o resultado do item.");
  }

  const { data: inspection, error: inspectionError } = await supabase
    .from("nutrition_inspections")
    .select("id,status,sector")
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", inspectionId)
    .single();

  if (inspectionError || !inspection) {
    throw new Error("Vistoria não encontrada para este estabelecimento.");
  }

  if (String((inspection as any).status) === "completed") {
    throw new Error("Vistoria concluída não pode receber novas respostas.");
  }

  const { data: answer, error } = await supabase
    .from("nutrition_inspection_answers")
    .upsert(
      {
        establishment_id: tenant.establishmentId,
        inspection_id: inspectionId,
        item_id: itemId,
        section_id: sectionId || null,
        response_type: responseType || "conformity",
        response_value: { conformity_status: conformityStatus },
        conformity_status: conformityStatus,
        comment: comment || null,
        answered_by: tenant.userId,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "establishment_id,inspection_id,item_id" }
    )
    .select("id")
    .single();

  if (error) {
    console.error("[nutrition] save inspection answer error:", serializeError(error));
    throw new Error("Não foi possível salvar a resposta.");
  }

  if (
    conformityStatus === "noncompliant" &&
    createNonconformity &&
    answer?.id
  ) {
    const { data: existingNonconformity, error: existingError } = await supabase
      .from("nutrition_nonconformities")
      .select("id")
      .eq("establishment_id", tenant.establishmentId)
      .eq("inspection_id", inspectionId)
      .eq("source_type", "inspection_item")
      .eq("source_id", itemId)
      .neq("status", "canceled")
      .maybeSingle();

    if (existingError && !isMissingNutritionTableError(existingError)) {
      console.error(
        "[nutrition] auto nonconformity lookup error:",
        serializeError(existingError)
      );
    }

    if (!existingNonconformity) {
      const { error: nonconformityError } = await supabase
      .from("nutrition_nonconformities")
      .insert({
        establishment_id: tenant.establishmentId,
        source_type: "inspection_item",
        source_id: itemId,
        inspection_id: inspectionId,
        answer_id: answer.id,
        title: `Vistoria: ${itemTitle}`,
        description: comment || "Item marcado como não conforme.",
        sector: (inspection as any).sector ?? null,
        severity,
        status: "open",
        created_by: tenant.userId,
        updated_by: tenant.userId,
      });

      if (nonconformityError) {
        console.error(
          "[nutrition] auto nonconformity error:",
          serializeError(nonconformityError)
        );
      }
    }
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/vistorias");
  revalidatePath(`/nutricao/vistorias/${inspectionId}`);
}

export async function completeInspection(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const inspectionId = String(formData.get("inspection_id") ?? "").trim();
  if (!inspectionId) throw new Error("Vistoria não informada.");

  const snapshot = await getInspectionExecution(inspectionId);
  if (!snapshot) throw new Error("Vistoria não encontrada.");
  if (snapshot.status === "completed") return;

  if (snapshot.items.length === 0) {
    throw new Error("A vistoria não possui itens para conclusão.");
  }

  const answeredItems = snapshot.items.filter((item) => item.answer);
  if (answeredItems.length < snapshot.items.length) {
    throw new Error("Responda todos os itens obrigatórios antes de concluir.");
  }

  const compliant = answeredItems.filter(
    (item) => item.answer?.conformityStatus === "compliant"
  ).length;
  const noncompliant = answeredItems.filter(
    (item) => item.answer?.conformityStatus === "noncompliant"
  ).length;
  const notApplicable = answeredItems.filter(
    (item) => item.answer?.conformityStatus === "not_applicable"
  ).length;
  const applicable = Math.max(answeredItems.length - notApplicable, 0);
  const compliancePercent =
    applicable > 0 ? Number(((compliant / applicable) * 100).toFixed(2)) : 100;

  const { error } = await supabase
    .from("nutrition_inspections")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      total_items: snapshot.items.length,
      compliant_items: compliant,
      noncompliant_items: noncompliant,
      not_applicable_items: notApplicable,
      compliance_percent: compliancePercent,
      result: inspectionResultFromPercent(compliancePercent),
      updated_by: tenant.userId,
    })
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", inspectionId)
    .neq("status", "completed");

  if (error) {
    console.error("[nutrition] complete inspection error:", serializeError(error));
    throw new Error("Não foi possível concluir a vistoria.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/vistorias");
  revalidatePath(`/nutricao/vistorias/${inspectionId}`);
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

export async function getNutritionNonconformityDetail(
  nonconformityId: string
): Promise<NonconformityDetail | null> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_nonconformities")
    .select(
      [
        "id",
        "code",
        "source_type",
        "title",
        "description",
        "sector",
        "location",
        "category",
        "severity",
        "food_safety_risk",
        "immediate_containment",
        "opened_at",
        "due_at",
        "status",
        "root_cause",
        "corrective_action",
        "correction_evidence_summary",
        "validation_result",
        "validation_comment",
        "validation_at",
        "needs_reinspection",
        "reinspection_due_at",
        "reinspection_result",
        "closed_at",
        "canceled_at",
        "cancel_reason",
        "version",
      ].join(",")
    )
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", nonconformityId)
    .maybeSingle();

  if (error) {
    if (isMissingNutritionTableError(error)) return null;
    console.error("[nutrition] nonconformity detail error:", serializeError(error));
    return null;
  }

  if (!data) return null;

  const [evidencesResult, reinspectionsResult, timelineResult] = await Promise.all([
    supabase
      .from("nutrition_evidences")
      .select("id,caption,category,file_name,created_at")
      .eq("establishment_id", tenant.establishmentId)
      .eq("nonconformity_id", nonconformityId)
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("nutrition_reinspections")
      .select("id,scheduled_for,scope,status,result,result_comment,completed_at")
      .eq("establishment_id", tenant.establishmentId)
      .eq("nonconformity_id", nonconformityId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("nutrition_audit_events")
      .select("id,action,reason,created_at")
      .eq("establishment_id", tenant.establishmentId)
      .eq("resource_type", "nonconformity")
      .eq("resource_id", nonconformityId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const row = data as any;

  return {
    id: String(row.id),
    code: row.code ? String(row.code) : null,
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : null,
    sourceType: String(row.source_type ?? "manual"),
    severity: String(row.severity ?? "medium"),
    status: String(row.status ?? "open"),
    sector: row.sector ? String(row.sector) : null,
    location: row.location ? String(row.location) : null,
    category: row.category ? String(row.category) : null,
    foodSafetyRisk: row.food_safety_risk ? String(row.food_safety_risk) : null,
    immediateContainment: row.immediate_containment
      ? String(row.immediate_containment)
      : null,
    dueAt: row.due_at ? String(row.due_at) : null,
    openedAt: String(row.opened_at ?? ""),
    rootCause: row.root_cause ? String(row.root_cause) : null,
    correctiveAction: row.corrective_action ? String(row.corrective_action) : null,
    correctionEvidenceSummary: row.correction_evidence_summary
      ? String(row.correction_evidence_summary)
      : null,
    validationResult: row.validation_result ? String(row.validation_result) : null,
    validationComment: row.validation_comment ? String(row.validation_comment) : null,
    validationAt: row.validation_at ? String(row.validation_at) : null,
    needsReinspection: Boolean(row.needs_reinspection),
    reinspectionDueAt: row.reinspection_due_at
      ? String(row.reinspection_due_at)
      : null,
    reinspectionResult: row.reinspection_result
      ? String(row.reinspection_result)
      : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    canceledAt: row.canceled_at ? String(row.canceled_at) : null,
    cancelReason: row.cancel_reason ? String(row.cancel_reason) : null,
    version: Number(row.version ?? 1),
    evidences: ((evidencesResult.data ?? []) as any[]).map((item) => ({
      id: String(item.id),
      caption: item.caption ? String(item.caption) : null,
      category: item.category ? String(item.category) : null,
      fileName: item.file_name ? String(item.file_name) : null,
      createdAt: String(item.created_at ?? ""),
    })),
    reinspections: ((reinspectionsResult.data ?? []) as any[]).map((item) => ({
      id: String(item.id),
      scheduledFor: item.scheduled_for ? String(item.scheduled_for) : null,
      scope: item.scope ? String(item.scope) : null,
      status: String(item.status ?? "scheduled"),
      result: item.result ? String(item.result) : null,
      resultComment: item.result_comment ? String(item.result_comment) : null,
      completedAt: item.completed_at ? String(item.completed_at) : null,
    })),
    timeline: ((timelineResult.data ?? []) as any[]).map((item) => ({
      id: String(item.id),
      action: String(item.action ?? ""),
      reason: item.reason ? String(item.reason) : null,
      createdAt: String(item.created_at ?? ""),
    })),
  };
}

async function updateNonconformityWorkflow(
  formData: FormData,
  params: {
    action: string;
    values: Record<string, unknown>;
    allowedStatuses?: string[];
    reason?: string | null;
  }
) {
  const { tenant, supabase } = await getNutritionContext();
  const id = String(formData.get("nonconformity_id") ?? "").trim();
  const version = Number(formData.get("version") ?? 0);

  if (!id) throw new Error("Não conformidade inválida.");
  if (!Number.isFinite(version) || version < 1) {
    throw new Error("Atualize a página antes de salvar esta ocorrência.");
  }

  const { data: current, error: currentError } = await supabase
    .from("nutrition_nonconformities")
    .select("id,status,version")
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", id)
    .maybeSingle();

  if (currentError || !current) {
    console.error("[nutrition] nonconformity current error:", serializeError(currentError));
    throw new Error("Não conformidade não encontrada para este estabelecimento.");
  }

  const beforeStatus = String((current as any).status ?? "open");
  if (
    params.allowedStatuses?.length &&
    !params.allowedStatuses.includes(beforeStatus)
  ) {
    throw new Error("Esta ocorrência não está em um status compatível com esta ação.");
  }

  const { data: updated, error } = await supabase
    .from("nutrition_nonconformities")
    .update({
      ...params.values,
      updated_by: tenant.userId,
      version: version + 1,
    })
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", id)
    .eq("version", version)
    .select("id,status,version")
    .maybeSingle();

  if (error || !updated) {
    console.error("[nutrition] nonconformity workflow error:", serializeError(error));
    throw new Error(
      "Não foi possível salvar. A ocorrência pode ter sido alterada por outra pessoa."
    );
  }

  await appendNutritionAuditEvent(supabase, {
    establishmentId: tenant.establishmentId,
    actorUserId: tenant.userId,
    action: params.action,
    resourceType: "nonconformity",
    resourceId: id,
    beforeData: { status: beforeStatus, version },
    afterData: {
      status: String((updated as any).status ?? ""),
      version: Number((updated as any).version ?? version + 1),
    },
    reason: params.reason ?? null,
  });

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/nao-conformidades");
  revalidatePath(`/nutricao/nao-conformidades/${id}`);
}

export async function acceptNutritionNonconformity(formData: FormData) {
  await updateNonconformityWorkflow(formData, {
    action: "nonconformity.accepted",
    allowedStatuses: ["open", "awaiting_acceptance"],
    values: {
      status: "in_correction",
    },
  });
}

export async function submitNutritionCorrection(formData: FormData) {
  const rootCause = String(formData.get("root_cause") ?? "").trim();
  const correctiveAction = String(formData.get("corrective_action") ?? "").trim();
  const evidenceSummary = String(
    formData.get("correction_evidence_summary") ?? ""
  ).trim();

  if (!rootCause) throw new Error("Informe a causa raiz.");
  if (!correctiveAction) throw new Error("Informe a ação corretiva.");
  if (!evidenceSummary) throw new Error("Descreva a evidência da correção.");

  await updateNonconformityWorkflow(formData, {
    action: "nonconformity.correction_submitted",
    allowedStatuses: [
      "open",
      "awaiting_acceptance",
      "in_correction",
      "awaiting_evidence",
      "failed_reinspection",
    ],
    values: {
      root_cause: rootCause,
      corrective_action: correctiveAction,
      correction_evidence_summary: evidenceSummary,
      status: "awaiting_validation",
      validation_result: null,
      validation_comment: null,
      validation_at: null,
    },
  });
}

export async function validateNutritionCorrection(formData: FormData) {
  const result = String(formData.get("validation_result") ?? "").trim();
  const comment = String(formData.get("validation_comment") ?? "").trim();
  const needsReinspection = formData.get("needs_reinspection") === "on";

  if (!["approved", "rejected"].includes(result)) {
    throw new Error("Escolha o resultado da validação.");
  }

  if (result === "rejected" && !comment) {
    throw new Error("Informe o motivo da rejeição.");
  }

  const status =
    result === "approved"
      ? needsReinspection
        ? "reinspection_scheduled"
        : "closed"
      : "in_correction";

  await updateNonconformityWorkflow(formData, {
    action:
      result === "approved"
        ? "nonconformity.validation_approved"
        : "nonconformity.validation_rejected",
    allowedStatuses: ["awaiting_validation"],
    reason: comment || null,
    values: {
      validation_result: result,
      validation_comment: comment || null,
      validation_at: new Date().toISOString(),
      needs_reinspection: needsReinspection,
      status,
      closed_at: status === "closed" ? new Date().toISOString() : null,
    },
  });
}

export async function scheduleNutritionReinspection(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const nonconformityId = String(formData.get("nonconformity_id") ?? "").trim();
  const version = Number(formData.get("version") ?? 0);
  const scheduledFor = String(formData.get("scheduled_for") ?? "").trim();
  const scope = String(formData.get("scope") ?? "").trim();

  if (!nonconformityId) throw new Error("Não conformidade inválida.");
  if (!scheduledFor) throw new Error("Informe a data da reinspeção.");

  const { data: current, error: currentError } = await supabase
    .from("nutrition_nonconformities")
    .select("id,status,inspection_id,version")
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", nonconformityId)
    .maybeSingle();

  if (currentError || !current) {
    console.error("[nutrition] schedule reinspection current error:", serializeError(currentError));
    throw new Error("Não conformidade não encontrada para este estabelecimento.");
  }

  const { error: insertError } = await supabase.from("nutrition_reinspections").insert({
    establishment_id: tenant.establishmentId,
    nonconformity_id: nonconformityId,
    original_inspection_id: (current as any).inspection_id ?? null,
    scheduled_for: new Date(scheduledFor).toISOString(),
    scope: scope || null,
    status: "scheduled",
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (insertError) {
    console.error("[nutrition] schedule reinspection insert error:", serializeError(insertError));
    throw new Error("Não foi possível agendar a reinspeção.");
  }

  await updateNonconformityWorkflow(formData, {
    action: "nonconformity.reinspection_scheduled",
    allowedStatuses: [
      "awaiting_validation",
      "reinspection_scheduled",
      "failed_reinspection",
      "in_correction",
    ],
    values: {
      needs_reinspection: true,
      reinspection_due_at: new Date(scheduledFor).toISOString(),
      status: "reinspection_scheduled",
      version,
    },
    reason: scope || null,
  });
}

export async function completeNutritionReinspection(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const nonconformityId = String(formData.get("nonconformity_id") ?? "").trim();
  const reinspectionId = String(formData.get("reinspection_id") ?? "").trim();
  const version = Number(formData.get("version") ?? 0);
  const result = String(formData.get("result") ?? "").trim();
  const comment = String(formData.get("result_comment") ?? "").trim();

  if (!nonconformityId || !reinspectionId) throw new Error("Reinspeção inválida.");
  if (!["approved", "rejected"].includes(result)) {
    throw new Error("Escolha o resultado da reinspeção.");
  }
  if (result === "rejected" && !comment) {
    throw new Error("Informe o motivo da reprovação.");
  }

  const { error: reinspectionError } = await supabase
    .from("nutrition_reinspections")
    .update({
      status: "completed",
      result,
      result_comment: comment || null,
      completed_at: new Date().toISOString(),
      updated_by: tenant.userId,
    })
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", reinspectionId)
    .eq("nonconformity_id", nonconformityId);

  if (reinspectionError) {
    console.error("[nutrition] complete reinspection error:", serializeError(reinspectionError));
    throw new Error("Não foi possível concluir a reinspeção.");
  }

  await updateNonconformityWorkflow(formData, {
    action:
      result === "approved"
        ? "nonconformity.reinspection_approved"
        : "nonconformity.reinspection_rejected",
    allowedStatuses: ["reinspection_scheduled", "in_reinspection", "failed_reinspection"],
    reason: comment || null,
    values: {
      reinspection_result: result,
      status: result === "approved" ? "closed" : "failed_reinspection",
      closed_at: result === "approved" ? new Date().toISOString() : null,
      version,
    },
  });
}

export async function cancelNutritionNonconformity(formData: FormData) {
  const reason = String(formData.get("cancel_reason") ?? "").trim();
  if (!reason) throw new Error("Informe a justificativa do cancelamento.");

  await updateNonconformityWorkflow(formData, {
    action: "nonconformity.canceled",
    allowedStatuses: [
      "open",
      "awaiting_acceptance",
      "in_correction",
      "awaiting_evidence",
      "awaiting_validation",
      "reinspection_scheduled",
      "failed_reinspection",
    ],
    reason,
    values: {
      status: "canceled",
      cancel_reason: reason,
      canceled_at: new Date().toISOString(),
    },
  });
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

export async function listActionPlans(): Promise<ActionPlanItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_action_plans")
    .select(
      "id,title,description,sector,status,priority,due_at,nutrition_action_items(id,what,where_text,how_text,status,priority,due_at,progress_percent)"
    )
    .eq("establishment_id", tenant.establishmentId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] action plans list error:", serializeError(error));
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : null,
    sector: row.sector ? String(row.sector) : null,
    status: String(row.status ?? "open"),
    priority: String(row.priority ?? "medium"),
    dueAt: row.due_at ? String(row.due_at) : null,
    items: Array.isArray(row.nutrition_action_items)
      ? row.nutrition_action_items.map((item: any) => ({
          id: String(item.id),
          what: String(item.what ?? ""),
          whereText: item.where_text ? String(item.where_text) : null,
          howText: item.how_text ? String(item.how_text) : null,
          status: String(item.status ?? "pending"),
          priority: String(item.priority ?? "medium"),
          dueAt: item.due_at ? String(item.due_at) : null,
          progressPercent:
            item.progress_percent == null ? 0 : Number(item.progress_percent),
        }))
      : [],
  }));
}

export async function createActionPlan(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sector = String(formData.get("sector") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium").trim();
  const dueAt = String(formData.get("due_at") ?? "").trim();
  const firstAction = String(formData.get("first_action") ?? "").trim();
  const why = String(formData.get("why") ?? "").trim();
  const whereText = String(formData.get("where_text") ?? "").trim();
  const howText = String(formData.get("how_text") ?? "").trim();

  if (!title) throw new Error("Informe o título do plano de ação.");
  if (!firstAction) throw new Error("Informe ao menos uma ação inicial.");

  const normalizedPriority = ["low", "medium", "high", "critical"].includes(priority)
    ? priority
    : "medium";

  const { data: plan, error: planError } = await supabase
    .from("nutrition_action_plans")
    .insert({
      establishment_id: tenant.establishmentId,
      title,
      description: description || null,
      source_type: "manual",
      sector: sector || null,
      status: "open",
      priority: normalizedPriority,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      created_by: tenant.userId,
      updated_by: tenant.userId,
    })
    .select("id")
    .single();

  if (planError) {
    if (isMissingNutritionTableError(planError)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create action plan error:", serializeError(planError));
    throw new Error("Não foi possível criar o plano de ação.");
  }

  const { error: itemError } = await supabase.from("nutrition_action_items").insert({
    establishment_id: tenant.establishmentId,
    action_plan_id: plan.id,
    what: firstAction,
    why: why || null,
    where_text: whereText || null,
    how_text: howText || null,
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
    status: "pending",
    priority: normalizedPriority,
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (itemError) {
    console.error("[nutrition] create action item error:", serializeError(itemError));
    throw new Error("O plano foi criado, mas não foi possível cadastrar a primeira ação.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/planos-de-acao");
}

export async function createActionItem(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const actionPlanId = String(formData.get("action_plan_id") ?? "").trim();
  const what = String(formData.get("what") ?? "").trim();
  const why = String(formData.get("why") ?? "").trim();
  const whereText = String(formData.get("where_text") ?? "").trim();
  const howText = String(formData.get("how_text") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium").trim();
  const dueAt = String(formData.get("due_at") ?? "").trim();

  if (!actionPlanId) throw new Error("Selecione o plano de ação.");
  if (!what) throw new Error("Informe a ação.");

  const { data: plan, error: planError } = await supabase
    .from("nutrition_action_plans")
    .select("id")
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", actionPlanId)
    .single();

  if (planError || !plan) {
    if (planError && isMissingNutritionTableError(planError)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    throw new Error("Plano de ação não encontrado para este estabelecimento.");
  }

  const { error } = await supabase.from("nutrition_action_items").insert({
    establishment_id: tenant.establishmentId,
    action_plan_id: actionPlanId,
    what,
    why: why || null,
    where_text: whereText || null,
    how_text: howText || null,
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
    status: "pending",
    priority: ["low", "medium", "high", "critical"].includes(priority)
      ? priority
      : "medium",
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    console.error("[nutrition] create action item error:", serializeError(error));
    throw new Error("Não foi possível cadastrar a ação.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/planos-de-acao");
}

export async function getNutritionSettings(): Promise<NutritionSettingsItem> {
  const { tenant, supabase } = await getNutritionContext();
  const fallback: NutritionSettingsItem = {
    status: "ready",
    timezone: "America/Sao_Paulo",
    requireGeolocation: false,
    allowGeolocationRefusalWithReason: true,
    defaultLowDueDays: 7,
    defaultMediumDueDays: 3,
    defaultHighDueDays: 1,
    defaultCriticalDueHours: 4,
  };

  const { data, error } = await supabase
    .from("nutrition_settings")
    .select(
      "timezone,require_geolocation,allow_geolocation_refusal_with_reason,default_low_due_days,default_medium_due_days,default_high_due_days,default_critical_due_hours"
    )
    .eq("establishment_id", tenant.establishmentId)
    .maybeSingle();

  if (error) {
    if (isMissingNutritionTableError(error)) {
      return {
        ...fallback,
        status: "migration_pending",
        message: "A migration de banco do módulo Nutrição ainda precisa ser aplicada.",
      };
    }

    console.error("[nutrition] settings load error:", serializeError(error));
    return {
      ...fallback,
      status: "error",
      message: "Não foi possível carregar as configurações de Nutrição.",
    };
  }

  if (!data) return fallback;

  return {
    status: "ready",
    timezone: String(data.timezone ?? fallback.timezone),
    requireGeolocation: Boolean(data.require_geolocation),
    allowGeolocationRefusalWithReason: Boolean(
      data.allow_geolocation_refusal_with_reason
    ),
    defaultLowDueDays: Number(data.default_low_due_days ?? fallback.defaultLowDueDays),
    defaultMediumDueDays: Number(
      data.default_medium_due_days ?? fallback.defaultMediumDueDays
    ),
    defaultHighDueDays: Number(
      data.default_high_due_days ?? fallback.defaultHighDueDays
    ),
    defaultCriticalDueHours: Number(
      data.default_critical_due_hours ?? fallback.defaultCriticalDueHours
    ),
  };
}

export async function updateNutritionSettings(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const timezone = String(formData.get("timezone") ?? "America/Sao_Paulo").trim();
  const lowDays = Number(formData.get("default_low_due_days") ?? 7);
  const mediumDays = Number(formData.get("default_medium_due_days") ?? 3);
  const highDays = Number(formData.get("default_high_due_days") ?? 1);
  const criticalHours = Number(formData.get("default_critical_due_hours") ?? 4);

  const { error } = await supabase.from("nutrition_settings").upsert(
    {
      establishment_id: tenant.establishmentId,
      timezone: timezone || "America/Sao_Paulo",
      require_geolocation: formData.get("require_geolocation") === "on",
      allow_geolocation_refusal_with_reason:
        formData.get("allow_geolocation_refusal_with_reason") === "on",
      default_low_due_days:
        Number.isFinite(lowDays) && lowDays >= 1 && lowDays <= 365 ? lowDays : 7,
      default_medium_due_days:
        Number.isFinite(mediumDays) && mediumDays >= 1 && mediumDays <= 365
          ? mediumDays
          : 3,
      default_high_due_days:
        Number.isFinite(highDays) && highDays >= 0 && highDays <= 365
          ? highDays
          : 1,
      default_critical_due_hours:
        Number.isFinite(criticalHours) && criticalHours >= 1 && criticalHours <= 720
          ? criticalHours
          : 4,
      updated_by: tenant.userId,
      created_by: tenant.userId,
    },
    { onConflict: "establishment_id" }
  );

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] settings update error:", serializeError(error));
    throw new Error("Não foi possível salvar as configurações de Nutrição.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/configuracoes");
}
