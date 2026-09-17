import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  GestifyAdminAuthError,
  requireGestifyAdminCaller,
} from "@/lib/admin/gestify-admin-auth.server";
import {
  beginGestifyAdminRequest,
  completeGestifyAdminRequest,
  GestifyAdminRequestError,
  type GestifyAdminRequestContext,
} from "@/lib/admin/gestify-admin-request.server";
import { rateLimit } from "@/lib/security/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function correlationIdFrom(request: Request): string {
  const supplied = request.headers.get("x-correlation-id")?.trim();
  if (
    supplied &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied)
  ) {
    return supplied;
  }
  return randomUUID();
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  correlationId: string,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-correlation-id": correlationId,
      "x-content-type-options": "nosniff",
    },
  });
}

function codeForStatus(status: number) {
  if (status === 503) return "admin_disabled";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 409) return "token_replay";
  return "internal_error";
}

export async function executeGestifyAdminRead<T>(params: {
  request: Request;
  action: string;
  targetEstablishmentId?: string | null;
  responseCount?: (data: T) => number | null;
  run: () => Promise<T>;
}) {
  const correlationId = correlationIdFrom(params.request);
  let auditContext: GestifyAdminRequestContext | null = null;

  try {
    const caller = requireGestifyAdminCaller(params.request.headers.get("authorization"));
    const limited = rateLimit(params.request, {
      key: `gestify-admin:${params.action}`,
      identifier: caller.issuer,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) {
      return jsonResponse(
        { correlationId, error: "rate_limited" },
        429,
        correlationId,
      );
    }

    const requestedTarget = params.targetEstablishmentId?.trim() || null;
    const auditTarget = requestedTarget && UUID_RE.test(requestedTarget) ? requestedTarget : null;

    auditContext = await beginGestifyAdminRequest({
      caller,
      correlationId,
      action: params.action,
      targetEstablishmentId: auditTarget,
    });

    const data = await params.run();
    const responseCount = params.responseCount ? params.responseCount(data) : 1;
    const durationMs = await completeGestifyAdminRequest(auditContext, {
      resultStatus: "succeeded",
      responseCount,
    });

    console.info(
      JSON.stringify({
        event: "gestify_admin_read",
        action: params.action,
        correlationId,
        tokenId: caller.tokenId,
        result: "success",
        durationMs,
        responseCount,
      }),
    );

    return jsonResponse({ correlationId, data }, 200, correlationId);
  } catch (error) {
    const status =
      error instanceof GestifyAdminAuthError || error instanceof GestifyAdminRequestError
        ? error.status
        : error instanceof Error && error.message === "invalid_establishment_id"
          ? 400
          : 500;
    const code =
      error instanceof GestifyAdminRequestError
        ? error.code
        : status === 400
          ? "invalid_request"
          : codeForStatus(status);

    if (auditContext) {
      try {
        await completeGestifyAdminRequest(auditContext, {
          resultStatus: status >= 500 ? "failed" : "denied",
          errorCode: code,
        });
      } catch {
        // The completion failure is already logged by the audit helper.
      }
    }

    console.warn(
      JSON.stringify({
        event: "gestify_admin_read",
        action: params.action,
        correlationId,
        result: "denied_or_error",
        status,
        code,
      }),
    );

    return jsonResponse({ correlationId, error: code }, status, correlationId);
  }
}
