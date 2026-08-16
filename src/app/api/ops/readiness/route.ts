import { NextRequest, NextResponse } from "next/server";

import {
  authorizeCronSecret,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-secret";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReadinessCheck = {
  key: string;
  status: "ok" | "warning" | "critical";
  message: string;
  missing?: string[];
  present?: string[];
};

const MODERN_SUPABASE_ADMIN_KEYS = ["SUPABASE_SECRET_KEY"];

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function hasModernSupabaseAdminKey() {
  return MODERN_SUPABASE_ADMIN_KEYS.some(envPresent);
}

function envGroupCheck(params: {
  key: string;
  label: string;
  requiredAny?: string[];
  requiredAll?: string[];
  optional?: string[];
  severity?: "warning" | "critical";
}): ReadinessCheck {
  const requiredAny = params.requiredAny ?? [];
  const requiredAll = params.requiredAll ?? [];
  const requiredNames = [...requiredAny, ...requiredAll];
  const missingAll = requiredAll.filter((name) => !envPresent(name));
  const anySatisfied =
    requiredAny.length === 0 || requiredAny.some((name) => envPresent(name));
  const missingAny = anySatisfied ? [] : requiredAny;
  const missing = [...missingAll, ...missingAny];
  const present = [...requiredNames, ...(params.optional ?? [])].filter(envPresent);
  const status = missing.length > 0 ? (params.severity ?? "critical") : "ok";

  return {
    key: params.key,
    status,
    message:
      status === "ok"
        ? `${params.label}: configurado.`
        : `${params.label}: configuração incompleta.`,
    missing,
    present,
  };
}

async function databaseReadiness(): Promise<ReadinessCheck[]> {
  if (!hasModernSupabaseAdminKey()) {
    return [
      {
        key: "database.admin-client",
        status: "critical",
        message:
          "Cliente administrativo Supabase indisponível: configure uma SUPABASE_SECRET_KEY moderna.",
        missing: MODERN_SUPABASE_ADMIN_KEYS,
      },
    ];
  }

  const supabase = getSupabaseAdminClient();
  const checks: ReadinessCheck[] = [];

  const requiredTables = [
    "memberships",
    "establishment_memberships",
    "notifications",
    "app_job_queue",
    "api_idempotency_keys",
    "nutrition_notifications",
    "nutrition_inspections",
    "nutrition_nonconformities",
    "nutrition_report_deliveries",
  ];

  for (const table of requiredTables) {
    const { error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    checks.push({
      key: `database.table.${table}`,
      status: error ? "critical" : "ok",
      message: error
        ? `Tabela ${table}: falha de acesso ou schema incompatível.`
        : `Tabela ${table}: acessível.`,
      missing: error ? [table] : undefined,
    });
  }

  const { count: pendingJobs, error: jobsError } = await supabase
    .from("app_job_queue")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "processing"]);

  if (!jobsError) {
    checks.push({
      key: "queue.pending",
      status: (pendingJobs ?? 0) > 500 ? "warning" : "ok",
      message: `Fila operacional: ${pendingJobs ?? 0} jobs pendentes/processando.`,
    });
  }

  const { count: deadJobs, error: deadJobsError } = await supabase
    .from("app_job_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "dead");

  if (!deadJobsError) {
    checks.push({
      key: "queue.dead-letter",
      status: (deadJobs ?? 0) > 0 ? "warning" : "ok",
      message: `Dead-letter operacional: ${deadJobs ?? 0} jobs mortos.`,
    });
  }

  return checks;
}

function runtimeReadiness(): ReadinessCheck[] {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const checks: ReadinessCheck[] = [
    envGroupCheck({
      key: "supabase.public",
      label: "Supabase público",
      requiredAll: [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ],
    }),
    envGroupCheck({
      key: "supabase.admin-secret",
      label: "Supabase secret key moderna",
      requiredAny: MODERN_SUPABASE_ADMIN_KEYS,
    }),
    envGroupCheck({
      key: "cron.secrets",
      label: "Segredos de cron/worker",
      requiredAny: ["CRON_SECRET", "JOB_WORKER_SECRET", "NUTRITION_CRON_SECRET"],
    }),
    envGroupCheck({
      key: "fiscal.secrets",
      label: "Segredos fiscais",
      requiredAny: ["FISCAL_SYNC_SECRET", "CRON_SECRET"],
      severity: "warning",
    }),
    envGroupCheck({
      key: "email.resend",
      label: "E-mail transacional",
      requiredAll: ["RESEND_API_KEY"],
      requiredAny: ["RESEND_FROM_EMAIL", "ALERTS_FROM_EMAIL"],
      severity: "warning",
    }),
    envGroupCheck({
      key: "app.urls",
      label: "URLs públicas",
      requiredAny: [
        "NEXT_PUBLIC_APP_URL",
        "APP_URL",
        "VERCEL_PROJECT_PRODUCTION_URL",
      ],
      severity: "warning",
    }),
  ];

  checks.push({
    key: "runtime.node",
    status: nodeMajor === 22 ? "ok" : "warning",
    message:
      nodeMajor === 22
        ? `Node.js ${process.versions.node}: alinhado ao runtime recomendado.`
        : `Node.js ${process.versions.node}: revisar alinhamento com Node 22.x.`,
  });

  return checks;
}

function summarize(checks: ReadinessCheck[]) {
  const critical = checks.filter((check) => check.status === "critical").length;
  const warnings = checks.filter((check) => check.status === "warning").length;

  return {
    ok: critical === 0,
    status: critical > 0 ? "critical" : warnings > 0 ? "warning" : "ok",
    critical,
    warnings,
    passed: checks.length - critical - warnings,
    total: checks.length,
  };
}

async function handleReadiness(request: NextRequest) {
  const limited = rateLimit(request, {
    key: "ops-readiness",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const authorization = authorizeCronSecret(request, {
    routeLabel: "ops/readiness",
    envNames: ["OPERATIONAL_READINESS_SECRET", "JOB_WORKER_SECRET", "CRON_SECRET"],
    acceptedHeaderNames: [
      "x-operational-readiness-secret",
      "x-job-worker-secret",
      "x-cron-secret",
    ],
  });
  if (!authorization.authorized) return cronUnauthorizedResponse(authorization);

  const checks = [...runtimeReadiness(), ...(await databaseReadiness())];
  const summary = summarize(checks);

  return NextResponse.json(
    {
      ok: summary.ok,
      generatedAt: new Date().toISOString(),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      deployment: {
        gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        gitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        url: process.env.VERCEL_URL ?? null,
      },
      summary,
      checks,
    },
    {
      status: summary.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}

export async function GET(request: NextRequest) {
  return handleReadiness(request);
}

export async function POST(request: NextRequest) {
  return handleReadiness(request);
}
