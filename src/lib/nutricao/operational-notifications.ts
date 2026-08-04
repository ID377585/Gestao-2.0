import "server-only";

type NotificationPriority = "low" | "normal" | "high" | "critical";

type SupabaseLike = {
  from: (table: string) => any;
};

type SweepOptions = {
  actorUserId?: string | null;
  source?: "manual" | "cron";
  now?: Date;
};

export type NutritionNotificationSweepResult = {
  establishmentId: string;
  scanned: number;
  generatedOrRefreshed: number;
  errors: Array<{ scope: string; message: string; code?: string | null }>;
};

function isSchemaCompatibilityError(error: unknown) {
  const candidate = error as { code?: string | null; message?: string | null } | null;
  const code = String(candidate?.code ?? "");
  const message = String(candidate?.message ?? "").toLowerCase();

  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST200" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("does not exist")
  );
}

function serializeSweepError(error: unknown) {
  const candidate = error as { code?: string | null; message?: string | null } | null;
  return {
    code: candidate?.code ?? null,
    message: String(candidate?.message ?? error ?? "Erro desconhecido"),
  };
}

function appNotificationPriority(priority: NotificationPriority) {
  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  if (priority === "low") return "info";
  return "normal";
}

function appNotificationType(priority: NotificationPriority) {
  if (priority === "critical") return "error";
  if (priority === "high") return "warning";
  return "info";
}

async function upsertNutritionNotification(
  supabase: SupabaseLike,
  params: {
    establishmentId: string;
    actorUserId?: string | null;
    type: string;
    priority: NotificationPriority;
    title: string;
    message: string;
    resourceType?: string | null;
    resourceId?: string | null;
    href?: string | null;
    dueAt?: string | null;
    dedupeKey: string;
    payload?: Record<string, unknown>;
  }
) {
  const payload = {
    ...(params.payload ?? {}),
    establishment_id: params.establishmentId,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    href: params.href ?? null,
  };

  const nutritionResult = await supabase
    .from("nutrition_notifications")
    .upsert(
      {
        establishment_id: params.establishmentId,
        target_user_id: null,
        notification_type: params.type,
        priority: params.priority,
        title: params.title,
        message: params.message,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        due_at: params.dueAt ?? null,
        dedupe_key: params.dedupeKey,
        payload,
        created_by: params.actorUserId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "establishment_id,dedupe_key" }
    );

  if (nutritionResult.error && !isSchemaCompatibilityError(nutritionResult.error)) {
    throw nutritionResult.error;
  }

  const appPayload = {
    user_id: null,
    userId: "",
    title: params.title,
    message: params.message,
    type: appNotificationType(params.priority),
    priority: appNotificationPriority(params.priority),
    action_url: params.href ?? null,
    establishment_id: params.establishmentId,
    payload,
    dedupe_key: params.dedupeKey,
  };

  let appResult = await supabase
    .from("notifications")
    .upsert(appPayload, { onConflict: "dedupe_key" });

  if (appResult.error && isSchemaCompatibilityError(appResult.error)) {
    const { establishment_id: _ignored, ...fallbackPayload } = appPayload;
    appResult = await supabase
      .from("notifications")
      .upsert(fallbackPayload, { onConflict: "dedupe_key" });
  }

  if (appResult.error && !isSchemaCompatibilityError(appResult.error)) {
    throw appResult.error;
  }
}

async function handleRows(
  result: { data: any[] | null; error: unknown },
  scope: string,
  output: NutritionNotificationSweepResult,
  handler: (row: any) => Promise<void>
) {
  if (result.error) {
    if (!isSchemaCompatibilityError(result.error)) {
      output.errors.push({ scope, ...serializeSweepError(result.error) });
    }
    return;
  }

  for (const row of result.data ?? []) {
    output.scanned += 1;
    try {
      await handler(row);
      output.generatedOrRefreshed += 1;
    } catch (error) {
      output.errors.push({ scope, ...serializeSweepError(error) });
    }
  }
}

export async function sweepNutritionOperationalNotifications(
  supabase: SupabaseLike,
  establishmentId: string,
  options: SweepOptions = {}
): Promise<NutritionNotificationSweepResult> {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const next24hIso = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60_000)
    .toISOString()
    .slice(0, 10);
  const output: NutritionNotificationSweepResult = {
    establishmentId,
    scanned: 0,
    generatedOrRefreshed: 0,
    errors: [],
  };
  const source = options.source ?? "manual";

  const [
    overdueInspections,
    upcomingInspections,
    overdueNonconformities,
    dueSoonNonconformities,
    expiringDocuments,
    upcomingTrainingSessions,
    overdueReinspections,
    upcomingReinspections,
    failedReportDeliveries,
  ] = await Promise.all([
    supabase
      .from("nutrition_inspections")
      .select("id,title,scheduled_for")
      .eq("establishment_id", establishmentId)
      .in("status", ["scheduled", "paused", "in_progress"])
      .lt("scheduled_for", nowIso)
      .limit(50),
    supabase
      .from("nutrition_inspections")
      .select("id,title,scheduled_for")
      .eq("establishment_id", establishmentId)
      .eq("status", "scheduled")
      .gte("scheduled_for", nowIso)
      .lte("scheduled_for", next24hIso)
      .limit(50),
    supabase
      .from("nutrition_nonconformities")
      .select("id,title,severity,due_at")
      .eq("establishment_id", establishmentId)
      .not("status", "in", "(closed,canceled)")
      .lt("due_at", nowIso)
      .limit(50),
    supabase
      .from("nutrition_nonconformities")
      .select("id,title,severity,due_at")
      .eq("establishment_id", establishmentId)
      .not("status", "in", "(closed,canceled)")
      .gte("due_at", nowIso)
      .lte("due_at", next24hIso)
      .limit(50),
    supabase
      .from("nutrition_documents")
      .select("id,title,valid_until")
      .eq("establishment_id", establishmentId)
      .eq("status", "active")
      .lte("valid_until", next30Days)
      .limit(50),
    supabase
      .from("nutrition_training_sessions")
      .select("id,scheduled_for,nutrition_trainings(title)")
      .eq("establishment_id", establishmentId)
      .eq("status", "scheduled")
      .gte("scheduled_for", nowIso)
      .lte("scheduled_for", next24hIso)
      .limit(50),
    supabase
      .from("nutrition_reinspections")
      .select("id,nonconformity_id,scheduled_for,nutrition_nonconformities(title,severity)")
      .eq("establishment_id", establishmentId)
      .in("status", ["scheduled", "in_progress"])
      .lt("scheduled_for", nowIso)
      .limit(50),
    supabase
      .from("nutrition_reinspections")
      .select("id,nonconformity_id,scheduled_for,nutrition_nonconformities(title,severity)")
      .eq("establishment_id", establishmentId)
      .eq("status", "scheduled")
      .gte("scheduled_for", nowIso)
      .lte("scheduled_for", next24hIso)
      .limit(50),
    supabase
      .from("nutrition_report_deliveries")
      .select("id,report_id,recipient_name,recipient_address_masked,error_message,nutrition_reports(title)")
      .eq("establishment_id", establishmentId)
      .eq("status", "failed")
      .gte("updated_at", new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString())
      .limit(50),
  ]);

  await handleRows(overdueInspections, "overdue_inspections", output, async (row) => {
    await upsertNutritionNotification(supabase, {
      establishmentId,
      actorUserId: options.actorUserId,
      type: "nutrition_inspection_overdue",
      priority: "high",
      title: "Vistoria atrasada",
      message: String(row.title ?? "Vistoria agendada"),
      resourceType: "nutrition_inspection",
      resourceId: String(row.id),
      href: `/nutricao/vistorias/${String(row.id)}`,
      dueAt: row.scheduled_for ? String(row.scheduled_for) : null,
      dedupeKey: `nutrition-inspection-overdue:${establishmentId}:${String(row.id)}`,
      payload: { source },
    });
  });

  await handleRows(upcomingInspections, "upcoming_inspections", output, async (row) => {
    await upsertNutritionNotification(supabase, {
      establishmentId,
      actorUserId: options.actorUserId,
      type: "nutrition_inspection_upcoming",
      priority: "normal",
      title: "Vistoria próxima",
      message: String(row.title ?? "Vistoria agendada"),
      resourceType: "nutrition_inspection",
      resourceId: String(row.id),
      href: `/nutricao/vistorias/${String(row.id)}`,
      dueAt: row.scheduled_for ? String(row.scheduled_for) : null,
      dedupeKey: `nutrition-inspection-upcoming:${establishmentId}:${String(row.id)}`,
      payload: { source },
    });
  });

  await handleRows(overdueNonconformities, "overdue_nonconformities", output, async (row) => {
    await upsertNutritionNotification(supabase, {
      establishmentId,
      actorUserId: options.actorUserId,
      type: "nutrition_nonconformity_overdue",
      priority: String(row.severity ?? "") === "critical" ? "critical" : "high",
      title: "Não conformidade vencida",
      message: String(row.title ?? "Ocorrência em aberto"),
      resourceType: "nutrition_nonconformity",
      resourceId: String(row.id),
      href: `/nutricao/nao-conformidades/${String(row.id)}`,
      dueAt: row.due_at ? String(row.due_at) : null,
      dedupeKey: `nutrition-nc-overdue:${establishmentId}:${String(row.id)}`,
      payload: { source, severity: row.severity ?? null },
    });
  });

  await handleRows(dueSoonNonconformities, "due_soon_nonconformities", output, async (row) => {
    await upsertNutritionNotification(supabase, {
      establishmentId,
      actorUserId: options.actorUserId,
      type: "nutrition_nonconformity_due_soon",
      priority: String(row.severity ?? "") === "critical" ? "critical" : "normal",
      title: "Prazo de não conformidade próximo",
      message: String(row.title ?? "Ocorrência em aberto"),
      resourceType: "nutrition_nonconformity",
      resourceId: String(row.id),
      href: `/nutricao/nao-conformidades/${String(row.id)}`,
      dueAt: row.due_at ? String(row.due_at) : null,
      dedupeKey: `nutrition-nc-due-soon:${establishmentId}:${String(row.id)}`,
      payload: { source, severity: row.severity ?? null },
    });
  });

  await handleRows(expiringDocuments, "expiring_documents", output, async (row) => {
    await upsertNutritionNotification(supabase, {
      establishmentId,
      actorUserId: options.actorUserId,
      type: "nutrition_document_expiring",
      priority: "normal",
      title: "Documento sanitário próximo do vencimento",
      message: String(row.title ?? "Documento sanitário"),
      resourceType: "nutrition_document",
      resourceId: String(row.id),
      href: "/nutricao/documentos",
      dueAt: row.valid_until ? `${String(row.valid_until)}T12:00:00.000Z` : null,
      dedupeKey: `nutrition-document-expiring:${establishmentId}:${String(row.id)}`,
      payload: { source },
    });
  });

  await handleRows(upcomingTrainingSessions, "upcoming_training_sessions", output, async (row) => {
    const training = Array.isArray(row.nutrition_trainings)
      ? row.nutrition_trainings[0]
      : row.nutrition_trainings;
    await upsertNutritionNotification(supabase, {
      establishmentId,
      actorUserId: options.actorUserId,
      type: "nutrition_training_upcoming",
      priority: "normal",
      title: "Treinamento próximo",
      message: String(training?.title ?? "Treinamento agendado"),
      resourceType: "nutrition_training_session",
      resourceId: String(row.id),
      href: "/nutricao/treinamentos",
      dueAt: row.scheduled_for ? String(row.scheduled_for) : null,
      dedupeKey: `nutrition-training-upcoming:${establishmentId}:${String(row.id)}`,
      payload: { source },
    });
  });

  const notifyReinspection = async (row: any, overdue: boolean) => {
    const nonconformity = Array.isArray(row.nutrition_nonconformities)
      ? row.nutrition_nonconformities[0]
      : row.nutrition_nonconformities;
    await upsertNutritionNotification(supabase, {
      establishmentId,
      actorUserId: options.actorUserId,
      type: overdue ? "nutrition_reinspection_overdue" : "nutrition_reinspection_upcoming",
      priority:
        String(nonconformity?.severity ?? "") === "critical"
          ? "critical"
          : overdue
            ? "high"
            : "normal",
      title: overdue ? "Reinspeção atrasada" : "Reinspeção próxima",
      message: String(nonconformity?.title ?? "Reinspeção agendada"),
      resourceType: "nutrition_nonconformity",
      resourceId: row.nonconformity_id ? String(row.nonconformity_id) : null,
      href: row.nonconformity_id
        ? `/nutricao/nao-conformidades/${String(row.nonconformity_id)}`
        : "/nutricao/nao-conformidades",
      dueAt: row.scheduled_for ? String(row.scheduled_for) : null,
      dedupeKey: `nutrition-reinspection-${overdue ? "overdue" : "upcoming"}:${establishmentId}:${String(row.id)}`,
      payload: { source, reinspection_id: String(row.id) },
    });
  };

  await handleRows(overdueReinspections, "overdue_reinspections", output, async (row) => {
    await notifyReinspection(row, true);
  });

  await handleRows(upcomingReinspections, "upcoming_reinspections", output, async (row) => {
    await notifyReinspection(row, false);
  });

  await handleRows(failedReportDeliveries, "failed_report_deliveries", output, async (row) => {
    const report = Array.isArray(row.nutrition_reports)
      ? row.nutrition_reports[0]
      : row.nutrition_reports;
    await upsertNutritionNotification(supabase, {
      establishmentId,
      actorUserId: options.actorUserId,
      type: "nutrition_report_delivery_failed",
      priority: "high",
      title: "Falha no envio de relatório",
      message: `${String(report?.title ?? "Relatório")} não foi enviado para ${String(
        row.recipient_name ?? row.recipient_address_masked ?? "destinatário"
      )}.`,
      resourceType: "nutrition_report",
      resourceId: row.report_id ? String(row.report_id) : null,
      href: "/nutricao/relatorios",
      dedupeKey: `nutrition-report-delivery-failed:${establishmentId}:${String(row.id)}`,
      payload: {
        source,
        delivery_id: String(row.id),
        error_message: row.error_message ?? null,
      },
    });
  });

  return output;
}
