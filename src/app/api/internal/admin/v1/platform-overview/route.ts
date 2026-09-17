import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  GestifyAdminAuthError,
  requireGestifyAdminCaller,
} from "@/lib/admin/gestify-admin-auth.server";
import { getGestifyPlatformOverview } from "@/lib/admin/gestify-admin-overview.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function correlationIdFrom(request: Request): string {
  const supplied = request.headers.get("x-correlation-id")?.trim();
  if (supplied && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied)) {
    return supplied;
  }
  return randomUUID();
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const correlationId = correlationIdFrom(request);

  try {
    const caller = requireGestifyAdminCaller(request.headers.get("authorization"));
    const overview = await getGestifyPlatformOverview();

    console.info(
      JSON.stringify({
        event: "gestify_admin_read",
        action: "platform_overview",
        correlationId,
        tokenId: caller.tokenId,
        issuer: caller.issuer,
        result: "success",
        durationMs: Date.now() - startedAt,
      }),
    );

    return NextResponse.json(
      { correlationId, data: overview },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "x-correlation-id": correlationId,
        },
      },
    );
  } catch (error) {
    const status = error instanceof GestifyAdminAuthError ? error.status : 500;
    const code =
      status === 503
        ? "admin_disabled"
        : status === 401
          ? "unauthorized"
          : status === 403
            ? "forbidden"
            : "internal_error";

    console.warn(
      JSON.stringify({
        event: "gestify_admin_read",
        action: "platform_overview",
        correlationId,
        result: "denied_or_error",
        status,
        code,
        durationMs: Date.now() - startedAt,
      }),
    );

    return NextResponse.json(
      { correlationId, error: code },
      {
        status,
        headers: {
          "cache-control": "no-store",
          "x-correlation-id": correlationId,
        },
      },
    );
  }
}
