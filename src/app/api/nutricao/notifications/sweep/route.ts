import { NextRequest, NextResponse } from "next/server";

import { sweepNutritionOperationalNotifications } from "@/lib/nutricao/operational-notifications";
import {
  authorizeCronSecret,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-secret";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

async function listActiveEstablishmentIds() {
  const supabase = getSupabaseAdminClient();
  const establishmentIds = new Set<string>();

  for (const tableName of ["memberships", "establishment_memberships"]) {
    const { data, error } = await supabase
      .from(tableName)
      .select("establishment_id")
      .eq("is_active", true)
      .not("establishment_id", "is", null)
      .limit(1000);

    if (error) {
      if (!isSchemaCompatibilityError(error)) {
        console.error("[nutrition-sweep] membership lookup error:", {
          tableName,
          code: error.code,
          message: error.message,
        });
      }
      continue;
    }

    for (const row of data ?? []) {
      if ((row as any).establishment_id) {
        establishmentIds.add(String((row as any).establishment_id));
      }
    }
  }

  return Array.from(establishmentIds);
}

async function handleSweep(request: NextRequest) {
  const limited = rateLimit(request, {
    key: "nutrition-notifications-sweep",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const authorization = authorizeCronSecret(request, {
    routeLabel: "nutricao/notifications/sweep",
    envNames: ["NUTRITION_CRON_SECRET", "JOB_WORKER_SECRET", "CRON_SECRET"],
    acceptedHeaderNames: [
      "x-nutrition-cron-secret",
      "x-job-worker-secret",
      "x-cron-secret",
    ],
  });
  if (!authorization.authorized) return cronUnauthorizedResponse(authorization);

  const supabase = getSupabaseAdminClient();
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(250, Math.floor(limitParam)))
    : 100;
  const establishmentIds = (await listActiveEstablishmentIds()).slice(0, limit);
  const results = [];

  for (const establishmentId of establishmentIds) {
    results.push(
      await sweepNutritionOperationalNotifications(supabase, establishmentId, {
        source: "cron",
      })
    );
  }

  return NextResponse.json(
    {
      ok: true,
      establishments: establishmentIds.length,
      generatedOrRefreshed: results.reduce(
        (total, item) => total + item.generatedOrRefreshed,
        0
      ),
      scanned: results.reduce((total, item) => total + item.scanned, 0),
      errors: results.flatMap((item) =>
        item.errors.map((error) => ({
          establishmentId: item.establishmentId,
          ...error,
        }))
      ),
    },
    { status: 200 }
  );
}

export async function GET(request: NextRequest) {
  return handleSweep(request);
}

export async function POST(request: NextRequest) {
  return handleSweep(request);
}
