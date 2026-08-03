import "server-only";

import { randomUUID } from "node:crypto";

import { sendAlertEmail } from "@/lib/alerts/email";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AppJobRow = {
  id: string;
  establishment_id: string | null;
  queue_name: string;
  job_type: string;
  payload: Record<string, unknown>;
  dedupe_key: string | null;
  attempts: number;
  max_attempts: number;
  locked_until?: string | null;
  lock_token?: string | null;
};

type AppJobCleanupResult = {
  recoveredStaleJobs: number;
  deletedExpiredIdempotencyKeys: number;
  deletedCompletedJobs: number;
  deadJobs: number;
};

export type EnqueueAppJobInput = {
  establishmentId?: string | null;
  queueName?: string;
  jobType: string;
  payload: Record<string, unknown>;
  dedupeKey?: string | null;
  priority?: number;
  availableAt?: string | null;
  maxAttempts?: number;
};

function normalizeText(value: unknown, fallback = "") {
  const trimmed = String(value ?? "").trim();
  return trimmed || fallback;
}

function countFromMutation(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

let appJobQueueLeasesSupported: boolean | null = null;

async function supportsAppJobQueueLeases() {
  if (appJobQueueLeasesSupported !== null) return appJobQueueLeasesSupported;

  const { data, error } = await getSupabaseAdminClient()
    .from("app_job_queue")
    .select("locked_until, lock_token, last_heartbeat_at")
    .limit(0);

  appJobQueueLeasesSupported = !error && Array.isArray(data);
  return appJobQueueLeasesSupported;
}

export async function enqueueAppJob(input: EnqueueAppJobInput) {
  const supabaseAdmin = getSupabaseAdminClient();
  const queueName = normalizeText(input.queueName, "default");
  const jobType = normalizeText(input.jobType);

  if (!jobType) {
    throw new Error("Tipo do job não informado.");
  }

  const payload = {
    establishment_id: input.establishmentId ?? null,
    queue_name: queueName,
    job_type: jobType,
    payload: input.payload ?? {},
    dedupe_key: input.dedupeKey?.trim() || null,
    priority: input.priority ?? 100,
    available_at: input.availableAt ?? new Date().toISOString(),
    max_attempts: input.maxAttempts ?? 5,
  };

  const { data, error } = await supabaseAdmin
    .from("app_job_queue")
    .insert(payload)
    .select("id, status")
    .single();

  if (!error) {
    return { id: String((data as any).id), deduped: false };
  }

  if ((error as any)?.code !== "23505") {
    console.error("[app-jobs] enqueue error:", error);
    throw new Error("Não foi possível enfileirar a tarefa.");
  }

  let query = supabaseAdmin
    .from("app_job_queue")
    .select("id, status")
    .eq("queue_name", queueName)
    .eq("job_type", jobType)
    .eq("dedupe_key", payload.dedupe_key)
    .limit(1);

  const { data: existing, error: existingError } = await query.maybeSingle();

  if (existingError || !existing) {
    console.error("[app-jobs] dedupe lookup error:", existingError);
    throw new Error("Tarefa já enfileirada, mas não foi possível recuperá-la.");
  }

  return { id: String((existing as any).id), deduped: true };
}

async function completeJob(job: AppJobRow) {
  const updatePayload: Record<string, unknown> = {
    status: "completed",
    processed_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
    updated_at: new Date().toISOString(),
  };

  if (job.lock_token) {
    updatePayload.locked_until = null;
    updatePayload.lock_token = null;
    updatePayload.last_heartbeat_at = null;
  }

  let query = getSupabaseAdminClient()
    .from("app_job_queue")
    .update(updatePayload)
    .eq("id", job.id);

  if (job.lock_token) {
    query = query.eq("lock_token", job.lock_token);
  }

  const { data, error } = await query.select("id").maybeSingle();

  if (error || !data) {
    console.error("[app-jobs] complete error:", { jobId: job.id, error });
    throw new Error("Não foi possível marcar a tarefa como concluída.");
  }
}

async function failJob(job: AppJobRow, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const shouldRetry = job.attempts < job.max_attempts;
  const delayMinutes = Math.min(60, Math.max(1, job.attempts * 2));

  const updatePayload: Record<string, unknown> = {
    status: shouldRetry ? "pending" : "dead",
    available_at: shouldRetry
      ? new Date(Date.now() + delayMinutes * 60_000).toISOString()
      : new Date().toISOString(),
    locked_at: null,
    locked_by: null,
    last_error: message.slice(0, 1000),
    updated_at: new Date().toISOString(),
  };

  if (job.lock_token) {
    updatePayload.locked_until = null;
    updatePayload.lock_token = null;
    updatePayload.last_heartbeat_at = null;
  }

  let query = getSupabaseAdminClient()
    .from("app_job_queue")
    .update(updatePayload)
    .eq("id", job.id);

  if (job.lock_token) {
    query = query.eq("lock_token", job.lock_token);
  }

  const { data, error: updateError } = await query.select("id").maybeSingle();

  if (updateError || !data) {
    console.error("[app-jobs] fail mark error:", { jobId: job.id, updateError });
    throw new Error("Não foi possível registrar a falha da tarefa.");
  }
}

export async function renewAppJobLease(params: {
  job: Pick<AppJobRow, "id" | "lock_token">;
  leaseMs?: number;
}) {
  if (!params.job.lock_token) return { renewed: false };

  const leaseMs = Math.min(
    Math.max(params.leaseMs ?? 20 * 60_000, 60_000),
    24 * 60 * 60_000
  );
  const nowIso = new Date().toISOString();
  const lockedUntil = new Date(Date.now() + leaseMs).toISOString();

  const { data, error } = await getSupabaseAdminClient()
    .from("app_job_queue")
    .update({
      locked_until: lockedUntil,
      last_heartbeat_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", params.job.id)
    .eq("lock_token", params.job.lock_token)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[app-jobs] lease renewal error:", {
      jobId: params.job.id,
      error,
    });
  }

  return { renewed: Boolean(data) };
}

async function handleAlertEmailJob(job: AppJobRow) {
  const payload = job.payload ?? {};
  const to = normalizeText(payload.to);
  const subject = normalizeText(payload.subject);
  const html = normalizeText(payload.html);

  if (!to || !subject || !html) {
    throw new Error("Payload inválido para envio de e-mail de alerta.");
  }

  const result = await sendAlertEmail({ to, subject, html });

  if (!result.ok) {
    throw new Error(result.error || "Falha ao enviar e-mail de alerta.");
  }
}

async function processJob(job: AppJobRow) {
  if (job.job_type === "alert.email") {
    await handleAlertEmailJob(job);
    return;
  }

  throw new Error(`Tipo de job não suportado: ${job.job_type}`);
}

export async function cleanupAppRuntimeState(params?: {
  staleProcessingMinutes?: number;
  completedJobRetentionDays?: number;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const staleProcessingMinutes = Math.min(
    Math.max(params?.staleProcessingMinutes ?? 20, 5),
    24 * 60
  );
  const completedJobRetentionDays = Math.min(
    Math.max(params?.completedJobRetentionDays ?? 7, 1),
    90
  );
  const staleProcessingBefore = new Date(
    Date.now() - staleProcessingMinutes * 60_000
  ).toISOString();
  const completedJobCutoff = new Date(
    Date.now() - completedJobRetentionDays * 24 * 60 * 60_000
  ).toISOString();
  const nowIso = new Date().toISOString();
  const leasesSupported = await supportsAppJobQueueLeases();

  let recoveredQuery = supabaseAdmin
    .from("app_job_queue")
    .update(
      leasesSupported
        ? {
            status: "pending",
            locked_at: null,
            locked_until: null,
            lock_token: null,
            last_heartbeat_at: null,
            locked_by: null,
            last_error: "Job recuperado automaticamente após lock expirado.",
            updated_at: nowIso,
          }
        : {
            status: "pending",
            locked_at: null,
            locked_by: null,
            last_error: "Job recuperado automaticamente após lock expirado.",
            updated_at: nowIso,
          },
      { count: "exact" }
    )
    .eq("status", "processing");

  recoveredQuery = leasesSupported
    ? recoveredQuery.or(
        `locked_until.lt.${nowIso},and(locked_until.is.null,locked_at.lt.${staleProcessingBefore})`
      )
    : recoveredQuery.lt("locked_at", staleProcessingBefore);

  const { count: recoveredCount, error: recoveredError } = await recoveredQuery;

  if (recoveredError) {
    console.error("[app-jobs] stale job recovery error:", recoveredError);
  }

  const { count: idempotencyCount, error: idempotencyError } =
    await supabaseAdmin
      .from("api_idempotency_keys")
      .delete({ count: "exact" })
      .lt("expires_at", nowIso);

  if (idempotencyError) {
    console.error("[app-jobs] idempotency cleanup error:", idempotencyError);
  }

  const { count: completedJobCount, error: completedJobError } =
    await supabaseAdmin
      .from("app_job_queue")
      .delete({ count: "exact" })
      .eq("status", "completed")
      .lt("processed_at", completedJobCutoff);

  if (completedJobError) {
    console.error("[app-jobs] completed job cleanup error:", completedJobError);
  }

  const { count: deadJobCount, error: deadJobError } = await supabaseAdmin
    .from("app_job_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "dead");

  if (deadJobError) {
    console.error("[app-jobs] dead job count error:", deadJobError);
  }

  return {
    recoveredStaleJobs: countFromMutation(recoveredCount),
    deletedExpiredIdempotencyKeys: countFromMutation(idempotencyCount),
    deletedCompletedJobs: countFromMutation(completedJobCount),
    deadJobs: countFromMutation(deadJobCount),
  } satisfies AppJobCleanupResult;
}

export async function processAppJobs(params?: {
  limit?: number;
  workerId?: string;
}) {
  const workerId = params?.workerId?.trim() || `worker-${randomUUID()}`;
  const limit = Math.min(Math.max(params?.limit ?? 10, 1), 50);
  const supabaseAdmin = getSupabaseAdminClient();
  const leasesSupported = await supportsAppJobQueueLeases();

  const { data, error } = await supabaseAdmin.rpc(
    "claim_app_jobs",
    leasesSupported
      ? {
          p_worker_id: workerId,
          p_limit: limit,
          p_lease_seconds: 20 * 60,
        }
      : {
          p_worker_id: workerId,
          p_limit: limit,
        }
  );

  if (error) {
    console.error("[app-jobs] claim error:", error);
    throw new Error("Não foi possível buscar tarefas da fila.");
  }

  const jobs = (data ?? []) as AppJobRow[];
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      if (leasesSupported) {
        await renewAppJobLease({ job });
      }
      await processJob(job);
      await completeJob(job);
      completed += 1;
    } catch (jobError) {
      console.error("[app-jobs] job failed:", {
        id: job.id,
        type: job.job_type,
        error: jobError,
      });
      await failJob(job, jobError);
      failed += 1;
    }
  }

  const cleanup = await cleanupAppRuntimeState();

  return {
    claimed: jobs.length,
    completed,
    failed,
    cleanup,
  };
}

export function shouldQueueAlertEmails() {
  return process.env.GESTIFY_ALERT_EMAIL_QUEUE_ENABLED === "true";
}
