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

async function completeJob(jobId: string) {
  await getSupabaseAdminClient()
    .from("app_job_queue")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function failJob(job: AppJobRow, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const shouldRetry = job.attempts < job.max_attempts;
  const delayMinutes = Math.min(60, Math.max(1, job.attempts * 2));

  await getSupabaseAdminClient()
    .from("app_job_queue")
    .update({
      status: shouldRetry ? "pending" : "dead",
      available_at: shouldRetry
        ? new Date(Date.now() + delayMinutes * 60_000).toISOString()
        : new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error: message.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
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

export async function processAppJobs(params?: {
  limit?: number;
  workerId?: string;
}) {
  const workerId = params?.workerId?.trim() || `worker-${randomUUID()}`;
  const limit = Math.min(Math.max(params?.limit ?? 10, 1), 50);
  const supabaseAdmin = getSupabaseAdminClient();

  const { data, error } = await supabaseAdmin.rpc("claim_app_jobs", {
    p_worker_id: workerId,
    p_limit: limit,
  });

  if (error) {
    console.error("[app-jobs] claim error:", error);
    throw new Error("Não foi possível buscar tarefas da fila.");
  }

  const jobs = (data ?? []) as AppJobRow[];
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await processJob(job);
      await completeJob(job.id);
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

  return {
    claimed: jobs.length,
    completed,
    failed,
  };
}

export function shouldQueueAlertEmails() {
  return process.env.GESTIFY_ALERT_EMAIL_QUEUE_ENABLED === "true";
}
