"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { assertTenantCanAccessModule } from "@/lib/tenant/module-access";
import { assertActiveTenantRole } from "@/lib/tenant/guards";

export type TimeClockEventType =
  | "entrada"
  | "saida_refeicao"
  | "retorno_refeicao"
  | "saida";

export type TimeClockStatus =
  | "not_started"
  | "working"
  | "on_break"
  | "finished";

export type TimeClockEvent = {
  id: string;
  userId?: string | null;
  eventType: TimeClockEventType;
  occurredAt: string;
  workDate: string;
  shiftId: string | null;
  source: string;
  selfiePath: string | null;
  faceDetectionStatus: FaceDetectionStatus;
  faceCount: number | null;
};

export type TimeClockEmployee = {
  userId: string;
  name: string;
  role: string;
  sector: string | null;
  faceRegistered: boolean;
  faceSignature: number[] | null;
  updatedAt: string | null;
};

export type TimeClockRecentRecord = TimeClockEvent & {
  userId: string;
  employeeName: string;
  employeeSector: string | null;
  employeeRole: string | null;
};

export type FaceDetectionStatus =
  | "not_submitted"
  | "verified"
  | "not_detected"
  | "multiple_faces"
  | "unsupported";

export type TimeClockSettings = {
  defaultDailyMinutes: number;
  defaultBreakMinutes: number;
  toleranceMinutes: number;
  timezone: string;
  requireSelfie: boolean;
  requireFaceDetection: boolean;
};

export type TimeClockSnapshot = {
  serverNow: string;
  workDate: string;
  subjectUserId: string;
  subjectName: string;
  canManageBiometrics: boolean;
  status: TimeClockStatus;
  nextEventType: TimeClockEventType | null;
  events: TimeClockEvent[];
  recentRecords: TimeClockRecentRecord[];
  syncedTodayCount: number;
  pendingSyncCount: number;
  settings: TimeClockSettings;
  employees: TimeClockEmployee[];
};

const EVENT_SEQUENCE: TimeClockEventType[] = [
  "entrada",
  "saida_refeicao",
  "retorno_refeicao",
  "saida",
];

const LEGACY_DB_EVENT_TYPES: Record<TimeClockEventType, string> = {
  entrada: "clock_in",
  saida_refeicao: "break_start",
  retorno_refeicao: "break_end",
  saida: "clock_out",
};

const APP_EVENT_TYPES_BY_DB = Object.entries(LEGACY_DB_EVENT_TYPES).reduce(
  (acc, [appEventType, dbEventType]) => {
    acc[dbEventType] = appEventType as TimeClockEventType;
    return acc;
  },
  {} as Record<string, TimeClockEventType>
);

const SELFIE_BUCKET = "time-clock-selfies";
const EMPLOYEE_FACE_BUCKET = "employee-face-profiles";
const MAX_SELFIE_BYTES = 5 * 1024 * 1024;
const ALLOWED_SELFIE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type TimeClockSelfieInput = {
  dataUrl: string;
  mimeType: string;
  faceDetectionStatus: FaceDetectionStatus;
  faceDetectionMethod: "browser-face-detector" | "unsupported";
  faceCount: number | null;
  capturedAt: string;
  faceSignature?: number[] | null;
  matchedUserId?: string | null;
  matchScore?: number | null;
};

export type EmployeeFacePhotoInput = {
  employeeUserId: string;
  dataUrl: string;
  mimeType: string;
  faceDetectionStatus: FaceDetectionStatus;
  faceDetectionMethod: "browser-face-detector" | "unsupported";
  faceCount: number | null;
  faceSignature: number[];
  capturedAt: string;
};

const ROLE_KEYS = [
  "admin",
  "operacao",
  "producao",
  "estoque",
  "fiscal",
  "entrega",
] as const;

function isMissingTableError(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  const details = String(error?.details ?? "").toLowerCase();

  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST200" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("column") ||
    details.includes("schema cache") ||
    details.includes("column")
  );
}

function serializeSupabaseError(error: any) {
  return {
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  };
}

function isAdminLikeRole(role: string) {
  return role === "admin" || role === "operacao";
}

function isEventTypeCompatibilityError(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  const details = String(error?.details ?? "").toLowerCase();

  return (
    code === "23514" &&
    (message.includes("event_type") || details.includes("event_type"))
  );
}

function normalizeFaceSignature(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  const signature = source
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.min(1, Math.max(0, item)));

  return signature.length >= 64 ? signature : null;
}

function getDateKeyInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function subtractDaysFromDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function normalizeSettings(row: any): TimeClockSettings {
  return {
    defaultDailyMinutes: Number(
      row?.default_daily_minutes ?? row?.daily_minutes ?? 480
    ),
    defaultBreakMinutes: Number(
      row?.default_break_minutes ?? row?.break_minutes ?? 60
    ),
    toleranceMinutes: Number(row?.tolerance_minutes ?? 10),
    timezone: String(row?.timezone ?? "America/Sao_Paulo"),
    requireSelfie: Boolean(row?.require_selfie ?? true),
    requireFaceDetection: Boolean(row?.require_face_detection ?? true),
  };
}

function normalizeEvent(row: any): TimeClockEvent {
  const dbEventType = String(row.event_type);

  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    eventType:
      APP_EVENT_TYPES_BY_DB[dbEventType] ?? (dbEventType as TimeClockEventType),
    occurredAt: String(row.occurred_at),
    workDate: String(row.work_date),
    shiftId: row.shift_id ? String(row.shift_id) : null,
    source: String(row.source ?? "web"),
    selfiePath: row.selfie_path ? String(row.selfie_path) : null,
    faceDetectionStatus: String(
      row.face_detection_status ?? "not_submitted"
    ) as FaceDetectionStatus,
    faceCount:
      row.face_count === null || row.face_count === undefined
        ? null
        : Number(row.face_count),
  };
}

function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function parseSelfieInput(selfie: TimeClockSelfieInput | null | undefined) {
  if (!selfie?.dataUrl) {
    throw new Error("Capture uma selfie para registrar o ponto.");
  }

  const match = String(selfie.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Selfie inválida.");
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_SELFIE_TYPES.has(mimeType)) {
    throw new Error("Formato da selfie não suportado.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength <= 0) {
    throw new Error("Selfie vazia.");
  }

  if (buffer.byteLength > MAX_SELFIE_BYTES) {
    throw new Error("Selfie maior que 5MB.");
  }

  const status = selfie.faceDetectionStatus;
  if (
    ![
      "verified",
      "not_detected",
      "multiple_faces",
      "unsupported",
      "not_submitted",
    ].includes(status)
  ) {
    throw new Error("Status facial inválido.");
  }

  return {
    buffer,
    mimeType,
    faceDetectionStatus: status,
    faceDetectionMethod: selfie.faceDetectionMethod,
    faceCount:
      selfie.faceCount === null || selfie.faceCount === undefined
        ? null
        : Math.max(0, Number(selfie.faceCount)),
    capturedAt: selfie.capturedAt,
    faceSignature: normalizeFaceSignature(selfie.faceSignature),
    matchedUserId: selfie.matchedUserId ? String(selfie.matchedUserId) : null,
    matchScore:
      selfie.matchScore === null || selfie.matchScore === undefined
        ? null
        : Number(selfie.matchScore),
  };
}

function parseEmployeeFacePhotoInput(input: EmployeeFacePhotoInput) {
  const employeeUserId = String(input.employeeUserId ?? "").trim();

  if (!employeeUserId) {
    throw new Error("Colaborador não informado.");
  }

  const parsed = parseSelfieInput(input);
  const faceSignature = normalizeFaceSignature(input.faceSignature);

  if (!faceSignature) {
    throw new Error("Não foi possível gerar a assinatura facial.");
  }

  if (
    parsed.faceDetectionStatus !== "verified" &&
    parsed.faceDetectionStatus !== "unsupported"
  ) {
    throw new Error("Use uma foto com apenas um rosto visível.");
  }

  return {
    ...parsed,
    employeeUserId,
    faceSignature,
  };
}

async function uploadSelfie(params: {
  establishmentId: string;
  userId: string;
  workDate: string;
  eventType: TimeClockEventType;
  selfie: ReturnType<typeof parseSelfieInput>;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const extension = extensionForMimeType(params.selfie.mimeType);
  const path = [
    params.establishmentId,
    params.userId,
    params.workDate,
    `${params.eventType}-${Date.now()}.${extension}`,
  ].join("/");

  const { error } = await supabaseAdmin.storage
    .from(SELFIE_BUCKET)
    .upload(path, params.selfie.buffer, {
      contentType: params.selfie.mimeType,
      upsert: false,
    });

  if (error) {
    console.error("[time-clock] selfie upload error:", error);
    throw new Error("Não foi possível salvar a selfie do ponto.");
  }

  return path;
}

async function uploadEmployeeFacePhoto(params: {
  establishmentId: string;
  employeeUserId: string;
  photo: ReturnType<typeof parseEmployeeFacePhotoInput>;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const extension = extensionForMimeType(params.photo.mimeType);
  const path = [
    params.establishmentId,
    params.employeeUserId,
    `face-profile-${Date.now()}.${extension}`,
  ].join("/");

  const { error } = await supabaseAdmin.storage
    .from(EMPLOYEE_FACE_BUCKET)
    .upload(path, params.photo.buffer, {
      contentType: params.photo.mimeType,
      upsert: false,
    });

  if (error) {
    console.error("[time-clock] employee face upload error:", error);
    throw new Error("Não foi possível salvar a foto de biometria.");
  }

  return path;
}

function getEventsForWorkDate(events: TimeClockEvent[], workDate: string) {
  return events
    .filter((event) => event.workDate === workDate)
    .sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );
}

function getNextEventType(events: TimeClockEvent[]) {
  const recorded = new Set(events.map((event) => event.eventType));
  return EVENT_SEQUENCE.find((eventType) => !recorded.has(eventType)) ?? null;
}

function getStatus(events: TimeClockEvent[]): TimeClockStatus {
  const recorded = new Set(events.map((event) => event.eventType));

  if (recorded.has("saida")) return "finished";
  if (recorded.has("saida_refeicao") && !recorded.has("retorno_refeicao")) {
    return "on_break";
  }
  if (recorded.has("entrada")) return "working";

  return "not_started";
}

function getActiveWorkDate(params: {
  events: TimeClockEvent[];
  today: string;
}) {
  const workDates = Array.from(
    new Set(params.events.map((event) => event.workDate))
  ).sort();

  const latestWorkDate = workDates.at(-1);
  if (!latestWorkDate) return params.today;

  const latestEvents = getEventsForWorkDate(params.events, latestWorkDate);
  const latestStatus = getStatus(latestEvents);

  if (latestStatus !== "finished") return latestWorkDate;

  return params.today;
}

async function getContext() {
  const tenant = await assertActiveTenantRole([...ROLE_KEYS]);
  await assertTenantCanAccessModule(tenant, "rh");

  return tenant;
}

async function listEmployees(establishmentId: string): Promise<TimeClockEmployee[]> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("memberships")
    .select("user_id, role")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (membershipsError) {
    console.error(
      "[time-clock] employees memberships error:",
      serializeSupabaseError(membershipsError)
    );
    throw new Error("Não foi possível carregar os colaboradores.");
  }

  const employeeRows = (memberships ?? []).filter(
    (membership: any) => String(membership.role ?? "") !== "cliente"
  );
  const userIds = Array.from(
    new Set(employeeRows.map((membership: any) => String(membership.user_id)))
  );

  if (userIds.length === 0) return [];

  const [{ data: profiles, error: profilesError }, faceProfilesResult] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, role, sector")
        .in("id", userIds),
      supabaseAdmin
        .from("hr_employee_face_profiles")
        .select("user_id, face_signature, updated_at")
        .eq("establishment_id", establishmentId)
        .in("user_id", userIds),
    ]);

  if (profilesError && !isMissingTableError(profilesError)) {
    console.warn(
      "[time-clock] employees profiles fallback:",
      serializeSupabaseError(profilesError)
    );
  }

  const profileById = new Map<string, any>();
  for (const profile of profiles ?? []) {
    profileById.set(String((profile as any).id), profile);
  }

  const faceProfileByUserId = new Map<string, any>();
  if (!faceProfilesResult.error) {
    for (const faceProfile of faceProfilesResult.data ?? []) {
      faceProfileByUserId.set(String((faceProfile as any).user_id), faceProfile);
    }
  } else if (!isMissingTableError(faceProfilesResult.error)) {
    console.warn(
      "[time-clock] face profiles fallback:",
      serializeSupabaseError(faceProfilesResult.error)
    );
  }

  return employeeRows
    .map((membership: any) => {
      const userId = String(membership.user_id);
      const profile = profileById.get(userId);
      const faceProfile = faceProfileByUserId.get(userId);
      const signature = normalizeFaceSignature(faceProfile?.face_signature);
      const name =
        String(profile?.full_name ?? "").trim() ||
        `Colaborador ${userId.slice(0, 8)}`;

      return {
        userId,
        name,
        role: String(membership.role ?? profile?.role ?? "operacao"),
        sector: profile?.sector ? String(profile.sector) : null,
        faceRegistered: Boolean(signature),
        faceSignature: signature,
        updatedAt: faceProfile?.updated_at
          ? String(faceProfile.updated_at)
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function getEmployeeOrThrow(params: {
  establishmentId: string;
  userId: string;
}) {
  const employees = await listEmployees(params.establishmentId);
  const employee = employees.find((item) => item.userId === params.userId);

  if (!employee) {
    throw new Error("Colaborador não encontrado neste estabelecimento.");
  }

  return employee;
}

async function fetchSettings(establishmentId: string) {
  const supabaseAdmin = getSupabaseAdminClient();

  const fullResult = await supabaseAdmin
    .from("hr_time_clock_settings")
    .select(
      "default_daily_minutes, default_break_minutes, tolerance_minutes, timezone, require_selfie, require_face_detection"
    )
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (!fullResult.error) {
    return normalizeSettings(fullResult.data);
  }

  if (isMissingTableError(fullResult.error)) {
    const legacyResult = await supabaseAdmin
      .from("hr_time_clock_settings")
      .select("daily_minutes, break_minutes, tolerance_minutes, timezone")
      .eq("establishment_id", establishmentId)
      .maybeSingle();

    if (!legacyResult.error) {
      return normalizeSettings({
        ...legacyResult.data,
        require_selfie: false,
        require_face_detection: false,
      });
    }

    if (isMissingTableError(legacyResult.error)) {
      return normalizeSettings({
        require_selfie: false,
        require_face_detection: false,
      });
    }

    console.warn(
      "[time-clock] legacy settings fallback:",
      serializeSupabaseError(legacyResult.error)
    );
    return normalizeSettings({
      require_selfie: false,
      require_face_detection: false,
    });
  }

  console.warn(
    "[time-clock] settings fallback:",
    serializeSupabaseError(fullResult.error)
  );
  return normalizeSettings({
    require_selfie: false,
    require_face_detection: false,
  });
}

async function fetchRecentEvents(params: {
  establishmentId: string;
  userId: string;
  serverNow: Date;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const since = new Date(
    params.serverNow.getTime() - 42 * 60 * 60 * 1000
  ).toISOString();

  const fullResult = await supabaseAdmin
    .from("hr_time_clock_events")
    .select(
      "id, shift_id, event_type, occurred_at, work_date, source, selfie_path, face_detection_status, face_count"
    )
    .eq("establishment_id", params.establishmentId)
    .eq("user_id", params.userId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: true });

  if (!fullResult.error) {
    return (fullResult.data ?? []).map(normalizeEvent);
  }

  if (!isMissingTableError(fullResult.error)) {
    console.error(
      "[time-clock] events error:",
      serializeSupabaseError(fullResult.error)
    );
    throw new Error("Não foi possível carregar suas marcações.");
  }

  const legacyResult = await supabaseAdmin
    .from("hr_time_clock_events")
    .select("id, shift_id, event_type, occurred_at, work_date, source")
    .eq("establishment_id", params.establishmentId)
    .eq("user_id", params.userId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: true });

  if (legacyResult.error) {
    if (isMissingTableError(legacyResult.error)) return [];

    console.error(
      "[time-clock] legacy events error:",
      serializeSupabaseError(legacyResult.error)
    );
    throw new Error("Não foi possível carregar suas marcações.");
  }

  return (legacyResult.data ?? []).map(normalizeEvent);
}

async function fetchRecentRecords(params: {
  establishmentId: string;
  employees: TimeClockEmployee[];
  serverNow: Date;
  workDate: string;
}): Promise<{ records: TimeClockRecentRecord[]; syncedTodayCount: number }> {
  const supabaseAdmin = getSupabaseAdminClient();
  const since = new Date(
    params.serverNow.getTime() - 42 * 60 * 60 * 1000
  ).toISOString();
  const employeeByUserId = new Map(
    params.employees.map((employee) => [employee.userId, employee])
  );

  const normalizeRecords = (rows: any[]) => {
    const records = rows
      .map(normalizeEvent)
      .filter((event) => event.workDate === params.workDate && event.userId)
      .map((event) => {
        const employee = employeeByUserId.get(String(event.userId));

        return {
          ...event,
          userId: String(event.userId),
          employeeName: employee?.name ?? "Colaborador",
          employeeSector: employee?.sector ?? null,
          employeeRole: employee?.role ?? null,
        } satisfies TimeClockRecentRecord;
      })
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );

    return {
      records: records.slice(0, 12),
      syncedTodayCount: records.length,
    };
  };

  const fullResult = await supabaseAdmin
    .from("hr_time_clock_events")
    .select(
      "id, user_id, shift_id, event_type, occurred_at, work_date, source, selfie_path, face_detection_status, face_count"
    )
    .eq("establishment_id", params.establishmentId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(80);

  if (!fullResult.error) {
    return normalizeRecords(fullResult.data ?? []);
  }

  if (!isMissingTableError(fullResult.error)) {
    console.warn(
      "[time-clock] recent records fallback:",
      serializeSupabaseError(fullResult.error)
    );
    return { records: [], syncedTodayCount: 0 };
  }

  const legacyResult = await supabaseAdmin
    .from("hr_time_clock_events")
    .select("id, user_id, shift_id, event_type, occurred_at, work_date, source")
    .eq("establishment_id", params.establishmentId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(80);

  if (legacyResult.error) {
    if (!isMissingTableError(legacyResult.error)) {
      console.warn(
        "[time-clock] legacy recent records fallback:",
        serializeSupabaseError(legacyResult.error)
      );
    }
    return { records: [], syncedTodayCount: 0 };
  }

  return normalizeRecords(legacyResult.data ?? []);
}

async function fetchOpenShift(params: {
  establishmentId: string;
  userId: string;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("hr_time_clock_shifts")
    .select("id, work_date, status")
    .eq("establishment_id", params.establishmentId)
    .eq("user_id", params.userId)
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;

    console.warn(
      "[time-clock] open shift lookup:",
      serializeSupabaseError(error)
    );
    return null;
  }

  if (!data?.id) return null;

  return {
    id: String(data.id),
    workDate: String(data.work_date),
  };
}

async function fetchShiftForWorkDate(params: {
  establishmentId: string;
  userId: string;
  workDate: string;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("hr_time_clock_shifts")
    .select("id, work_date, status")
    .eq("establishment_id", params.establishmentId)
    .eq("user_id", params.userId)
    .eq("work_date", params.workDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;

    console.warn("[time-clock] shift lookup:", serializeSupabaseError(error));
    return null;
  }

  if (!data?.id) return null;

  return {
    id: String(data.id),
    workDate: String(data.work_date),
  };
}

async function createTimeClockShift(params: {
  establishmentId: string;
  userId: string;
  createdBy: string;
  workDate: string;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("hr_time_clock_shifts")
    .insert({
      establishment_id: params.establishmentId,
      user_id: params.userId,
      work_date: params.workDate,
      status: "open",
      created_by: params.createdBy,
    })
    .select("id, work_date")
    .single();

  if (!error) {
    return {
      id: String(data.id),
      workDate: String(data.work_date),
    };
  }

  if (isMissingTableError(error)) return null;

  if (String(error.code ?? "") === "23505") {
    return fetchOpenShift({
      establishmentId: params.establishmentId,
      userId: params.userId,
    });
  }

  console.error(
    "[time-clock] shift create error:",
    serializeSupabaseError(error)
  );
  throw new Error("Não foi possível abrir a jornada do ponto.");
}

async function resolveShiftForEvent(params: {
  establishmentId: string;
  userId: string;
  createdBy: string;
  workDate: string;
  events: TimeClockEvent[];
  nextEventType: TimeClockEventType;
}) {
  const existingShiftId = params.events.find((event) => event.shiftId)?.shiftId;
  if (existingShiftId) {
    return {
      id: existingShiftId,
      workDate: params.workDate,
    };
  }

  const openShift = await fetchOpenShift({
    establishmentId: params.establishmentId,
    userId: params.userId,
  });
  if (openShift) return openShift;

  const workDateShift = await fetchShiftForWorkDate({
    establishmentId: params.establishmentId,
    userId: params.userId,
    workDate: params.workDate,
  });
  if (workDateShift) return workDateShift;

  if (params.nextEventType !== "entrada") return null;

  return createTimeClockShift({
    establishmentId: params.establishmentId,
    userId: params.userId,
    createdBy: params.createdBy,
    workDate: params.workDate,
  });
}

async function closeTimeClockShift(params: {
  shiftId: string | null;
  closedAt: string;
}) {
  if (!params.shiftId) return;

  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("hr_time_clock_shifts")
    .update({
      status: "closed",
      closed_at: params.closedAt,
    })
    .eq("id", params.shiftId)
    .eq("status", "open");

  if (error && !isMissingTableError(error)) {
    console.warn(
      "[time-clock] shift close warning:",
      serializeSupabaseError(error)
    );
  }
}

export async function saveEmployeeFaceProfile(
  input: EmployeeFacePhotoInput
): Promise<TimeClockSnapshot> {
  const tenant = await getContext();

  if (!isAdminLikeRole(tenant.role)) {
    throw new Error("Somente administrador ou operação pode cadastrar biometria.");
  }

  const parsedPhoto = parseEmployeeFacePhotoInput(input);
  const employee = await getEmployeeOrThrow({
    establishmentId: tenant.establishmentId,
    userId: parsedPhoto.employeeUserId,
  });
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: currentProfile } = await supabaseAdmin
    .from("hr_employee_face_profiles")
    .select("photo_path")
    .eq("establishment_id", tenant.establishmentId)
    .eq("user_id", employee.userId)
    .maybeSingle();
  const photoPath = await uploadEmployeeFacePhoto({
    establishmentId: tenant.establishmentId,
    employeeUserId: employee.userId,
    photo: parsedPhoto,
  });

  const { error } = await supabaseAdmin
    .from("hr_employee_face_profiles")
    .upsert(
      {
        establishment_id: tenant.establishmentId,
        user_id: employee.userId,
        photo_path: photoPath,
        photo_mime_type: parsedPhoto.mimeType,
        face_signature: parsedPhoto.faceSignature,
        face_detection_status: parsedPhoto.faceDetectionStatus,
        face_detection_method: parsedPhoto.faceDetectionMethod,
        face_count: parsedPhoto.faceCount,
        client_captured_at: parsedPhoto.capturedAt,
        created_by: tenant.userId,
        updated_by: tenant.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "establishment_id,user_id" }
    );

  if (error) {
    await supabaseAdmin.storage
      .from(EMPLOYEE_FACE_BUCKET)
      .remove([photoPath])
      .catch(() => {});

    console.error(
      "[time-clock] employee face upsert error:",
      serializeSupabaseError(error)
    );
    throw new Error("Não foi possível salvar a biometria do colaborador.");
  }

  if (currentProfile?.photo_path) {
    await supabaseAdmin.storage
      .from(EMPLOYEE_FACE_BUCKET)
      .remove([String(currentProfile.photo_path)])
      .catch(() => {});
  }

  revalidatePath("/dashboard/rh");
  revalidatePath("/dashboard/rh/ponto-digital");

  return getTimeClockSnapshot(employee.userId);
}

export async function getTimeClockSnapshot(
  subjectUserId?: string | null
): Promise<TimeClockSnapshot> {
  const tenant = await getContext();
  const serverNow = new Date();
  const employees = await listEmployees(tenant.establishmentId);
  const requestedSubjectUserId = String(subjectUserId ?? "").trim();
  const subject =
    employees.find((employee) => employee.userId === requestedSubjectUserId) ??
    employees.find((employee) => employee.userId === tenant.userId) ??
    null;
  const targetUserId = subject?.userId ?? tenant.userId;
  const targetName = subject?.name ?? "Usuário";
  const settings = await fetchSettings(tenant.establishmentId);
  const today = getDateKeyInTimezone(serverNow, settings.timezone);
  const recentEvents = await fetchRecentEvents({
    establishmentId: tenant.establishmentId,
    userId: targetUserId,
    serverNow,
  });

  const activeWorkDate = getActiveWorkDate({
    events: recentEvents.filter(
      (event) => event.workDate >= subtractDaysFromDateKey(today, 1)
    ),
    today,
  });
  const events = getEventsForWorkDate(recentEvents, activeWorkDate);
  const recentRecordsResult = await fetchRecentRecords({
    establishmentId: tenant.establishmentId,
    employees,
    serverNow,
    workDate: activeWorkDate,
  });

  return {
    serverNow: serverNow.toISOString(),
    workDate: activeWorkDate,
    subjectUserId: targetUserId,
    subjectName: targetName,
    canManageBiometrics: isAdminLikeRole(tenant.role),
    status: getStatus(events),
    nextEventType: getNextEventType(events),
    events,
    recentRecords: recentRecordsResult.records,
    syncedTodayCount: recentRecordsResult.syncedTodayCount,
    pendingSyncCount: 0,
    settings,
    employees,
  };
}

export async function recordTimeClockEvent(
  selfieInput?: TimeClockSelfieInput | null,
  targetUserIdInput?: string | null
): Promise<TimeClockSnapshot> {
  const tenant = await getContext();
  const serverNow = new Date();
  const targetUserId = String(
    targetUserIdInput || selfieInput?.matchedUserId || tenant.userId
  ).trim();
  const targetEmployee =
    targetUserId === tenant.userId
      ? null
      : await getEmployeeOrThrow({
          establishmentId: tenant.establishmentId,
          userId: targetUserId,
        });

  if (targetUserId !== tenant.userId && !selfieInput?.dataUrl) {
    throw new Error("Capture a selfie para registrar o ponto de outro colaborador.");
  }

  const settings = await fetchSettings(tenant.establishmentId);
  const today = getDateKeyInTimezone(serverNow, settings.timezone);
  const recentEvents = await fetchRecentEvents({
    establishmentId: tenant.establishmentId,
    userId: targetUserId,
    serverNow,
  });
  const activeWorkDate = getActiveWorkDate({
    events: recentEvents.filter(
      (event) => event.workDate >= subtractDaysFromDateKey(today, 1)
    ),
    today,
  });
  const events = getEventsForWorkDate(recentEvents, activeWorkDate);
  const nextEventType = getNextEventType(events);

  if (!nextEventType) {
    throw new Error("A jornada de hoje já foi encerrada.");
  }

  const parsedSelfie = settings.requireSelfie
    ? parseSelfieInput(selfieInput)
    : selfieInput?.dataUrl
      ? parseSelfieInput(selfieInput)
      : null;

  if (
    settings.requireFaceDetection &&
    parsedSelfie &&
    parsedSelfie.faceDetectionStatus !== "verified" &&
    parsedSelfie.faceDetectionStatus !== "unsupported"
  ) {
    throw new Error("Capture uma selfie com apenas um rosto visível.");
  }

  let selfiePath: string | null = null;

  if (parsedSelfie) {
    try {
      selfiePath = await uploadSelfie({
        establishmentId: tenant.establishmentId,
        userId: targetUserId,
        workDate: activeWorkDate,
        eventType: nextEventType,
        selfie: parsedSelfie,
      });
    } catch (uploadError) {
      if (settings.requireSelfie) {
        throw uploadError;
      }

      console.warn("[time-clock] optional selfie skipped:", uploadError);
    }
  }

  const shift = await resolveShiftForEvent({
    establishmentId: tenant.establishmentId,
    userId: targetUserId,
    createdBy: tenant.userId,
    workDate: activeWorkDate,
    events,
    nextEventType,
  });

  if (!shift?.id) {
    throw new Error("Não foi possível abrir a jornada do ponto.");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const baseEventPayload = {
    establishment_id: tenant.establishmentId,
    user_id: targetUserId,
    shift_id: shift.id,
    work_date: activeWorkDate,
    event_type: nextEventType,
    source: "web",
    created_by: tenant.userId,
  };
  const legacyEventPayload = {
    ...baseEventPayload,
    event_type: LEGACY_DB_EVENT_TYPES[nextEventType],
  };
  const fullEventPayload = {
    ...baseEventPayload,
    selfie_path: selfiePath,
    selfie_mime_type: parsedSelfie?.mimeType ?? null,
    face_detection_status:
      parsedSelfie?.faceDetectionStatus ?? "not_submitted",
    face_detection_method: parsedSelfie?.faceDetectionMethod ?? null,
    face_count: parsedSelfie?.faceCount ?? null,
    client_captured_at: parsedSelfie?.capturedAt ?? null,
    face_match_user_id:
      targetEmployee?.userId ?? parsedSelfie?.matchedUserId ?? null,
    face_match_score: parsedSelfie?.matchScore ?? null,
  };
  const legacyFullEventPayload = {
    ...fullEventPayload,
    event_type: LEGACY_DB_EVENT_TYPES[nextEventType],
  };
  const insertAttempts = [
    {
      payload: fullEventPayload,
      storesSelfie: true,
    },
    {
      payload: baseEventPayload,
      storesSelfie: false,
    },
    {
      payload: legacyFullEventPayload,
      storesSelfie: true,
    },
    {
      payload: legacyEventPayload,
      storesSelfie: false,
    },
  ];

  let error: any = null;
  let storedSelfieOnEvent = false;

  for (const attempt of insertAttempts) {
    const result = await supabaseAdmin
      .from("hr_time_clock_events")
      .insert(attempt.payload);

    if (!result.error) {
      error = null;
      storedSelfieOnEvent = attempt.storesSelfie;
      break;
    }

    error = result.error;

    if (!isMissingTableError(error) && !isEventTypeCompatibilityError(error)) {
      break;
    }
  }

  if (error) {
    if (selfiePath) {
      await supabaseAdmin.storage
        .from(SELFIE_BUCKET)
        .remove([selfiePath])
        .catch(() => {});
    }

    if (String((error as any)?.code ?? "") === "23505") {
      throw new Error("Esta marcação já foi registrada.");
    }

    console.error("[time-clock] insert error:", serializeSupabaseError(error));
    throw new Error("Não foi possível registrar o ponto.");
  }

  if (selfiePath && !storedSelfieOnEvent) {
    await supabaseAdmin.storage
      .from(SELFIE_BUCKET)
      .remove([selfiePath])
      .catch(() => {});
  }

  if (nextEventType === "saida") {
    await closeTimeClockShift({
      shiftId: shift?.id ?? null,
      closedAt: serverNow.toISOString(),
    });
  }

  revalidatePath("/dashboard/rh");
  revalidatePath("/dashboard/rh/ponto-digital");

  return getTimeClockSnapshot(targetUserId);
}
