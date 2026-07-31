import { NextRequest, NextResponse } from "next/server";

import { processAppJobs } from "@/lib/queue/app-jobs";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const configuredSecrets = [
    process.env.JOB_WORKER_SECRET,
    process.env.CRON_SECRET,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (configuredSecrets.length === 0) {
    console.error("jobs/process: JOB_WORKER_SECRET ou CRON_SECRET não configurado.");
    return false;
  }

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const xJobSecret = request.headers.get("x-job-worker-secret")?.trim();
  const xCronSecret = request.headers.get("x-cron-secret")?.trim();

  return [bearer, xJobSecret, xCronSecret].some(
    (value) => Boolean(value) && configuredSecrets.includes(String(value))
  );
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    key: "jobs-process",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 10);
  const result = await processAppJobs({
    limit: Number.isFinite(limitParam) ? limitParam : 10,
  });

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Método não permitido. Use POST." },
    {
      status: 405,
      headers: { Allow: "POST" },
    }
  );
}
