import "server-only";

import { createHash } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

type IdempotencyRecord<T> = {
  id: string;
  request_hash: string;
  status: "processing" | "completed" | "failed";
  response_status: number | null;
  response_body: T | null;
  locked_until: string;
};

type IdempotentActionOptions<T> = {
  key?: string | null;
  operation: string;
  userId: string;
  establishmentId?: string | null;
  payload: unknown;
  ttlMs?: number;
  lockMs?: number;
  execute: () => Promise<T>;
};

export type IdempotentActionResult<T> = {
  value: T;
  replayed: boolean;
};

function normalizeIdempotencyKey(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 180);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

export function hashIdempotencyPayload(payload: unknown) {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function getIdempotencyKeyFromRequest(
  request: Request,
  body?: Record<string, unknown> | null
) {
  return normalizeIdempotencyKey(
    request.headers.get("idempotency-key") ||
      request.headers.get("x-idempotency-key") ||
      (typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null) ||
      (typeof body?.idempotency_key === "string" ? body.idempotency_key : null)
  );
}

function scopedRecordQuery(params: {
  userId: string;
  establishmentId?: string | null;
  operation: string;
  key: string;
}) {
  let query = getSupabaseAdminClient()
    .from("api_idempotency_keys")
    .select(
      "id, request_hash, status, response_status, response_body, locked_until"
    )
    .eq("user_id", params.userId)
    .eq("operation", params.operation)
    .eq("idempotency_key", params.key)
    .limit(1);

  if (params.establishmentId) {
    query = query.eq("establishment_id", params.establishmentId);
  } else {
    query = query.is("establishment_id", null);
  }

  return query;
}

async function loadExistingRecord<T>(params: {
  userId: string;
  establishmentId?: string | null;
  operation: string;
  key: string;
}) {
  const { data, error } = await scopedRecordQuery(params).maybeSingle();

  if (error) {
    console.error("[idempotency] load error:", error);
    throw new Error("Não foi possível validar a idempotência da operação.");
  }

  return data as IdempotencyRecord<T> | null;
}

function assertSameRequestHash(record: IdempotencyRecord<unknown>, requestHash: string) {
  if (record.request_hash === requestHash) return;

  throw new Error(
    "A chave de idempotência já foi usada com dados diferentes. Gere uma nova chave para uma nova operação."
  );
}

export async function runIdempotentAction<T>(
  options: IdempotentActionOptions<T>
): Promise<IdempotentActionResult<T>> {
  const key = normalizeIdempotencyKey(options.key);

  if (!key) {
    return { value: await options.execute(), replayed: false };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const requestHash = hashIdempotencyPayload({
    operation: options.operation,
    payload: options.payload,
  });
  const now = Date.now();
  const lockedUntil = new Date(now + (options.lockMs ?? 5 * 60_000)).toISOString();
  const expiresAt = new Date(now + (options.ttlMs ?? 24 * 60 * 60_000)).toISOString();

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("api_idempotency_keys")
    .insert({
      establishment_id: options.establishmentId ?? null,
      user_id: options.userId,
      operation: options.operation,
      idempotency_key: key,
      request_hash: requestHash,
      status: "processing",
      locked_until: lockedUntil,
      expires_at: expiresAt,
    })
    .select("id, request_hash, status, response_status, response_body, locked_until")
    .single();

  let record = inserted as IdempotencyRecord<T> | null;

  if (insertError) {
    if ((insertError as any)?.code !== "23505") {
      console.error("[idempotency] insert error:", insertError);
      throw new Error("Não foi possível preparar a idempotência da operação.");
    }

    record = await loadExistingRecord<T>({
      userId: options.userId,
      establishmentId: options.establishmentId,
      operation: options.operation,
      key,
    });

    if (!record) {
      throw new Error("Não foi possível recuperar a operação idempotente.");
    }

    assertSameRequestHash(record, requestHash);

    if (record.status === "completed") {
      return { value: record.response_body as T, replayed: true };
    }

    if (
      record.status === "processing" &&
      new Date(record.locked_until).getTime() > now
    ) {
      throw new Error(
        "Esta operação já está em processamento. Aguarde alguns instantes antes de tentar novamente."
      );
    }

    const { data: reclaimed, error: reclaimError } = await supabaseAdmin
      .from("api_idempotency_keys")
      .update({
        status: "processing",
        locked_until: lockedUntil,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id)
      .select("id, request_hash, status, response_status, response_body, locked_until")
      .single();

    if (reclaimError || !reclaimed) {
      console.error("[idempotency] reclaim error:", reclaimError);
      throw new Error("Não foi possível retomar a operação idempotente.");
    }

    record = reclaimed as IdempotencyRecord<T>;
  }

  try {
    const value = await options.execute();

    await supabaseAdmin
      .from("api_idempotency_keys")
      .update({
        status: "completed",
        response_status: 200,
        response_body: value as any,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record!.id);

    return { value, replayed: false };
  } catch (error: any) {
    await supabaseAdmin
      .from("api_idempotency_keys")
      .update({
        status: "failed",
        error_message: error?.message ? String(error.message).slice(0, 1000) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record!.id);

    throw error;
  }
}
