import { NextRequest, NextResponse } from "next/server";

import { processAppJobs } from "@/lib/queue/app-jobs";
import {
  authorizeCronSecret,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-secret";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handleJobsProcess(request: NextRequest) {
  const limited = rateLimit(request, {
    key: "jobs-process",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const authorization = authorizeCronSecret(request, {
    routeLabel: "jobs/process",
    envNames: ["JOB_WORKER_SECRET", "CRON_SECRET"],
    acceptedHeaderNames: ["x-job-worker-secret", "x-cron-secret"],
  });
  if (!authorization.authorized) return cronUnauthorizedResponse(authorization);

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 10);
  const result = await processAppJobs({
    limit: Number.isFinite(limitParam) ? limitParam : 10,
  });

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}

export async function POST(request: NextRequest) {
  return handleJobsProcess(request);
}

export async function GET(request: NextRequest) {
  return handleJobsProcess(request);
}
