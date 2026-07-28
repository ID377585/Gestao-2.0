import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { getTenantModulePermissions } from "@/lib/tenant/module-access";
import { writeTenantAuditLog } from "@/lib/tenant/audit";
import type {
  TimeClockDashboardData,
  TimeClockEventType,
  TimeClockEventView,
  TimeClockSettings,
  TimeClockSettingsInput,
  TimeClockShiftSummary,
  TimeClockState,
} from "@/lib/hr/time-clock-types";

const DEFAULT_SETTINGS: TimeClockSettings = {
  enabled: true,
  dailyMinutes: 480,
  breakMinutes: 60,
  toleranceMinutes: 10,
  timezone: "America/Sao_Paulo",
  allowOvernight: true,
  maxShiftHours: 20,
};

const HISTORY_LIMIT = 14;
const SHIFT_QUERY_LIMIT = 45;
const MIN_EVENT_INTERVAL_SECONDS = 10;

type TimeClockContext = {
  tenant: NonNullable<Awaited<ReturnType<typeof getCurrentTenant>>>;
  userId: string;
  userName: string;
  admin: ReturnType<typeof getSupabaseAdminClient>;
};

type ShiftRow = {
  id: string;
  establishment_id: string;
  user_id: string;
  work_date: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
};

type EventRow = {
  id: string;
  shift_id: string;
  event_type: TimeClockEventType;
  occurred_at: string;
};

type AdjustmentRow = {
  shift_id: string | null;
  work_date: string;
  adjustment_minutes: number;
};

function safeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeSettings(row?: Record<string, unknown> | null): TimeClockSettings {
  return {
    enabled: row?.enabled !== false,
    dailyMinutes: safeInteger(row?.daily_minutes, DEFAULT_SETTINGS.dailyMinutes),
    breakMinutes: safeInteger(row?.break_minutes, DEFAULT_SETTINGS.breakMinutes),
    toleranceMinutes: safeInteger(
      row?.tolerance_minutes,
      DEFAULT_SETTINGS.toleranceMinutes
    ),
    timezone:
      String(row?.timezone ?? "").trim() || DEFAULT_SETTINGS.timezone,
    allowOvernight: row?.allow_overnight !== false,
    maxShiftHours: safeInteger(
      row?.max_shift_hours,
      DEFAULT_SETTINGS.maxShiftHours
    ),
  };
}

function validateTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function dateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function asTimestamp(value?: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function positiveSeconds(start?: string | null, end?: string | null) {
  const startMs = asTimestamp(start);
  const endMs = asTimestamp(end);

  if (startMs === null || endMs === null || endMs <= startMs) return 0;
  return Math.floor((endMs - startMs) / 1000);
}

function eventByType(events: TimeClockEventView[], eventType: TimeClockEventType) {
  return events.find((event) => event.eventType === eventType) ?? null;
}

function calculateShiftSummary(params: {
  shift: ShiftRow;
  events: TimeClockEventView[];
  adjustmentSeconds: number;
  settings: TimeClockSettings;
  nowIso: string;
}): TimeClockShiftSummary {
  const events = [...params.events].sort(
    (left, right) =>
      new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
  );

  const clockIn = eventByType(events, "clock_in");
  const breakStart = eventByType(events, "break_start");
  const breakEnd = eventByType(events, "break_end");
  const clockOut = eventByType(events, "clock_out");
  const effectiveEnd = clockOut?.occurredAt ?? params.nowIso;

  let workedSeconds = 0;

  if (clockIn) {
    workedSeconds += positiveSeconds(
      clockIn.occurredAt,
      breakStart?.occurredAt ?? effectiveEnd
    );

    if (breakEnd) {
      workedSeconds += positiveSeconds(breakEnd.occurredAt, effectiveEnd);
    }
  }

  const breakSeconds = breakStart
    ? positiveSeconds(
        breakStart.occurredAt,
        breakEnd?.occurredAt ?? effectiveEnd
      )
    : 0;

  const targetSeconds = params.settings.dailyMinutes * 60;
  const rawBalanceSeconds =
    workedSeconds - targetSeconds + params.adjustmentSeconds;
  const effectiveStatus: "open" | "closed" = clockOut
    ? "closed"
    : params.shift.status;
  const toleranceSeconds = params.settings.toleranceMinutes * 60;
  const balanceSeconds =
    effectiveStatus === "closed" &&
    Math.abs(rawBalanceSeconds) <= toleranceSeconds
      ? 0
      : rawBalanceSeconds;

  const lastEvent = events.at(-1) ?? null;
  const liveWorkStartedAt =
    effectiveStatus === "open" &&
    (lastEvent?.eventType === "clock_in" || lastEvent?.eventType === "break_end")
      ? lastEvent.occurredAt
      : null;
  const liveBreakStartedAt =
    effectiveStatus === "open" && lastEvent?.eventType === "break_start"
      ? lastEvent.occurredAt
      : null;

  return {
    shiftId: params.shift.id,
    workDate: params.shift.work_date,
    status: effectiveStatus,
    openedAt: params.shift.opened_at,
    closedAt: clockOut?.occurredAt ?? params.shift.closed_at,
    events,
    workedSeconds,
    breakSeconds,
    targetSeconds,
    adjustmentSeconds: params.adjustmentSeconds,
    balanceSeconds,
    liveWorkStartedAt,
    liveBreakStartedAt,
  };
}

function nextEventFromLast(lastEvent?: TimeClockEventView | null): {
  eventType: TimeClockEventType;
  actionLabel: string;
  state: TimeClockState;
} {
  switch (lastEvent?.eventType) {
    case "clock_in":
      return {
        eventType: "break_start",
        actionLabel: "Iniciar intervalo",
        state: "working",
      };
    case "break_start":
      return {
        eventType: "break_end",
        actionLabel: "Retornar do intervalo",
        state: "on_break",
      };
    case "break_end":
      return {
        eventType: "clock_out",
        actionLabel: "Registrar saída",
        state: "working",
      };
    default:
      return {
        eventType: "clock_in",
        actionLabel: "Registrar entrada",
        state: "not_started",
      };
  }
}

async function getTimeClockContext(): Promise<TimeClockContext> {
  const tenant = await getCurrentTenant();

  if (!tenant?.establishmentId) {
    throw new Error("Empresa ativa não encontrada.");
  }

  if (tenant.role === "cliente") {
    throw new Error("Seu perfil não possui acesso ao Ponto Digital.");
  }

  const permissions = await getTenantModulePermissions(tenant);
  if (!permissions.rh) {
    throw new Error("Seu acesso ao módulo RH está desativado.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || user.id !== tenant.userId) {
    throw new Error("Não autenticado.");
  }

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    tenant,
    userId: user.id,
    userName:
      String((profile as { full_name?: string | null } | null)?.full_name ?? "").trim() ||
      user.email?.split("@")[0] ||
      "Usuário",
    admin,
  };
}

async function loadTimeClockSettings(context: TimeClockContext) {
  const { data, error } = await context.admin
    .from("hr_time_clock_settings")
    .select(
      "enabled, daily_minutes, break_minutes, tolerance_minutes, timezone, allow_overnight, max_shift_hours"
    )
    .eq("establishment_id", context.tenant.establishmentId)
    .maybeSingle();

  if (error) {
    console.error("[time-clock] erro ao carregar configurações:", error);
    throw new Error("Não foi possível carregar as configurações de jornada.");
  }

  return normalizeSettings(data as Record<string, unknown> | null);
}

async function buildDashboardData(
  context: TimeClockContext,
  settings?: TimeClockSettings
): Promise<TimeClockDashboardData> {
  const effectiveSettings = settings ?? (await loadTimeClockSettings(context));
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: shiftRows, error: shiftsError } = await context.admin
    .from("hr_time_clock_shifts")
    .select("id, establishment_id, user_id, work_date, status, opened_at, closed_at")
    .eq("establishment_id", context.tenant.establishmentId)
    .eq("user_id", context.userId)
    .order("work_date", { ascending: false })
    .order("opened_at", { ascending: false })
    .limit(SHIFT_QUERY_LIMIT);

  if (shiftsError) {
    console.error("[time-clock] erro ao carregar jornadas:", shiftsError);
    throw new Error("Não foi possível carregar o histórico do ponto.");
  }

  const shifts = (shiftRows ?? []) as ShiftRow[];
  const shiftIds = shifts.map((shift) => shift.id);

  let events: EventRow[] = [];
  if (shiftIds.length > 0) {
    const { data, error } = await context.admin
      .from("hr_time_clock_events")
      .select("id, shift_id, event_type, occurred_at")
      .eq("establishment_id", context.tenant.establishmentId)
      .eq("user_id", context.userId)
      .in("shift_id", shiftIds)
      .order("occurred_at", { ascending: true });

    if (error) {
      console.error("[time-clock] erro ao carregar marcações:", error);
      throw new Error("Não foi possível carregar as marcações de ponto.");
    }

    events = (data ?? []) as EventRow[];
  }

  const { data: adjustmentRows, error: adjustmentsError } = await context.admin
    .from("hr_time_clock_adjustments")
    .select("shift_id, work_date, adjustment_minutes")
    .eq("establishment_id", context.tenant.establishmentId)
    .eq("user_id", context.userId)
    .order("work_date", { ascending: false })
    .limit(100);

  if (adjustmentsError) {
    console.error("[time-clock] erro ao carregar ajustes:", adjustmentsError);
    throw new Error("Não foi possível carregar os ajustes do ponto.");
  }

  const adjustments = (adjustmentRows ?? []) as AdjustmentRow[];
  const eventsByShift = new Map<string, TimeClockEventView[]>();
  const adjustmentsByShift = new Map<string, number>();

  for (const event of events) {
    const current = eventsByShift.get(event.shift_id) ?? [];
    current.push({
      id: event.id,
      eventType: event.event_type,
      occurredAt: event.occurred_at,
    });
    eventsByShift.set(event.shift_id, current);
  }

  for (const adjustment of adjustments) {
    if (!adjustment.shift_id) continue;
    adjustmentsByShift.set(
      adjustment.shift_id,
      (adjustmentsByShift.get(adjustment.shift_id) ?? 0) +
        Number(adjustment.adjustment_minutes ?? 0) * 60
    );
  }

  const summaries = shifts.map((shift) =>
    calculateShiftSummary({
      shift,
      events: eventsByShift.get(shift.id) ?? [],
      adjustmentSeconds: adjustmentsByShift.get(shift.id) ?? 0,
      settings: effectiveSettings,
      nowIso,
    })
  );

  const currentShift = summaries.find((summary) => summary.status === "open") ?? null;
  const currentMonth = dateInTimezone(now, effectiveSettings.timezone).slice(0, 7);
  const closedMonthBalanceSeconds = summaries
    .filter(
      (summary) =>
        summary.status === "closed" && summary.workDate.startsWith(currentMonth)
    )
    .reduce((total, summary) => total + summary.balanceSeconds, 0);
  const monthBalanceSeconds =
    closedMonthBalanceSeconds +
    (currentShift?.workDate.startsWith(currentMonth)
      ? currentShift.balanceSeconds
      : 0);

  const currentLastEvent = currentShift?.events.at(-1) ?? null;
  const next = nextEventFromLast(currentLastEvent);
  let state = next.state;

  if (currentShift) {
    const openDurationHours =
      positiveSeconds(currentShift.openedAt, nowIso) / 3600;

    if (openDurationHours > effectiveSettings.maxShiftHours) {
      state = "blocked";
    }
  } else if (
    summaries[0]?.status === "closed" &&
    summaries[0]?.workDate === dateInTimezone(now, effectiveSettings.timezone)
  ) {
    state = "finished";
  }

  return {
    serverNow: nowIso,
    timezone: effectiveSettings.timezone,
    user: {
      id: context.userId,
      name: context.userName,
    },
    state,
    nextEventType: next.eventType,
    nextActionLabel: state === "blocked" ? "Jornada requer ajuste" : next.actionLabel,
    settings: effectiveSettings,
    canManageSettings: context.tenant.role === "admin",
    currentShift,
    monthBalanceSeconds,
    closedMonthBalanceSeconds,
    history: summaries.slice(0, HISTORY_LIMIT),
  };
}

function detectSource(userAgent: string | null) {
  const normalized = String(userAgent ?? "").toLowerCase();

  if (/ipad|tablet/.test(normalized)) return "tablet";
  if (/iphone|android|mobile/.test(normalized)) return "mobile";
  return "web";
}

async function createNewShift(params: {
  context: TimeClockContext;
  settings: TimeClockSettings;
  source: string;
}) {
  const now = new Date();
  const shiftId = randomUUID();
  const workDate = dateInTimezone(now, params.settings.timezone);

  const { error: shiftError } = await params.context.admin
    .from("hr_time_clock_shifts")
    .insert({
      id: shiftId,
      establishment_id: params.context.tenant.establishmentId,
      user_id: params.context.userId,
      work_date: workDate,
      status: "open",
      created_by: params.context.userId,
    });

  if (shiftError) {
    if (shiftError.code === "23505") {
      throw new Error(
        "Já existe uma jornada aberta. Atualize a página antes de tentar novamente."
      );
    }

    console.error("[time-clock] erro ao abrir jornada:", shiftError);
    throw new Error("Não foi possível iniciar a jornada.");
  }

  const { data: event, error: eventError } = await params.context.admin
    .from("hr_time_clock_events")
    .insert({
      establishment_id: params.context.tenant.establishmentId,
      user_id: params.context.userId,
      shift_id: shiftId,
      work_date: workDate,
      event_type: "clock_in",
      source: params.source,
      created_by: params.context.userId,
    })
    .select("id, occurred_at")
    .single();

  if (eventError || !event) {
    await params.context.admin
      .from("hr_time_clock_shifts")
      .delete()
      .eq("id", shiftId)
      .eq("establishment_id", params.context.tenant.establishmentId)
      .eq("user_id", params.context.userId);

    console.error("[time-clock] erro ao registrar entrada:", eventError);
    throw new Error("Não foi possível registrar a entrada.");
  }

  return {
    eventId: String(event.id),
    shiftId,
    eventType: "clock_in" as const,
    occurredAt: String(event.occurred_at),
  };
}

async function registerOnOpenShift(params: {
  context: TimeClockContext;
  settings: TimeClockSettings;
  shift: ShiftRow;
  source: string;
}) {
  const { data, error } = await params.context.admin
    .from("hr_time_clock_events")
    .select("id, shift_id, event_type, occurred_at")
    .eq("establishment_id", params.context.tenant.establishmentId)
    .eq("user_id", params.context.userId)
    .eq("shift_id", params.shift.id)
    .order("occurred_at", { ascending: true });

  if (error) {
    console.error("[time-clock] erro ao validar sequência:", error);
    throw new Error("Não foi possível validar a sequência de marcações.");
  }

  const events = (data ?? []) as EventRow[];
  const lastEvent = events.at(-1) ?? null;

  if (lastEvent?.event_type === "clock_out") {
    await params.context.admin
      .from("hr_time_clock_shifts")
      .update({
        status: "closed",
        closed_at: lastEvent.occurred_at,
      })
      .eq("id", params.shift.id)
      .eq("establishment_id", params.context.tenant.establishmentId)
      .eq("user_id", params.context.userId);

    throw new Error(
      "A jornada anterior já estava encerrada. Atualize a página e registre uma nova entrada."
    );
  }

  const now = new Date();
  const openHours = positiveSeconds(params.shift.opened_at, now.toISOString()) / 3600;

  if (openHours > params.settings.maxShiftHours) {
    throw new Error(
      `Esta jornada está aberta há mais de ${params.settings.maxShiftHours} horas. Solicite um ajuste ao administrador antes de continuar.`
    );
  }

  if (lastEvent) {
    const elapsedSinceLast = positiveSeconds(
      lastEvent.occurred_at,
      now.toISOString()
    );

    if (elapsedSinceLast < MIN_EVENT_INTERVAL_SECONDS) {
      throw new Error("A marcação anterior acabou de ser registrada. Aguarde alguns segundos.");
    }
  }

  const next = nextEventFromLast(
    lastEvent
      ? {
          id: lastEvent.id,
          eventType: lastEvent.event_type,
          occurredAt: lastEvent.occurred_at,
        }
      : null
  );

  if (next.eventType === "clock_in") {
    throw new Error("A jornada aberta não possui uma entrada válida.");
  }

  const { data: inserted, error: insertError } = await params.context.admin
    .from("hr_time_clock_events")
    .insert({
      establishment_id: params.context.tenant.establishmentId,
      user_id: params.context.userId,
      shift_id: params.shift.id,
      work_date: params.shift.work_date,
      event_type: next.eventType,
      source: params.source,
      created_by: params.context.userId,
    })
    .select("id, occurred_at")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      throw new Error("Esta marcação já foi registrada. Atualize a página.");
    }

    console.error("[time-clock] erro ao registrar marcação:", insertError);
    throw new Error("Não foi possível registrar o ponto.");
  }

  if (next.eventType === "clock_out") {
    const { error: closeError } = await params.context.admin
      .from("hr_time_clock_shifts")
      .update({
        status: "closed",
        closed_at: inserted.occurred_at,
      })
      .eq("id", params.shift.id)
      .eq("establishment_id", params.context.tenant.establishmentId)
      .eq("user_id", params.context.userId);

    if (closeError) {
      console.error(
        "[time-clock] saída registrada, mas o fechamento da jornada falhou:",
        closeError
      );
    }
  }

  return {
    eventId: String(inserted.id),
    shiftId: params.shift.id,
    eventType: next.eventType,
    occurredAt: String(inserted.occurred_at),
  };
}

export async function getTimeClockDashboardData() {
  const context = await getTimeClockContext();
  return buildDashboardData(context);
}

export async function registerNextTimeClockEvent() {
  const context = await getTimeClockContext();
  const settings = await loadTimeClockSettings(context);

  if (!settings.enabled) {
    throw new Error("O Ponto Digital está desativado para esta empresa.");
  }

  const requestHeaders = await headers();
  const source = detectSource(requestHeaders.get("user-agent"));

  const { data: openShift, error: openShiftError } = await context.admin
    .from("hr_time_clock_shifts")
    .select("id, establishment_id, user_id, work_date, status, opened_at, closed_at")
    .eq("establishment_id", context.tenant.establishmentId)
    .eq("user_id", context.userId)
    .eq("status", "open")
    .maybeSingle();

  if (openShiftError) {
    console.error("[time-clock] erro ao consultar jornada aberta:", openShiftError);
    throw new Error("Não foi possível consultar a jornada atual.");
  }

  const registered = openShift
    ? await registerOnOpenShift({
        context,
        settings,
        shift: openShift as ShiftRow,
        source,
      })
    : await createNewShift({ context, settings, source });

  await writeTenantAuditLog({
    supabaseAdmin: context.admin,
    establishmentId: context.tenant.establishmentId,
    actorUserId: context.userId,
    targetUserId: context.userId,
    action: `hr_time_clock_${registered.eventType}`,
    entityType: "hr_time_clock_event",
    entityId: registered.eventId,
    details: {
      shift_id: registered.shiftId,
      event_type: registered.eventType,
      occurred_at: registered.occurredAt,
      source,
    },
  });

  return {
    data: await buildDashboardData(context, settings),
    eventType: registered.eventType,
  };
}

export async function saveTimeClockSettings(input: TimeClockSettingsInput) {
  const context = await getTimeClockContext();

  if (context.tenant.role !== "admin") {
    throw new Error("Apenas administradores podem alterar a jornada padrão.");
  }

  const settings: TimeClockSettings = {
    enabled: input.enabled === true,
    dailyMinutes: safeInteger(input.dailyMinutes, -1),
    breakMinutes: safeInteger(input.breakMinutes, -1),
    toleranceMinutes: safeInteger(input.toleranceMinutes, -1),
    timezone: String(input.timezone ?? "").trim(),
    allowOvernight: input.allowOvernight !== false,
    maxShiftHours: safeInteger(input.maxShiftHours, -1),
  };

  if (settings.dailyMinutes < 1 || settings.dailyMinutes > 1440) {
    throw new Error("A jornada diária deve estar entre 1 e 1.440 minutos.");
  }

  if (settings.breakMinutes < 0 || settings.breakMinutes > 480) {
    throw new Error("O intervalo deve estar entre 0 e 480 minutos.");
  }

  if (settings.toleranceMinutes < 0 || settings.toleranceMinutes > 120) {
    throw new Error("A tolerância deve estar entre 0 e 120 minutos.");
  }

  if (settings.maxShiftHours < 1 || settings.maxShiftHours > 36) {
    throw new Error("A duração máxima deve estar entre 1 e 36 horas.");
  }

  if (!validateTimezone(settings.timezone)) {
    throw new Error("Fuso horário inválido.");
  }

  const { error } = await context.admin
    .from("hr_time_clock_settings")
    .upsert(
      {
        establishment_id: context.tenant.establishmentId,
        enabled: settings.enabled,
        daily_minutes: settings.dailyMinutes,
        break_minutes: settings.breakMinutes,
        tolerance_minutes: settings.toleranceMinutes,
        timezone: settings.timezone,
        allow_overnight: settings.allowOvernight,
        max_shift_hours: settings.maxShiftHours,
        created_by: context.userId,
        updated_by: context.userId,
      },
      { onConflict: "establishment_id" }
    );

  if (error) {
    console.error("[time-clock] erro ao salvar configurações:", error);
    throw new Error("Não foi possível salvar as configurações do ponto.");
  }

  await writeTenantAuditLog({
    supabaseAdmin: context.admin,
    establishmentId: context.tenant.establishmentId,
    actorUserId: context.userId,
    action: "hr_time_clock_settings_updated",
    entityType: "hr_time_clock_settings",
    entityId: context.tenant.establishmentId,
    details: settings,
  });

  return buildDashboardData(context, settings);
}
