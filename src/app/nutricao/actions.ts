"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenantOrRedirect } from "@/lib/tenant/guards";
import { assertTenantCanAccessModule } from "@/lib/tenant/module-access";
import { enqueueAppJob } from "@/lib/queue/app-jobs";
import { createNotification } from "@/lib/notifications";

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
  evidenceRequired: boolean;
  createNonconformityOnFailure: boolean;
  evidences: NutritionEvidenceItem[];
  answer: {
    id: string;
    conformityStatus: string | null;
    comment: string | null;
    answeredAt: string;
  } | null;
};

export type NutritionEvidenceItem = {
  id: string;
  caption: string | null;
  category: string | null;
  fileName: string | null;
  mimeType: string;
  fileSizeBytes: number | null;
  url: string;
  createdAt: string;
};

export type NutritionSignatureItem = {
  id: string;
  signerName: string;
  signerRole: string | null;
  signatureUrl: string | null;
  signatureHash: string | null;
  refusalReason: string | null;
  witnessName: string | null;
  signedAt: string | null;
  createdAt: string;
};

export type NutritionReportFileItem = {
  id: string;
  title: string;
  format: string;
  status: string;
  version: number;
  fileUrl: string | null;
  contentHash: string | null;
  generatedAt: string | null;
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
  geolocationStatus: string;
  latitude: number | null;
  longitude: number | null;
  geolocationAccuracyMeters: number | null;
  geolocationFailureReason: string | null;
  geolocationCapturedAt: string | null;
  requiresSignature: boolean;
  requiresGeolocation: boolean;
  completionIntegrityHash: string | null;
  templateName: string | null;
  items: InspectionExecutionItem[];
  evidences: NutritionEvidenceItem[];
  signatures: NutritionSignatureItem[];
  reports: NutritionReportFileItem[];
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
    mimeType: string;
    fileSizeBytes: number | null;
    url: string;
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
    thermometerName: string | null;
  } | null;
};

export type PopItem = {
  id: string;
  code: string | null;
  title: string;
  status: string;
  nextReviewAt: string | null;
  sectors: string[];
  currentVersion: number;
  fileUrl: string | null;
};

export type SanitationPlanItem = {
  id: string;
  name: string;
  sector: string | null;
  targetItem: string;
  productName: string | null;
  status: string;
  evidenceRequired: boolean;
  latestRecord?: {
    id: string;
    status: string;
    result: string | null;
    executedAt: string | null;
  } | null;
};

export type NutritionThermometerItem = {
  id: string;
  name: string;
  identifier: string | null;
  calibrationDueAt: string | null;
  verificationDueAt: string | null;
  status: string;
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
  currentVersion: number;
  fileUrl: string | null;
  fileName: string | null;
};

export type TrainingItem = {
  id: string;
  title: string;
  instructor: string | null;
  workloadMinutes: number | null;
  validityDays: number | null;
  status: string;
  latestSession?: {
    id: string;
    scheduledFor: string | null;
    status: string;
    location: string | null;
  } | null;
};

export type SupplierAssessmentItem = {
  id: string;
  supplierName: string;
  assessmentDate: string;
  qualityScore: number | null;
  sanitaryStatus: string;
  categoriesSummary: string | null;
  documentUrl: string | null;
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

const NUTRITION_FILES_BUCKET = "nutrition-files";
const MAX_NUTRITION_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_NUTRITION_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/html",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function sanitizeFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "arquivo"
  );
}

function nutritionFileUrl(filePath: string | null | undefined) {
  if (!filePath) return null;
  return `/api/nutricao/files?path=${encodeURIComponent(filePath)}`;
}

function hashPayload(value: unknown) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}

function fileChecksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function getFileExtension(fileName: string, mimeType: string) {
  const explicit = fileName.match(/\.([a-zA-Z0-9]{1,12})$/)?.[1];
  if (explicit) return explicit.toLowerCase();

  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "application/pdf": "pdf",
    "text/html": "html",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };

  return byMime[mimeType] ?? "bin";
}

async function uploadNutritionManagedFile(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  establishmentId: string;
  resourceType: string;
  resourceId: string;
  file: File | null;
  version?: number;
}) {
  if (!params.file || params.file.size <= 0) return null;

  if (params.file.size > MAX_NUTRITION_FILE_SIZE) {
    throw new Error("Arquivo acima do limite de 20 MB.");
  }

  if (!ALLOWED_NUTRITION_MIME_TYPES.has(params.file.type)) {
    throw new Error("Tipo de arquivo não permitido para o módulo Nutrição.");
  }

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const checksum = fileChecksum(buffer);
  const safeName = sanitizeFileName(params.file.name || "arquivo");
  const extension = getFileExtension(safeName, params.file.type);
  const version = params.version ?? 1;
  const filePath = `${params.establishmentId}/${params.resourceType}/${params.resourceId}/v${version}/${randomUUID()}-${checksum.slice(0, 12)}.${extension}`;

  const { error } = await params.supabase.storage
    .from(NUTRITION_FILES_BUCKET)
    .upload(filePath, buffer, {
      contentType: params.file.type,
      upsert: false,
    });

  if (error) {
    console.error("[nutrition] managed file upload error:", serializeError(error));
    throw new Error("Não foi possível armazenar o arquivo privado.");
  }

  return {
    filePath,
    fileName: safeName,
    mimeType: params.file.type,
    fileSizeBytes: params.file.size,
    checksum,
  };
}

async function createNutritionScopedNotification(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  params: {
    establishmentId: string;
    userId: string;
    type: string;
    priority?: "low" | "normal" | "high" | "critical";
    title: string;
    message: string;
    resourceType?: string;
    resourceId?: string;
    href?: string;
    dueAt?: string | null;
    dedupeKey: string;
    payload?: Record<string, unknown>;
  }
) {
  const priority = params.priority ?? "normal";
  const payload = {
    ...(params.payload ?? {}),
    establishment_id: params.establishmentId,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
  };

  const { error } = await supabase.rpc("enqueue_nutrition_notification", {
    p_establishment_id: params.establishmentId,
    p_type: params.type,
    p_priority: priority,
    p_title: params.title,
    p_message: params.message,
    p_resource_type: params.resourceType ?? null,
    p_resource_id: params.resourceId ?? null,
    p_target_user_id: null,
    p_due_at: params.dueAt ?? null,
    p_dedupe_key: params.dedupeKey,
    p_payload: payload,
  });

  if (error && !isMissingNutritionTableError(error)) {
    console.error("[nutrition] scoped notification error:", serializeError(error));
  }

  try {
    await createNotification({
      title: params.title,
      message: params.message,
      type: params.type,
      priority: priority === "low" ? "info" : priority,
      establishmentId: params.establishmentId,
      href: params.href ?? null,
      entityType: params.resourceType ?? null,
      entityId: params.resourceId ?? null,
      dedupeKey: params.dedupeKey,
      payload,
    });
  } catch (error) {
    console.error("[nutrition] global notification fallback error:", serializeError(error));
  }
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function parseSignatureDataUrl(value: string) {
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) return null;

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function normalizeEvidenceRow(row: any): NutritionEvidenceItem {
  return {
    id: String(row.id),
    caption: row.caption ? String(row.caption) : null,
    category: row.category ? String(row.category) : null,
    fileName: row.file_name ? String(row.file_name) : null,
    mimeType: String(row.mime_type ?? "application/octet-stream"),
    fileSizeBytes:
      row.file_size_bytes == null ? null : Number(row.file_size_bytes),
    url: nutritionFileUrl(String(row.file_path ?? "")) ?? "#",
    createdAt: String(row.created_at ?? ""),
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
  const extendedInspectionColumns =
    "id,title,inspection_code,inspection_type,status,sector,scheduled_for,expected_duration_minutes,started_at,completed_at,total_items,compliant_items,noncompliant_items,not_applicable_items,compliance_percent,result,template_id,template_version_id,latitude,longitude,geolocation_accuracy_meters,geolocation_status,geolocation_failure_reason,geolocation_captured_at,requires_signature,requires_geolocation,completion_integrity_hash";
  const baseInspectionColumns =
    "id,title,inspection_code,inspection_type,status,sector,scheduled_for,expected_duration_minutes,started_at,completed_at,total_items,compliant_items,noncompliant_items,not_applicable_items,compliance_percent,result,template_id,template_version_id,latitude,longitude,geolocation_accuracy_meters,geolocation_status,geolocation_failure_reason";

  let inspectionResult = await supabase
    .from("nutrition_inspections")
    .select(extendedInspectionColumns)
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", inspectionId)
    .single();

  if (inspectionResult.error && isMissingNutritionTableError(inspectionResult.error)) {
    inspectionResult = await supabase
      .from("nutrition_inspections")
      .select(baseInspectionColumns)
      .eq("establishment_id", tenant.establishmentId)
      .eq("id", inspectionId)
      .single();
  }

  const { data: inspection, error } = inspectionResult;

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

  let itemsResult: { data: any[] | null; error: any } = templateVersionId
    ? await supabase
        .from("nutrition_inspection_items")
        .select(
          "id,section_id,title,instruction,response_type,order_index,default_severity,comment_required,evidence_required,create_nonconformity_on_failure,nutrition_inspection_sections(title,order_index)"
        )
        .eq("establishment_id", tenant.establishmentId)
        .eq("template_version_id", templateVersionId)
        .order("order_index", { ascending: true })
    : { data: [], error: null };

  if (itemsResult.error && isMissingNutritionTableError(itemsResult.error)) {
    itemsResult = templateVersionId
      ? await supabase
          .from("nutrition_inspection_items")
          .select(
            "id,section_id,title,instruction,response_type,order_index,default_severity,comment_required,create_nonconformity_on_failure,nutrition_inspection_sections(title,order_index)"
          )
          .eq("establishment_id", tenant.establishmentId)
          .eq("template_version_id", templateVersionId)
          .order("order_index", { ascending: true })
      : { data: [], error: null };
  }

  const { data: items, error: itemsError } = itemsResult;

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
  const answerIds: string[] = [];

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
      answerIds.push(String((answer as any).id));
    }
  }

  const evidenceByAnswerId = new Map<string, NutritionEvidenceItem[]>();
  const inspectionEvidences: NutritionEvidenceItem[] = [];

  if (answerIds.length > 0 || inspectionId) {
    const { data: evidences, error: evidencesError } = await supabase
      .from("nutrition_evidences")
      .select("id,resource_type,inspection_id,answer_id,file_path,file_name,mime_type,file_size_bytes,caption,category,created_at")
      .eq("establishment_id", tenant.establishmentId)
      .or(`inspection_id.eq.${inspectionId}${answerIds.length ? `,answer_id.in.(${answerIds.join(",")})` : ""}`)
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (evidencesError && !isMissingNutritionTableError(evidencesError)) {
      console.error("[nutrition] evidence load error:", serializeError(evidencesError));
    }

    for (const evidence of evidences ?? []) {
      const normalized = normalizeEvidenceRow(evidence);
      const answerId = (evidence as any).answer_id
        ? String((evidence as any).answer_id)
        : "";

      if (answerId) {
        const current = evidenceByAnswerId.get(answerId) ?? [];
        current.push(normalized);
        evidenceByAnswerId.set(answerId, current);
        continue;
      }

      inspectionEvidences.push(normalized);
    }
  }

  const [signaturesResult, reportsResult] = await Promise.all([
    supabase
      .from("nutrition_signatures")
      .select("id,signer_name,signer_role,signature_path,signature_hash,refusal_reason,witness_name,signed_at,created_at")
      .eq("establishment_id", tenant.establishmentId)
      .eq("inspection_id", inspectionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("nutrition_reports")
      .select("id,title,format,status,version,file_path,content_hash,generated_at")
      .eq("establishment_id", tenant.establishmentId)
      .eq("source_type", "inspection")
      .eq("source_id", inspectionId)
      .order("version", { ascending: false })
      .limit(20),
  ]);

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
    geolocationStatus: String((inspection as any).geolocation_status ?? "not_requested"),
    latitude:
      (inspection as any).latitude == null ? null : Number((inspection as any).latitude),
    longitude:
      (inspection as any).longitude == null ? null : Number((inspection as any).longitude),
    geolocationAccuracyMeters:
      (inspection as any).geolocation_accuracy_meters == null
        ? null
        : Number((inspection as any).geolocation_accuracy_meters),
    geolocationFailureReason: (inspection as any).geolocation_failure_reason
      ? String((inspection as any).geolocation_failure_reason)
      : null,
    geolocationCapturedAt: (inspection as any).geolocation_captured_at
      ? String((inspection as any).geolocation_captured_at)
      : null,
    requiresSignature: Boolean((inspection as any).requires_signature),
    requiresGeolocation: Boolean((inspection as any).requires_geolocation),
    completionIntegrityHash: (inspection as any).completion_integrity_hash
      ? String((inspection as any).completion_integrity_hash)
      : null,
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
        evidenceRequired: Boolean(row.evidence_required),
        createNonconformityOnFailure: Boolean(row.create_nonconformity_on_failure),
        evidences: evidenceByAnswerId.get(answerByItemId.get(String(row.id))?.id ?? "") ?? [],
        answer: answerByItemId.get(String(row.id)) ?? null,
      };
    }),
    evidences: inspectionEvidences,
    signatures: ((signaturesResult.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      signerName: String(row.signer_name ?? ""),
      signerRole: row.signer_role ? String(row.signer_role) : null,
      signatureUrl: nutritionFileUrl(row.signature_path ? String(row.signature_path) : null),
      signatureHash: row.signature_hash ? String(row.signature_hash) : null,
      refusalReason: row.refusal_reason ? String(row.refusal_reason) : null,
      witnessName: row.witness_name ? String(row.witness_name) : null,
      signedAt: row.signed_at ? String(row.signed_at) : null,
      createdAt: String(row.created_at ?? ""),
    })),
    reports: ((reportsResult.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ""),
      format: String(row.format ?? "html"),
      status: String(row.status ?? "draft"),
      version: Number(row.version ?? 1),
      fileUrl: nutritionFileUrl(row.file_path ? String(row.file_path) : null),
      contentHash: row.content_hash ? String(row.content_hash) : null,
      generatedAt: row.generated_at ? String(row.generated_at) : null,
    })),
  };
}

export async function startInspection(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const inspectionId = String(formData.get("inspection_id") ?? "").trim();
  if (!inspectionId) throw new Error("Vistoria não informada.");

  const latitude = parseOptionalNumber(formData.get("latitude"));
  const longitude = parseOptionalNumber(formData.get("longitude"));
  const accuracy = parseOptionalNumber(formData.get("accuracy"));
  const geolocationStatus = String(
    formData.get("geolocation_status") ?? ""
  ).trim();
  const geolocationFailureReason = String(
    formData.get("geolocation_failure_reason") ?? ""
  ).trim();
  const geolocationPayload =
    latitude != null && longitude != null
      ? {
          latitude,
          longitude,
          geolocation_accuracy_meters: accuracy,
          geolocation_status: "captured",
          geolocation_failure_reason: null,
          geolocation_captured_at: new Date().toISOString(),
        }
      : geolocationStatus
        ? {
            geolocation_status: ["denied", "unavailable", "failed"].includes(
              geolocationStatus
            )
              ? geolocationStatus
              : "failed",
            geolocation_failure_reason:
              geolocationFailureReason || "Localização não capturada.",
          }
        : {};

  const updatePayload = {
    status: "in_progress",
    started_at: new Date().toISOString(),
    started_by: tenant.userId,
    updated_by: tenant.userId,
    ...geolocationPayload,
  };

  let { error } = await supabase
    .from("nutrition_inspections")
    .update(updatePayload)
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", inspectionId)
    .in("status", ["scheduled", "paused", "overdue"]);

  if (error && isMissingNutritionTableError(error)) {
    const fallbackPayload: Record<string, unknown> = {
      status: "in_progress",
      started_at: updatePayload.started_at,
      updated_by: tenant.userId,
    };

    if ("latitude" in geolocationPayload) {
      fallbackPayload.latitude = (geolocationPayload as any).latitude;
      fallbackPayload.longitude = (geolocationPayload as any).longitude;
      fallbackPayload.geolocation_accuracy_meters = (geolocationPayload as any).geolocation_accuracy_meters;
      fallbackPayload.geolocation_status = (geolocationPayload as any).geolocation_status;
      fallbackPayload.geolocation_failure_reason = null;
    } else if ("geolocation_status" in geolocationPayload) {
      fallbackPayload.geolocation_status = (geolocationPayload as any).geolocation_status;
      fallbackPayload.geolocation_failure_reason = (geolocationPayload as any).geolocation_failure_reason;
    }

    ({ error } = await supabase
      .from("nutrition_inspections")
      .update(fallbackPayload)
      .eq("establishment_id", tenant.establishmentId)
      .eq("id", inspectionId)
      .in("status", ["scheduled", "paused", "overdue"]));
  }

  if (error) {
    console.error("[nutrition] start inspection error:", serializeError(error));
    throw new Error("Não foi possível iniciar a vistoria.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/vistorias");
  revalidatePath(`/nutricao/vistorias/${inspectionId}`);
}

export async function saveInspectionGeolocation(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const inspectionId = String(formData.get("inspection_id") ?? "").trim();
  const latitude = parseOptionalNumber(formData.get("latitude"));
  const longitude = parseOptionalNumber(formData.get("longitude"));
  const accuracy = parseOptionalNumber(formData.get("accuracy"));
  const status = String(formData.get("geolocation_status") ?? "").trim();
  const failureReason = String(
    formData.get("geolocation_failure_reason") ?? ""
  ).trim();

  if (!inspectionId) throw new Error("Vistoria não informada.");

  const captured = latitude != null && longitude != null;
  const nextStatus = captured
    ? "captured"
    : ["denied", "unavailable", "failed"].includes(status)
      ? status
      : "failed";

  let { error } = await supabase
    .from("nutrition_inspections")
    .update({
      latitude: captured ? latitude : null,
      longitude: captured ? longitude : null,
      geolocation_accuracy_meters: captured ? accuracy : null,
      geolocation_status: nextStatus,
      geolocation_failure_reason: captured
        ? null
        : failureReason || "Localização não capturada.",
      geolocation_captured_at: captured ? new Date().toISOString() : null,
      updated_by: tenant.userId,
    })
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", inspectionId)
    .neq("status", "completed");

  if (error && isMissingNutritionTableError(error)) {
    ({ error } = await supabase
      .from("nutrition_inspections")
      .update({
        latitude: captured ? latitude : null,
        longitude: captured ? longitude : null,
        geolocation_accuracy_meters: captured ? accuracy : null,
        geolocation_status: nextStatus,
        geolocation_failure_reason: captured
          ? null
          : failureReason || "Localização não capturada.",
        updated_by: tenant.userId,
      })
      .eq("establishment_id", tenant.establishmentId)
      .eq("id", inspectionId)
      .neq("status", "completed"));
  }

  if (error) {
    console.error("[nutrition] save geolocation error:", serializeError(error));
    throw new Error("Não foi possível registrar a geolocalização.");
  }

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
      const { data: nonconformity, error: nonconformityError } = await supabase
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
        })
        .select("id")
        .single();

      if (nonconformityError) {
        console.error(
          "[nutrition] auto nonconformity error:",
          serializeError(nonconformityError)
        );
      } else if (nonconformity) {
        await createNutritionScopedNotification(supabase, {
          establishmentId: tenant.establishmentId,
          userId: tenant.userId,
          type: "nutrition_nonconformity_created",
          priority: severity === "critical" ? "critical" : "high",
          title: "Não conformidade registrada",
          message: `Item não conforme na vistoria: ${itemTitle}.`,
          resourceType: "nutrition_nonconformity",
          resourceId: String((nonconformity as any).id),
          href: `/nutricao/nao-conformidades/${String((nonconformity as any).id)}`,
          dedupeKey: `nutrition-inspection-nc:${tenant.establishmentId}:${inspectionId}:${itemId}`,
          payload: {
            inspection_id: inspectionId,
            item_id: itemId,
            severity,
          },
        });
      }
    }
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/vistorias");
  revalidatePath(`/nutricao/vistorias/${inspectionId}`);
}

async function resolveEvidenceTarget(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: string,
  formData: FormData
) {
  const resourceType = String(formData.get("resource_type") ?? "").trim();
  const inspectionId = String(formData.get("inspection_id") ?? "").trim();
  const answerId = String(formData.get("answer_id") ?? "").trim();
  const nonconformityId = String(formData.get("nonconformity_id") ?? "").trim();

  if (resourceType === "inspection_answer") {
    if (!answerId) throw new Error("Resposta da vistoria não informada.");
    const { data, error } = await supabase
      .from("nutrition_inspection_answers")
      .select("id,inspection_id")
      .eq("establishment_id", establishmentId)
      .eq("id", answerId)
      .maybeSingle();

    if (error || !data) throw new Error("Resposta não encontrada para este estabelecimento.");

    return {
      resourceType,
      resourceId: answerId,
      inspectionId: String((data as any).inspection_id ?? inspectionId),
      answerId,
      nonconformityId: null as string | null,
      revalidatePaths: [
        "/nutricao",
        "/nutricao/vistorias",
        `/nutricao/vistorias/${String((data as any).inspection_id ?? inspectionId)}`,
      ],
    };
  }

  if (resourceType === "nonconformity") {
    if (!nonconformityId) throw new Error("Não conformidade não informada.");
    const { data, error } = await supabase
      .from("nutrition_nonconformities")
      .select("id,inspection_id")
      .eq("establishment_id", establishmentId)
      .eq("id", nonconformityId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("Não conformidade não encontrada para este estabelecimento.");
    }

    const relatedInspectionId = (data as any).inspection_id
      ? String((data as any).inspection_id)
      : null;

    return {
      resourceType,
      resourceId: nonconformityId,
      inspectionId: relatedInspectionId,
      answerId: null as string | null,
      nonconformityId,
      revalidatePaths: [
        "/nutricao",
        "/nutricao/nao-conformidades",
        `/nutricao/nao-conformidades/${nonconformityId}`,
        ...(relatedInspectionId ? [`/nutricao/vistorias/${relatedInspectionId}`] : []),
      ],
    };
  }

  if (resourceType === "inspection") {
    if (!inspectionId) throw new Error("Vistoria não informada.");
    const { data, error } = await supabase
      .from("nutrition_inspections")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("id", inspectionId)
      .maybeSingle();

    if (error || !data) throw new Error("Vistoria não encontrada para este estabelecimento.");

    return {
      resourceType,
      resourceId: inspectionId,
      inspectionId,
      answerId: null as string | null,
      nonconformityId: null as string | null,
      revalidatePaths: ["/nutricao", "/nutricao/vistorias", `/nutricao/vistorias/${inspectionId}`],
    };
  }

  throw new Error("Tipo de evidência não suportado.");
}

export async function uploadNutritionEvidence(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const file = formData.get("file");
  const caption = String(formData.get("caption") ?? "").trim();
  const category = String(formData.get("category") ?? "geral").trim();
  const metadataText = String(formData.get("metadata") ?? "").trim();

  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("Selecione um arquivo de evidência.");
  }

  if (file.size > MAX_NUTRITION_FILE_SIZE) {
    throw new Error("Arquivo muito grande. O limite é 20 MB.");
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_NUTRITION_MIME_TYPES.has(mimeType)) {
    throw new Error("Formato não permitido. Use imagem, PDF, DOCX ou XLSX.");
  }

  const target = await resolveEvidenceTarget(
    supabase,
    tenant.establishmentId,
    formData
  );
  let metadata: Record<string, unknown> = {};
  if (metadataText) {
    try {
      metadata = JSON.parse(metadataText) as Record<string, unknown>;
    } catch {
      metadata = { note: metadataText };
    }
  }

  const originalName = sanitizeFileName(file.name || "evidencia");
  const filePath = `${tenant.establishmentId}/${target.resourceType}/${target.resourceId}/${Date.now()}-${randomUUID()}-${originalName}`;

  const { error: uploadError } = await supabase.storage
    .from(NUTRITION_FILES_BUCKET)
    .upload(filePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[nutrition] evidence upload error:", serializeError(uploadError));
    throw new Error("Não foi possível enviar a evidência.");
  }

  const { error } = await supabase.from("nutrition_evidences").insert({
    establishment_id: tenant.establishmentId,
    resource_type: target.resourceType,
    resource_id: target.resourceId,
    inspection_id: target.inspectionId,
    answer_id: target.answerId,
    nonconformity_id: target.nonconformityId,
    file_path: filePath,
    file_name: file.name || originalName,
    mime_type: mimeType,
    file_size_bytes: file.size,
    caption: caption || null,
    category: category || null,
    metadata: {
      ...metadata,
      uploaded_from: "nutrition_module",
      original_name: file.name || originalName,
    },
    captured_at: new Date().toISOString(),
    uploaded_by: tenant.userId,
  });

  if (error) {
    console.error("[nutrition] evidence insert error:", serializeError(error));
    throw new Error("O arquivo foi enviado, mas não foi possível registrar a evidência.");
  }

  for (const path of target.revalidatePaths) revalidatePath(path);
}

export async function removeNutritionEvidence(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const evidenceId = String(formData.get("evidence_id") ?? "").trim();
  const reason = String(formData.get("remove_reason") ?? "").trim();

  if (!evidenceId) throw new Error("Evidência não informada.");
  if (!reason) throw new Error("Informe a justificativa da remoção.");

  const { data: evidence, error: loadError } = await supabase
    .from("nutrition_evidences")
    .select("id,inspection_id,nonconformity_id")
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", evidenceId)
    .is("removed_at", null)
    .maybeSingle();

  if (loadError || !evidence) {
    throw new Error("Evidência não encontrada para este estabelecimento.");
  }

  const { error } = await supabase
    .from("nutrition_evidences")
    .update({
      removed_at: new Date().toISOString(),
      removed_by: tenant.userId,
      remove_reason: reason,
    })
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", evidenceId);

  if (error) {
    console.error("[nutrition] remove evidence error:", serializeError(error));
    throw new Error("Não foi possível remover a evidência.");
  }

  revalidatePath("/nutricao");
  if ((evidence as any).inspection_id) {
    revalidatePath(`/nutricao/vistorias/${String((evidence as any).inspection_id)}`);
  }
  if ((evidence as any).nonconformity_id) {
    revalidatePath(
      `/nutricao/nao-conformidades/${String((evidence as any).nonconformity_id)}`
    );
  }
}

export async function saveNutritionSignature(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const inspectionId = String(formData.get("inspection_id") ?? "").trim();
  const reinspectionId = String(formData.get("reinspection_id") ?? "").trim();
  const signerName = String(formData.get("signer_name") ?? "").trim();
  const signerRole = String(formData.get("signer_role") ?? "").trim();
  const signerDocument = String(formData.get("signer_document") ?? "").trim();
  const signatureData = String(formData.get("signature_data") ?? "").trim();
  const refusalReason = String(formData.get("refusal_reason") ?? "").trim();
  const witnessName = String(formData.get("witness_name") ?? "").trim();
  const declarationText =
    String(formData.get("declaration_text") ?? "").trim() ||
    "Declaro ciência sobre o conteúdo e os registros desta vistoria.";

  if (!inspectionId && !reinspectionId) {
    throw new Error("Vistoria ou reinspeção não informada.");
  }
  if (!signerName) throw new Error("Informe o nome do assinante.");
  if (!signatureData && !refusalReason) {
    throw new Error("Colete a assinatura ou registre a recusa com justificativa.");
  }

  if (inspectionId) {
    const { data, error } = await supabase
      .from("nutrition_inspections")
      .select("id,status")
      .eq("establishment_id", tenant.establishmentId)
      .eq("id", inspectionId)
      .maybeSingle();

    if (error || !data) throw new Error("Vistoria não encontrada para este estabelecimento.");
  }

  let signaturePath: string | null = null;
  let signatureHash: string | null = null;

  if (signatureData) {
    const parsed = parseSignatureDataUrl(signatureData);
    if (!parsed) throw new Error("Assinatura inválida. Tente coletar novamente.");
    if (parsed.buffer.byteLength > 1_500_000) {
      throw new Error("Assinatura muito grande. Limpe e assine novamente.");
    }

    signatureHash = hashPayload(parsed.buffer.toString("base64"));
    signaturePath = `${tenant.establishmentId}/signature/${inspectionId || reinspectionId}/${Date.now()}-${randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from(NUTRITION_FILES_BUCKET)
      .upload(signaturePath, parsed.buffer, {
        contentType: parsed.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[nutrition] signature upload error:", serializeError(uploadError));
      throw new Error("Não foi possível enviar a assinatura.");
    }
  }

  const { error } = await supabase.from("nutrition_signatures").insert({
    establishment_id: tenant.establishmentId,
    inspection_id: inspectionId || null,
    reinspection_id: reinspectionId || null,
    signer_name: signerName,
    signer_role: signerRole || null,
    signer_document: signerDocument || null,
    signature_path: signaturePath,
    signature_hash: signatureHash,
    declaration_text: declarationText,
    refusal_reason: refusalReason || null,
    witness_name: witnessName || null,
    signed_at: signaturePath ? new Date().toISOString() : null,
    collected_by: tenant.userId,
  });

  if (error) {
    console.error("[nutrition] signature insert error:", serializeError(error));
    throw new Error("Não foi possível registrar a assinatura.");
  }

  revalidatePath("/nutricao");
  if (inspectionId) revalidatePath(`/nutricao/vistorias/${inspectionId}`);
}

export async function completeInspection(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const inspectionId = String(formData.get("inspection_id") ?? "").trim();
  const completionNotes = String(formData.get("completion_notes") ?? "").trim();
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

  const missingRequiredEvidence = snapshot.items.filter(
    (item) =>
      (item.evidenceRequired ||
        item.responseType === "photo" ||
        item.responseType === "document") &&
      item.evidences.length === 0
  );
  if (missingRequiredEvidence.length > 0) {
    throw new Error(
      `Anexe evidência obrigatória em: ${missingRequiredEvidence
        .slice(0, 3)
        .map((item) => item.title)
        .join(", ")}.`
    );
  }

  if (snapshot.requiresGeolocation && snapshot.geolocationStatus !== "captured") {
    throw new Error("Registre a geolocalização antes de concluir a vistoria.");
  }

  if (snapshot.requiresSignature && snapshot.signatures.length === 0) {
    throw new Error("Colete a assinatura obrigatória ou registre a recusa justificada.");
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
  const completedSnapshot = {
    inspection_id: inspectionId,
    title: snapshot.title,
    status_before_completion: snapshot.status,
    total_items: snapshot.items.length,
    compliant_items: compliant,
    noncompliant_items: noncompliant,
    not_applicable_items: notApplicable,
    compliance_percent: compliancePercent,
    result: inspectionResultFromPercent(compliancePercent),
    geolocation: {
      status: snapshot.geolocationStatus,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      accuracy_meters: snapshot.geolocationAccuracyMeters,
      captured_at: snapshot.geolocationCapturedAt,
    },
    signatures: snapshot.signatures.map((signature) => ({
      id: signature.id,
      signer_name: signature.signerName,
      signer_role: signature.signerRole,
      hash: signature.signatureHash,
      refused: Boolean(signature.refusalReason),
    })),
    completed_by: tenant.userId,
    completed_at: new Date().toISOString(),
  };
  const integrityHash = hashPayload(completedSnapshot);

  const completionUpdatePayload = {
    status: "completed",
    completed_at: new Date().toISOString(),
    total_items: snapshot.items.length,
    compliant_items: compliant,
    noncompliant_items: noncompliant,
    not_applicable_items: notApplicable,
    compliance_percent: compliancePercent,
    result: inspectionResultFromPercent(compliancePercent),
    completed_by: tenant.userId,
    completion_notes: completionNotes || null,
    completion_integrity_hash: integrityHash,
    completed_snapshot: completedSnapshot,
    updated_by: tenant.userId,
  };

  let { error } = await supabase
    .from("nutrition_inspections")
    .update(completionUpdatePayload)
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", inspectionId)
    .neq("status", "completed");

  if (error && isMissingNutritionTableError(error)) {
    ({ error } = await supabase
      .from("nutrition_inspections")
      .update({
        status: "completed",
        completed_at: completionUpdatePayload.completed_at,
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
      .neq("status", "completed"));
  }

  if (error) {
    console.error("[nutrition] complete inspection error:", serializeError(error));
    throw new Error("Não foi possível concluir a vistoria.");
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/vistorias");
  revalidatePath(`/nutricao/vistorias/${inspectionId}`);
}

export async function createInspectionAddendum(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const inspectionId = String(formData.get("inspection_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!inspectionId) throw new Error("Vistoria não informada.");
  if (!title) throw new Error("Informe o título do adendo.");
  if (!body) throw new Error("Informe o conteúdo do adendo.");

  const { data: inspection, error: inspectionError } = await supabase
    .from("nutrition_inspections")
    .select("id,status")
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", inspectionId)
    .maybeSingle();

  if (inspectionError || !inspection) {
    throw new Error("Vistoria não encontrada para este estabelecimento.");
  }

  if (String((inspection as any).status) !== "completed") {
    throw new Error("Adendos são permitidos apenas em vistorias concluídas.");
  }

  const { count } = await supabase
    .from("nutrition_inspection_addendums")
    .select("id", { count: "exact", head: true })
    .eq("establishment_id", tenant.establishmentId)
    .eq("inspection_id", inspectionId);

  const version = (count ?? 0) + 1;
  const { error } = await supabase.from("nutrition_inspection_addendums").insert({
    establishment_id: tenant.establishmentId,
    inspection_id: inspectionId,
    version,
    title,
    body,
    metadata: {
      integrity_hash: hashPayload({ inspectionId, version, title, body }),
    },
    created_by: tenant.userId,
  });

  if (error) {
    console.error("[nutrition] addendum insert error:", serializeError(error));
    throw new Error("Não foi possível registrar o adendo.");
  }

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

  const normalizedSeverity = ["low", "medium", "high", "critical"].includes(severity)
    ? severity
    : "medium";
  const { data: nonconformity, error } = await supabase
    .from("nutrition_nonconformities")
    .insert({
      establishment_id: tenant.establishmentId,
      source_type: "manual",
      title,
      description: description || null,
      sector: sector || null,
      location: location || null,
      category: category || null,
      severity: normalizedSeverity,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      immediate_containment: immediateContainment || null,
      status: "open",
      created_by: tenant.userId,
      updated_by: tenant.userId,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create nonconformity error:", serializeError(error));
    throw new Error("Não foi possível abrir a não conformidade.");
  }

  await createNutritionScopedNotification(supabase, {
    establishmentId: tenant.establishmentId,
    userId: tenant.userId,
    type: "nutrition_nonconformity_created",
    priority: normalizedSeverity === "critical" ? "critical" : "high",
    title: "Não conformidade registrada",
    message: title,
    resourceType: "nutrition_nonconformity",
    resourceId: String((nonconformity as any).id),
    href: `/nutricao/nao-conformidades/${String((nonconformity as any).id)}`,
    dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    dedupeKey: `nutrition-manual-nc:${tenant.establishmentId}:${String((nonconformity as any).id)}`,
    payload: {
      severity: normalizedSeverity,
      sector: sector || null,
      location: location || null,
    },
  });

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
      .select("id,caption,category,file_path,file_name,mime_type,file_size_bytes,created_at")
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
      mimeType: String(item.mime_type ?? "application/octet-stream"),
      fileSizeBytes:
        item.file_size_bytes == null ? null : Number(item.file_size_bytes),
      url: nutritionFileUrl(item.file_path ? String(item.file_path) : null) ?? "#",
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
    {
      measuredValue: number;
      status: string;
      measuredAt: string;
      thermometerName: string | null;
    }
  >();

  if (pointIds.length > 0) {
    const { data: records, error: recordsError } = await supabase
      .from("nutrition_temperature_records")
      .select("point_id,measured_value,status,measured_at,thermometer_id")
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

    const thermometerIds = Array.from(
      new Set(
        (records ?? [])
          .map((record: any) => String(record.thermometer_id ?? ""))
          .filter(Boolean)
      )
    );
    const thermometerNameById = new Map<string, string>();

    if (thermometerIds.length > 0) {
      const { data: thermometers, error: thermometerError } = await supabase
        .from("nutrition_thermometers")
        .select("id,name")
        .eq("establishment_id", tenant.establishmentId)
        .in("id", thermometerIds);

      if (thermometerError && !isMissingNutritionTableError(thermometerError)) {
        console.error(
          "[nutrition] thermometer names list error:",
          serializeError(thermometerError)
        );
      }

      for (const thermometer of thermometers ?? []) {
        thermometerNameById.set(
          String((thermometer as any).id),
          String((thermometer as any).name ?? "")
        );
      }
    }

    for (const record of records ?? []) {
      const pointId = String((record as any).point_id ?? "");
      if (!pointId || latestRecordByPointId.has(pointId)) continue;
      const thermometerId = String((record as any).thermometer_id ?? "");

      latestRecordByPointId.set(pointId, {
        measuredValue: Number((record as any).measured_value),
        status: String((record as any).status ?? "within_limits"),
        measuredAt: String((record as any).measured_at ?? ""),
        thermometerName: thermometerNameById.get(thermometerId) ?? null,
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
  const thermometerId = String(formData.get("thermometer_id") ?? "").trim();
  const measuredValue = Number(formData.get("measured_value") ?? NaN);
  const observation = String(formData.get("observation") ?? "").trim();
  const immediateAction = String(formData.get("immediate_action") ?? "").trim();
  const idempotencyKey =
    String(formData.get("idempotency_key") ?? "").trim() || randomUUID();

  if (!pointId) throw new Error("Selecione o ponto de controle.");
  if (!Number.isFinite(measuredValue)) throw new Error("Informe a temperatura.");

  const { data: point, error: pointError } = await supabase
    .from("nutrition_temperature_points")
    .select("id,name,min_value,max_value,unit,default_corrective_action")
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

  const immediateActionValue =
    immediateAction ||
    (outOfLimits ? String((point as any).default_corrective_action ?? "") : "") ||
    null;

  const { data: record, error } = await supabase
    .from("nutrition_temperature_records")
    .upsert(
      {
        establishment_id: tenant.establishmentId,
        point_id: pointId,
        thermometer_id: thermometerId || null,
        measured_value: measuredValue,
        unit: point?.unit ?? "C",
        status: outOfLimits ? "out_of_limits" : "within_limits",
        observed_by: tenant.userId,
        observation: observation || null,
        immediate_action: immediateActionValue,
        idempotency_key: idempotencyKey,
      },
      { onConflict: "establishment_id,idempotency_key" }
    )
    .select("id,nonconformity_id")
    .single();

  if (error) {
    console.error("[nutrition] create temperature record error:", serializeError(error));
    throw new Error("Não foi possível registrar a temperatura.");
  }

  if (outOfLimits && !(record as any)?.nonconformity_id) {
    const { data: nonconformity, error: nonconformityError } = await supabase
      .from("nutrition_nonconformities")
      .insert({
        establishment_id: tenant.establishmentId,
        source_type: "temperature_record",
        source_id: String((record as any).id),
        title: `Temperatura fora do limite: ${String((point as any).name ?? "")}`,
        description:
          observation ||
          `Medição registrada: ${measuredValue} ${point?.unit ?? "C"}.`,
        severity: "high",
        status: "open",
        immediate_containment: immediateActionValue,
        created_by: tenant.userId,
        updated_by: tenant.userId,
      })
      .select("id")
      .single();

    if (nonconformityError) {
      console.error(
        "[nutrition] temperature nonconformity error:",
        serializeError(nonconformityError)
      );
    } else if (nonconformity) {
      await supabase
        .from("nutrition_temperature_records")
        .update({ nonconformity_id: String((nonconformity as any).id) })
        .eq("establishment_id", tenant.establishmentId)
        .eq("id", String((record as any).id));

      await createNutritionScopedNotification(supabase, {
        establishmentId: tenant.establishmentId,
        userId: tenant.userId,
        type: "nutrition_temperature_out_of_limits",
        priority: "high",
        title: "Temperatura fora do limite",
        message: `${String((point as any).name ?? "Ponto de controle")} registrou ${measuredValue} ${point?.unit ?? "C"}.`,
        resourceType: "nutrition_nonconformity",
        resourceId: String((nonconformity as any).id),
        href: `/nutricao/nao-conformidades/${String((nonconformity as any).id)}`,
        dedupeKey: `nutrition-temperature:${tenant.establishmentId}:${String((record as any).id)}`,
        payload: {
          point_id: pointId,
          temperature_record_id: String((record as any).id),
          measured_value: measuredValue,
          unit: point?.unit ?? "C",
        },
      });
    }
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/temperaturas");
}

export async function listThermometers(): Promise<NutritionThermometerItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_thermometers")
    .select("id,name,identifier,calibration_due_at,verification_due_at,status")
    .eq("establishment_id", tenant.establishmentId)
    .order("calibration_due_at", { ascending: true, nullsFirst: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] thermometers list error:", serializeError(error));
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    identifier: row.identifier ? String(row.identifier) : null,
    calibrationDueAt: row.calibration_due_at
      ? String(row.calibration_due_at)
      : null,
    verificationDueAt: row.verification_due_at
      ? String(row.verification_due_at)
      : null,
    status: String(row.status ?? "active"),
  }));
}

export async function createThermometer(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const name = String(formData.get("name") ?? "").trim();
  const identifier = String(formData.get("identifier") ?? "").trim();
  const calibrationDueAt = String(formData.get("calibration_due_at") ?? "").trim();
  const verificationDueAt = String(formData.get("verification_due_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) throw new Error("Informe o nome do termômetro.");

  const { error } = await supabase.from("nutrition_thermometers").insert({
    establishment_id: tenant.establishmentId,
    name,
    identifier: identifier || null,
    calibration_due_at: calibrationDueAt || null,
    verification_due_at: verificationDueAt || null,
    notes: notes || null,
    status: "active",
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    console.error("[nutrition] create thermometer error:", serializeError(error));
    throw new Error("Não foi possível cadastrar o termômetro.");
  }

  revalidatePath("/nutricao/temperaturas");
}

export async function listPops(): Promise<PopItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_pops")
    .select("id,code,title,status,next_review_at,applicable_sectors,current_version")
    .eq("establishment_id", tenant.establishmentId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] pops list error:", serializeError(error));
    return [];
  }

  const popIds = (data ?? []).map((row: any) => String(row.id));
  const versionByPop = new Map<string, string | null>();

  if (popIds.length > 0) {
    const { data: versions, error: versionsError } = await supabase
      .from("nutrition_pop_versions")
      .select("pop_id,file_path,version")
      .eq("establishment_id", tenant.establishmentId)
      .in("pop_id", popIds)
      .order("version", { ascending: false })
      .limit(100);

    if (versionsError && !isMissingNutritionTableError(versionsError)) {
      console.error("[nutrition] pop versions list error:", serializeError(versionsError));
    }

    for (const version of versions ?? []) {
      const popId = String((version as any).pop_id ?? "");
      if (!popId || versionByPop.has(popId)) continue;
      versionByPop.set(
        popId,
        (version as any).file_path ? String((version as any).file_path) : null
      );
    }
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
    currentVersion: Number(row.current_version ?? 1),
    fileUrl: nutritionFileUrl(versionByPop.get(String(row.id))),
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
  const fileValue = formData.get("file");
  const file = fileValue instanceof File ? fileValue : null;

  if (!title) throw new Error("Informe o título do POP.");

  const { data: pop, error } = await supabase
    .from("nutrition_pops")
    .insert({
      establishment_id: tenant.establishmentId,
      code: code || null,
      title,
      objective: objective || null,
      scope: scope || null,
      applicable_sectors: sectors,
      next_review_at: nextReviewAt || null,
      status: "draft",
      current_version: 1,
      created_by: tenant.userId,
      updated_by: tenant.userId,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create pop error:", serializeError(error));
    throw new Error("Não foi possível criar o POP.");
  }

  let uploaded: Awaited<ReturnType<typeof uploadNutritionManagedFile>> = null;
  if (pop && file) {
    uploaded = await uploadNutritionManagedFile({
      supabase,
      establishmentId: tenant.establishmentId,
      resourceType: "pops",
      resourceId: String((pop as any).id),
      file,
      version: 1,
    });
  }

  if (pop) {
    const { error: versionError } = await supabase
      .from("nutrition_pop_versions")
      .insert({
        establishment_id: tenant.establishmentId,
        pop_id: String((pop as any).id),
        version: 1,
        content: {
          title,
          objective: objective || null,
          scope: scope || null,
          applicable_sectors: sectors,
        },
        file_path: uploaded?.filePath ?? null,
        file_name: uploaded?.fileName ?? null,
        mime_type: uploaded?.mimeType ?? null,
        file_size_bytes: uploaded?.fileSizeBytes ?? null,
        checksum: uploaded?.checksum ?? null,
        status: "draft",
        next_review_at: nextReviewAt || null,
        author_user_id: tenant.userId,
      });

    if (versionError) {
      console.error("[nutrition] create pop version error:", serializeError(versionError));
      throw new Error("POP criado, mas não foi possível registrar a versão.");
    }
  }

  await appendNutritionAuditEvent(supabase, {
    establishmentId: tenant.establishmentId,
    actorUserId: tenant.userId,
    action: "pop.created",
    resourceType: "nutrition_pop",
    resourceId: String((pop as any)?.id ?? "unknown"),
    afterData: {
      title,
      code: code || null,
      has_file: Boolean(uploaded),
    },
  });

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

  const planIds = (data ?? []).map((row: any) => String(row.id));
  const latestRecordByPlan = new Map<
    string,
    { id: string; status: string; result: string | null; executedAt: string | null }
  >();

  if (planIds.length > 0) {
    const { data: records, error: recordsError } = await supabase
      .from("nutrition_sanitation_records")
      .select("id,sanitation_plan_id,status,result,executed_at,created_at")
      .eq("establishment_id", tenant.establishmentId)
      .in("sanitation_plan_id", planIds)
      .order("created_at", { ascending: false })
      .limit(100);

    if (recordsError && !isMissingNutritionTableError(recordsError)) {
      console.error("[nutrition] sanitation records list error:", serializeError(recordsError));
    }

    for (const record of records ?? []) {
      const planId = String((record as any).sanitation_plan_id ?? "");
      if (!planId || latestRecordByPlan.has(planId)) continue;
      latestRecordByPlan.set(planId, {
        id: String((record as any).id),
        status: String((record as any).status ?? "pending"),
        result: (record as any).result ? String((record as any).result) : null,
        executedAt: (record as any).executed_at
          ? String((record as any).executed_at)
          : null,
      });
    }
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    sector: row.sector ? String(row.sector) : null,
    targetItem: String(row.target_item ?? ""),
    productName: row.product_name ? String(row.product_name) : null,
    status: String(row.status ?? "active"),
    evidenceRequired: Boolean(row.evidence_required),
    latestRecord: latestRecordByPlan.get(String(row.id)) ?? null,
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

export async function executeSanitationRecord(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const planId = String(formData.get("sanitation_plan_id") ?? "").trim();
  const result = String(formData.get("result") ?? "approved").trim();
  const observation = String(formData.get("observation") ?? "").trim();
  const idempotencyKey =
    String(formData.get("idempotency_key") ?? "").trim() || randomUUID();
  const fileValue = formData.get("file");
  const file = fileValue instanceof File ? fileValue : null;

  if (!planId) throw new Error("Selecione o plano de higienização.");
  if (!["approved", "rejected"].includes(result)) {
    throw new Error("Informe o resultado da higienização.");
  }

  const { data: plan, error: planError } = await supabase
    .from("nutrition_sanitation_plans")
    .select("id,name,evidence_required")
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", planId)
    .eq("status", "active")
    .maybeSingle();

  if (planError || !plan) {
    throw new Error("Plano de higienização não encontrado para este estabelecimento.");
  }

  if ((plan as any).evidence_required && !file) {
    throw new Error("Este plano exige evidência da execução.");
  }

  const { data: record, error } = await supabase
    .from("nutrition_sanitation_records")
    .upsert(
      {
        establishment_id: tenant.establishmentId,
        sanitation_plan_id: planId,
        executed_at: new Date().toISOString(),
        executor_user_id: tenant.userId,
        status: result === "approved" ? "executed" : "failed",
        result,
        observation: observation || null,
        idempotency_key: idempotencyKey,
        created_by: tenant.userId,
        updated_by: tenant.userId,
      },
      { onConflict: "establishment_id,idempotency_key" }
    )
    .select("id,evidence_id,nonconformity_id")
    .single();

  if (error) {
    console.error("[nutrition] execute sanitation record error:", serializeError(error));
    throw new Error("Não foi possível registrar a execução da higienização.");
  }

  if (file && !(record as any)?.evidence_id) {
    const uploaded = await uploadNutritionManagedFile({
      supabase,
      establishmentId: tenant.establishmentId,
      resourceType: "sanitation",
      resourceId: String((record as any).id),
      file,
      version: 1,
    });

    if (uploaded) {
      const { data: evidence } = await supabase
        .from("nutrition_evidences")
        .insert({
          establishment_id: tenant.establishmentId,
          resource_type: "sanitation_record",
          resource_id: String((record as any).id),
          file_path: uploaded.filePath,
          file_name: uploaded.fileName,
          mime_type: uploaded.mimeType,
          file_size_bytes: uploaded.fileSizeBytes,
          caption: observation || null,
          category: "higienizacao",
          metadata: { sanitation_plan_id: planId, checksum: uploaded.checksum },
          uploaded_by: tenant.userId,
        })
        .select("id")
        .single();

      if (evidence) {
        await supabase
          .from("nutrition_sanitation_records")
          .update({ evidence_id: String((evidence as any).id) })
          .eq("establishment_id", tenant.establishmentId)
          .eq("id", String((record as any).id));
      }
    }
  }

  if (result === "rejected" && !(record as any)?.nonconformity_id) {
    const { data: nonconformity } = await supabase
      .from("nutrition_nonconformities")
      .insert({
        establishment_id: tenant.establishmentId,
        source_type: "sanitation_record",
        source_id: String((record as any).id),
        title: `Higienização reprovada: ${String((plan as any).name ?? "")}`,
        description: observation || "Execução de higienização reprovada.",
        severity: "medium",
        status: "open",
        created_by: tenant.userId,
        updated_by: tenant.userId,
      })
      .select("id")
      .single();

    if (nonconformity) {
      await supabase
        .from("nutrition_sanitation_records")
        .update({ nonconformity_id: String((nonconformity as any).id) })
        .eq("establishment_id", tenant.establishmentId)
        .eq("id", String((record as any).id));

      await createNutritionScopedNotification(supabase, {
        establishmentId: tenant.establishmentId,
        userId: tenant.userId,
        type: "nutrition_sanitation_failed",
        priority: "high",
        title: "Higienização reprovada",
        message: String((plan as any).name ?? "Plano de higienização"),
        resourceType: "nutrition_nonconformity",
        resourceId: String((nonconformity as any).id),
        href: `/nutricao/nao-conformidades/${String((nonconformity as any).id)}`,
        dedupeKey: `nutrition-sanitation:${tenant.establishmentId}:${String((record as any).id)}`,
        payload: {
          sanitation_record_id: String((record as any).id),
          sanitation_plan_id: planId,
        },
      });
    }
  }

  revalidatePath("/nutricao");
  revalidatePath("/nutricao/higienizacao");
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_documents")
    .select("id,document_type,title,document_number,issuer,valid_until,status,visibility,current_version")
    .eq("establishment_id", tenant.establishmentId)
    .order("valid_until", { ascending: true, nullsFirst: false })
    .limit(50);

  if (error) {
    if (isMissingNutritionTableError(error)) return [];
    console.error("[nutrition] documents list error:", serializeError(error));
    return [];
  }

  const documentIds = (data ?? []).map((row: any) => String(row.id));
  const versionByDocument = new Map<
    string,
    { filePath: string | null; fileName: string | null }
  >();

  if (documentIds.length > 0) {
    const { data: versions, error: versionsError } = await supabase
      .from("nutrition_document_versions")
      .select("document_id,file_path,file_name,version")
      .eq("establishment_id", tenant.establishmentId)
      .in("document_id", documentIds)
      .order("version", { ascending: false })
      .limit(100);

    if (versionsError && !isMissingNutritionTableError(versionsError)) {
      console.error(
        "[nutrition] document versions list error:",
        serializeError(versionsError)
      );
    }

    for (const version of versions ?? []) {
      const documentId = String((version as any).document_id ?? "");
      if (!documentId || versionByDocument.has(documentId)) continue;
      versionByDocument.set(documentId, {
        filePath: (version as any).file_path
          ? String((version as any).file_path)
          : null,
        fileName: (version as any).file_name
          ? String((version as any).file_name)
          : null,
      });
    }
  }

  return (data ?? []).map((row: any) => {
    const version = versionByDocument.get(String(row.id));
    return {
    id: String(row.id),
    documentType: String(row.document_type ?? ""),
    title: String(row.title ?? ""),
    documentNumber: row.document_number ? String(row.document_number) : null,
    issuer: row.issuer ? String(row.issuer) : null,
    validUntil: row.valid_until ? String(row.valid_until) : null,
    status: String(row.status ?? "active"),
    visibility: String(row.visibility ?? "internal"),
      currentVersion: Number(row.current_version ?? 1),
      fileUrl: nutritionFileUrl(version?.filePath),
      fileName: version?.fileName ?? null,
    };
  });
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
  const fileValue = formData.get("file");
  const file = fileValue instanceof File ? fileValue : null;

  if (!documentType) throw new Error("Informe o tipo do documento.");
  if (!title) throw new Error("Informe o título do documento.");

  const { data: document, error } = await supabase
    .from("nutrition_documents")
    .insert({
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
      current_version: 1,
      created_by: tenant.userId,
      updated_by: tenant.userId,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration de banco do módulo Nutrição ainda precisa ser aplicada.");
    }

    console.error("[nutrition] create document error:", serializeError(error));
    throw new Error("Não foi possível cadastrar o documento.");
  }

  if (document && file) {
    const uploaded = await uploadNutritionManagedFile({
      supabase,
      establishmentId: tenant.establishmentId,
      resourceType: "documents",
      resourceId: String((document as any).id),
      file,
      version: 1,
    });

    if (uploaded) {
      const { error: versionError } = await supabase
        .from("nutrition_document_versions")
        .insert({
          establishment_id: tenant.establishmentId,
          document_id: String((document as any).id),
          version: 1,
          file_path: uploaded.filePath,
          file_name: uploaded.fileName,
          mime_type: uploaded.mimeType,
          file_size_bytes: uploaded.fileSizeBytes,
          checksum: uploaded.checksum,
          created_by: tenant.userId,
        });

      if (versionError) {
        console.error(
          "[nutrition] document version insert error:",
          serializeError(versionError)
        );
        throw new Error("Documento cadastrado, mas a versão do arquivo não foi registrada.");
      }
    }
  }

  await appendNutritionAuditEvent(supabase, {
    establishmentId: tenant.establishmentId,
    actorUserId: tenant.userId,
    action: "document.created",
    resourceType: "nutrition_document",
    resourceId: String((document as any)?.id ?? "unknown"),
    afterData: {
      document_type: documentType,
      title,
      has_file: Boolean(file),
    },
  });

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

  const trainingIds = (data ?? []).map((row: any) => String(row.id));
  const latestSessionByTraining = new Map<
    string,
    { id: string; scheduledFor: string | null; status: string; location: string | null }
  >();

  if (trainingIds.length > 0) {
    const { data: sessions, error: sessionsError } = await supabase
      .from("nutrition_training_sessions")
      .select("id,training_id,scheduled_for,status,location,created_at")
      .eq("establishment_id", tenant.establishmentId)
      .in("training_id", trainingIds)
      .order("created_at", { ascending: false })
      .limit(100);

    if (sessionsError && !isMissingNutritionTableError(sessionsError)) {
      console.error("[nutrition] training sessions list error:", serializeError(sessionsError));
    }

    for (const session of sessions ?? []) {
      const trainingId = String((session as any).training_id ?? "");
      if (!trainingId || latestSessionByTraining.has(trainingId)) continue;
      latestSessionByTraining.set(trainingId, {
        id: String((session as any).id),
        scheduledFor: (session as any).scheduled_for
          ? String((session as any).scheduled_for)
          : null,
        status: String((session as any).status ?? "scheduled"),
        location: (session as any).location ? String((session as any).location) : null,
      });
    }
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    instructor: row.instructor ? String(row.instructor) : null,
    workloadMinutes:
      row.workload_minutes == null ? null : Number(row.workload_minutes),
    validityDays: row.validity_days == null ? null : Number(row.validity_days),
    status: String(row.status ?? "active"),
    latestSession: latestSessionByTraining.get(String(row.id)) ?? null,
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

export async function createTrainingSession(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const trainingId = String(formData.get("training_id") ?? "").trim();
  const scheduledFor = String(formData.get("scheduled_for") ?? "").trim();
  const instructor = String(formData.get("instructor") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const sessionType = String(formData.get("session_type") ?? "in_person").trim();

  if (!trainingId) throw new Error("Selecione o treinamento.");

  const { data: training, error: trainingError } = await supabase
    .from("nutrition_trainings")
    .select("id")
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", trainingId)
    .eq("status", "active")
    .maybeSingle();

  if (trainingError || !training) {
    throw new Error("Treinamento não encontrado para este estabelecimento.");
  }

  const { error } = await supabase.from("nutrition_training_sessions").insert({
    establishment_id: tenant.establishmentId,
    training_id: trainingId,
    session_type: ["in_person", "remote", "hybrid"].includes(sessionType)
      ? sessionType
      : "in_person",
    scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    instructor: instructor || null,
    location: location || null,
    status: "scheduled",
    created_by: tenant.userId,
    updated_by: tenant.userId,
  });

  if (error) {
    console.error("[nutrition] create training session error:", serializeError(error));
    throw new Error("Não foi possível agendar a turma.");
  }

  revalidatePath("/nutricao/treinamentos");
}

export async function listSupplierAssessments(): Promise<SupplierAssessmentItem[]> {
  const { tenant, supabase } = await getNutritionContext();
  const { data, error } = await supabase
    .from("nutrition_supplier_assessments")
    .select(
      "id,supplier_name,assessment_date,quality_score,sanitary_status,supplied_categories,categories_summary,supplier_document_path"
    )
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
    categoriesSummary:
      row.categories_summary ||
      (Array.isArray(row.supplied_categories)
        ? row.supplied_categories.map(String).join(", ")
        : "") ||
      null,
    documentUrl: nutritionFileUrl(
      row.supplier_document_path ? String(row.supplier_document_path) : null
    ),
  }));
}

export async function createSupplierAssessment(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const supplierName = String(formData.get("supplier_name") ?? "").trim();
  const assessmentDate = String(formData.get("assessment_date") ?? "").trim();
  const qualityScore = Number(formData.get("quality_score") ?? NaN);
  const sanitaryStatus = String(formData.get("sanitary_status") ?? "pending").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const suppliedCategories = String(formData.get("supplied_categories") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const fileValue = formData.get("file");
  const file = fileValue instanceof File ? fileValue : null;

  if (!supplierName) throw new Error("Informe o fornecedor.");

  const assessmentId = randomUUID();
  const uploaded = file
    ? await uploadNutritionManagedFile({
        supabase,
        establishmentId: tenant.establishmentId,
        resourceType: "suppliers",
        resourceId: assessmentId,
        file,
        version: 1,
      })
    : null;

  const { error } = await supabase.from("nutrition_supplier_assessments").insert({
    id: assessmentId,
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
    supplied_categories: suppliedCategories,
    categories_summary: suppliedCategories.join(", ") || null,
    supplier_document_path: uploaded?.filePath ?? null,
    document_file_name: uploaded?.fileName ?? null,
    document_mime_type: uploaded?.mimeType ?? null,
    document_file_size_bytes: uploaded?.fileSizeBytes ?? null,
    document_checksum: uploaded?.checksum ?? null,
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

  if (["suspended", "rejected"].includes(sanitaryStatus)) {
    await createNutritionScopedNotification(supabase, {
      establishmentId: tenant.establishmentId,
      userId: tenant.userId,
      type: "nutrition_supplier_risk",
      priority: sanitaryStatus === "rejected" ? "high" : "normal",
      title: "Fornecedor com restrição sanitária",
      message: `${supplierName} foi marcado como ${
        sanitaryStatus === "rejected" ? "reprovado" : "suspenso"
      }.`,
      resourceType: "nutrition_supplier_assessment",
      resourceId: assessmentId,
      href: "/nutricao/fornecedores",
      dedupeKey: `nutrition-supplier:${tenant.establishmentId}:${assessmentId}`,
      payload: {
        supplier_name: supplierName,
        sanitary_status: sanitaryStatus,
      },
    });
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function crc32(buffer: Buffer) {
  let crc = -1;

  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ -1) >>> 0;
}

function createZip(entries: Array<{ name: string; data: Buffer }>) {
  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    fileParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, centralDirectory, end]);
}

function paragraphXml(value: unknown) {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
}

function buildInspectionReportDocx(snapshot: InspectionExecutionSnapshot) {
  const body = [
    paragraphXml(`Relatório de vistoria - ${snapshot.title}`),
    paragraphXml(`Código: ${snapshot.inspectionCode ?? "-"}`),
    paragraphXml(`Status: ${snapshot.status}`),
    paragraphXml(`Resultado: ${snapshot.result ?? "-"}`),
    paragraphXml(`Conformidade: ${snapshot.compliancePercent ?? "-"}%`),
    paragraphXml(`Geolocalização: ${snapshot.geolocationStatus}`),
    paragraphXml(
      `Latitude: ${snapshot.latitude ?? "-"} | Longitude: ${snapshot.longitude ?? "-"} | Precisão: ${snapshot.geolocationAccuracyMeters ?? "-"} m`
    ),
    paragraphXml(`Hash de integridade: ${snapshot.completionIntegrityHash ?? "-"}`),
    paragraphXml("Itens avaliados"),
    ...snapshot.items.flatMap((item, index) => [
      paragraphXml(
        `${index + 1}. ${item.sectionTitle} - ${item.title} - ${
          item.answer?.conformityStatus ?? "sem resposta"
        }`
      ),
      paragraphXml(`Observação: ${item.answer?.comment ?? "-"}`),
      paragraphXml(`Evidências: ${item.evidences.length}`),
    ]),
    paragraphXml("Assinaturas"),
    ...snapshot.signatures.map((signature) =>
      paragraphXml(
        `${signature.signerName} - ${signature.signerRole ?? "Sem função"} - ${
          signature.refusalReason
            ? `Recusa: ${signature.refusalReason}`
            : `Hash: ${signature.signatureHash ?? "-"}`
        }`
      )
    ),
    "<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\"/></w:sectPr>",
  ].join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;

  return createZip([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
        "utf8"
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
        "utf8"
      ),
    },
    {
      name: "word/document.xml",
      data: Buffer.from(documentXml, "utf8"),
    },
  ]);
}

function buildInspectionReportHtml(snapshot: InspectionExecutionSnapshot) {
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const items = snapshot.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.sectionTitle)}</td>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.answer?.conformityStatus ?? "sem_resposta")}</td>
          <td>${escapeHtml(item.answer?.comment ?? "")}</td>
          <td>${item.evidences.length}</td>
        </tr>`
    )
    .join("");

  const evidences = [...snapshot.evidences, ...snapshot.items.flatMap((item) => item.evidences)]
    .map(
      (evidence) => `
        <li>${escapeHtml(evidence.fileName ?? evidence.id)}${
          evidence.caption ? ` - ${escapeHtml(evidence.caption)}` : ""
        }</li>`
    )
    .join("");

  const signatures = snapshot.signatures
    .map(
      (signature) => `
        <li>${escapeHtml(signature.signerName)} - ${escapeHtml(
          signature.signerRole ?? "Sem função"
        )}${signature.refusalReason ? ` - Recusa: ${escapeHtml(signature.refusalReason)}` : ""}${
          signature.signatureHash ? ` - Hash: ${escapeHtml(signature.signatureHash)}` : ""
        }</li>`
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(snapshot.title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
      h1 { margin-bottom: 4px; }
      .muted { color: #64748b; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
      .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f8fafc; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(snapshot.title)}</h1>
    <p class="muted">Relatório de vistoria gerado em ${generatedAt}</p>
    <div class="grid">
      <div class="box"><strong>Status</strong><br/>${escapeHtml(snapshot.status)}</div>
      <div class="box"><strong>Resultado</strong><br/>${escapeHtml(snapshot.result ?? "-")}</div>
      <div class="box"><strong>Conformidade</strong><br/>${snapshot.compliancePercent ?? "-"}%</div>
      <div class="box"><strong>Hash</strong><br/>${escapeHtml(snapshot.completionIntegrityHash ?? "-")}</div>
    </div>
    <h2>Geolocalização</h2>
    <p>Status: ${escapeHtml(snapshot.geolocationStatus)}. Latitude: ${snapshot.latitude ?? "-"}.
    Longitude: ${snapshot.longitude ?? "-"}. Precisão: ${snapshot.geolocationAccuracyMeters ?? "-"} m.</p>
    <h2>Itens avaliados</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Seção</th><th>Item</th><th>Resposta</th><th>Comentário</th><th>Evidências</th></tr>
      </thead>
      <tbody>${items}</tbody>
    </table>
    <h2>Evidências</h2>
    <ul>${evidences || "<li>Nenhuma evidência anexada.</li>"}</ul>
    <h2>Assinaturas</h2>
    <ul>${signatures || "<li>Nenhuma assinatura coletada.</li>"}</ul>
  </body>
</html>`;
}

export async function generateInspectionReport(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const inspectionId = String(formData.get("inspection_id") ?? "").trim();
  const format = String(formData.get("format") ?? "html").trim();

  if (!inspectionId) throw new Error("Vistoria não informada.");
  if (!["html", "pdf", "docx"].includes(format)) {
    throw new Error("No momento, gere relatório em HTML, PDF ou DOCX.");
  }

  const snapshot = await getInspectionExecution(inspectionId);
  if (!snapshot) throw new Error("Vistoria não encontrada.");
  if (snapshot.status !== "completed") {
    throw new Error("Conclua a vistoria antes de gerar o relatório.");
  }

  const { data: latestReport } = await supabase
    .from("nutrition_reports")
    .select("version")
    .eq("establishment_id", tenant.establishmentId)
    .eq("source_type", "inspection")
    .eq("source_id", inspectionId)
    .eq("format", format)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = Number((latestReport as any)?.version ?? 0) + 1;
  const html = buildInspectionReportHtml(snapshot);
  const contentHash = hashPayload({
    inspectionId,
    format,
    version,
    html,
    completionHash: snapshot.completionIntegrityHash,
  });

  let body: Buffer | Uint8Array;
  let mimeType: string;
  let extension: string;

  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const lines = [
      `Relatorio de vistoria: ${snapshot.title}`,
      `Status: ${snapshot.status}`,
      `Resultado: ${snapshot.result ?? "-"}`,
      `Conformidade: ${snapshot.compliancePercent ?? "-"}%`,
      `Itens: ${snapshot.items.length}`,
      `Nao conformes: ${snapshot.noncompliantItems}`,
      `Hash: ${snapshot.completionIntegrityHash ?? contentHash}`,
      "",
      "Itens avaliados:",
      ...snapshot.items.map(
        (item, index) =>
          `${index + 1}. ${item.title} - ${item.answer?.conformityStatus ?? "sem resposta"}`
      ),
    ];
    doc.text(lines, 40, 48, { maxWidth: 515 });
    body = Buffer.from(doc.output("arraybuffer"));
    mimeType = "application/pdf";
    extension = "pdf";
  } else if (format === "docx") {
    body = buildInspectionReportDocx(snapshot);
    mimeType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    extension = "docx";
  } else {
    body = Buffer.from(html, "utf8");
    mimeType = "text/html";
    extension = "html";
  }

  const filePath = `${tenant.establishmentId}/reports/inspection/${inspectionId}/v${version}-${contentHash.slice(0, 12)}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(NUTRITION_FILES_BUCKET)
    .upload(filePath, body, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[nutrition] report upload error:", serializeError(uploadError));
    throw new Error("Não foi possível armazenar o relatório.");
  }

  const { error } = await supabase.from("nutrition_reports").insert({
    establishment_id: tenant.establishmentId,
    report_type: "inspection",
    source_type: "inspection",
    source_id: inspectionId,
    title: `Relatório da vistoria - ${snapshot.title}`,
    format,
    file_path: filePath,
    verification_code: contentHash.slice(0, 16).toUpperCase(),
    content_hash: contentHash,
    version,
    status: "generated",
    generated_by: tenant.userId,
    generated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[nutrition] report insert error:", serializeError(error));
    throw new Error("O relatório foi gerado, mas não foi possível registrá-lo.");
  }

  revalidatePath("/nutricao/relatorios");
  revalidatePath(`/nutricao/vistorias/${inspectionId}`);
}

export async function enqueueNutritionReportDelivery(formData: FormData) {
  const { tenant, supabase } = await getNutritionContext();
  const reportId = String(formData.get("report_id") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const recipientName = String(formData.get("recipient_name") ?? "").trim();
  const recipientAddress = String(formData.get("recipient_address") ?? "").trim();

  if (!reportId) throw new Error("Relatório não informado.");
  if (!["email", "whatsapp", "manual_share"].includes(channel)) {
    throw new Error("Canal de envio inválido.");
  }
  if (!recipientAddress) throw new Error("Informe o destinatário.");

  const { data: report, error: reportError } = await supabase
    .from("nutrition_reports")
    .select("id,title,file_path,status")
    .eq("establishment_id", tenant.establishmentId)
    .eq("id", reportId)
    .maybeSingle();

  if (reportError || !report) throw new Error("Relatório não encontrado.");
  if (String((report as any).status) !== "generated") {
    throw new Error("Gere o relatório antes de enviar.");
  }

  const masked =
    channel === "email"
      ? recipientAddress.replace(/(^.).*(@.*$)/, "$1***$2")
      : recipientAddress.replace(/\d(?=\d{4})/g, "*");
  const idempotencyKey = hashPayload({
    reportId,
    channel,
    recipientAddress,
    filePath: (report as any).file_path,
  });

  let deliveryResult = await supabase
    .from("nutrition_report_deliveries")
    .upsert(
      {
        establishment_id: tenant.establishmentId,
        report_id: reportId,
        channel,
        recipient_name: recipientName || null,
        recipient_address_masked: masked,
        status: "pending",
        idempotency_key: idempotencyKey,
        channel_payload: {
          recipient: recipientAddress,
          report_title: (report as any).title,
          file_path: (report as any).file_path,
        },
        requested_by: tenant.userId,
        requested_at: new Date().toISOString(),
      },
      { onConflict: "establishment_id,idempotency_key" }
    )
    .select("id")
    .single();

  if (deliveryResult.error && isMissingNutritionTableError(deliveryResult.error)) {
    deliveryResult = await supabase
      .from("nutrition_report_deliveries")
      .upsert(
        {
          establishment_id: tenant.establishmentId,
          report_id: reportId,
          channel,
          recipient_name: recipientName || null,
          recipient_address_masked: masked,
          status: "pending",
          idempotency_key: idempotencyKey,
          requested_by: tenant.userId,
          requested_at: new Date().toISOString(),
        },
        { onConflict: "establishment_id,idempotency_key" }
      )
      .select("id")
      .single();
  }

  const { data: delivery, error } = deliveryResult;

  if (error || !delivery) {
    console.error("[nutrition] delivery insert error:", serializeError(error));
    throw new Error("Não foi possível registrar o envio.");
  }

  await enqueueAppJob({
    establishmentId: tenant.establishmentId,
    queueName: "nutrition",
    jobType: "nutrition.report.delivery",
    payload: {
      delivery_id: String((delivery as any).id),
      report_id: reportId,
      channel,
      recipient: recipientAddress,
    },
    dedupeKey: idempotencyKey,
    maxAttempts: 5,
  });

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
