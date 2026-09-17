import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { GestifyAdminCaller } from "@/lib/admin/gestify-admin-auth.server";

export class GestifyAdminRequestError extends Error {
  constructor(
    message: string,
    readonly status: 409 | 500 | 503,
    readonly code: string,
  ) {
    super(message);
    this.name = "GestifyAdminRequestError";
  }
}

export type GestifyAdminRequestContext = {
  id: string;
  correlationId: string;
  tokenId: string;
  action: string;
  targetEstablishmentId: string | null;
  startedAt: number;
};

function isUniqueViolation(error: unknown) {
  return String((error as { code?: unknown } | null)?.code ?? "") === "23505";
}

export async function beginGestifyAdminRequest(params: {
  caller: GestifyAdminCaller;
  correlationId: string;
  action: string;
  targetEstablishmentId?: string | null;
}): Promise<GestifyAdminRequestContext> {
  const supabase = getSupabaseAdminClient();
  const startedAt = Date.now();
  const { data, error } = await supabase
    .from("gestify_admin_request_log")
    .insert({
      correlation_id: params.correlationId,
      token_id: params.caller.tokenId,
      issuer: params.caller.issuer,
      action: params.action,
      target_establishment_id: params.targetEstablishmentId ?? null,
      result_status: "started",
    })
    .select("id")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new GestifyAdminRequestError("M2M token replay rejected.", 409, "token_replay");
    }
    throw new GestifyAdminRequestError(
      "Administrative audit ledger is unavailable.",
      503,
      "audit_unavailable",
    );
  }

  if (!data?.id) {
    throw new GestifyAdminRequestError(
      "Administrative audit ledger did not confirm the request.",
      503,
      "audit_unavailable",
    );
  }

  return {
    id: String(data.id),
    correlationId: params.correlationId,
    tokenId: params.caller.tokenId,
    action: params.action,
    targetEstablishmentId: params.targetEstablishmentId ?? null,
    startedAt,
  };
}

export async function completeGestifyAdminRequest(
  context: GestifyAdminRequestContext,
  params: {
    resultStatus: "succeeded" | "denied" | "failed";
    responseCount?: number | null;
    errorCode?: string | null;
  },
) {
  const supabase = getSupabaseAdminClient();
  const durationMs = Math.max(0, Date.now() - context.startedAt);
  const { error } = await supabase
    .from("gestify_admin_request_log")
    .update({
      result_status: params.resultStatus,
      response_count: params.responseCount ?? null,
      duration_ms: durationMs,
      error_code: params.errorCode ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", context.id)
    .eq("token_id", context.tokenId);

  if (error) {
    console.error(
      JSON.stringify({
        event: "gestify_admin_audit_completion_failed",
        correlationId: context.correlationId,
        action: context.action,
        errorCode: String((error as { code?: unknown }).code ?? "unknown"),
      }),
    );
    throw new GestifyAdminRequestError(
      "Administrative audit completion failed.",
      500,
      "audit_completion_failed",
    );
  }

  return durationMs;
}
