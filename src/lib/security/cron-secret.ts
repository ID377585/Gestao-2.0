import "server-only";

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

type CronSecretAuthOptions = {
  routeLabel: string;
  envNames: string[];
  acceptedHeaderNames?: string[];
  maxTimestampSkewMs?: number;
};

export type CronSecretAuthResult =
  | { authorized: true }
  | {
      authorized: false;
      status: 401 | 503;
      code:
        | "missing_configuration"
        | "missing_credentials"
        | "invalid_credentials"
        | "stale_request";
    };

function getBearerToken(request: Request) {
  return request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
}

function hasValidTimestamp(request: Request, maxTimestampSkewMs: number) {
  const timestamp = request.headers.get("x-cron-timestamp")?.trim();
  if (!timestamp) return true;

  const numericTimestamp = Number(timestamp);
  const timestampMs = Number.isFinite(numericTimestamp)
    ? numericTimestamp < 10_000_000_000
      ? numericTimestamp * 1000
      : numericTimestamp
    : Date.parse(timestamp);

  if (!Number.isFinite(timestampMs)) return false;

  return Math.abs(Date.now() - timestampMs) <= maxTimestampSkewMs;
}

function constantTimeEquals(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;

  return timingSafeEqual(aBuffer, bBuffer);
}

function matchesAnySecret(value: string | null | undefined, secrets: string[]) {
  if (!value) return false;

  return secrets.some((secret) => constantTimeEquals(value, secret));
}

export function authorizeCronSecret(
  request: Request,
  options: CronSecretAuthOptions
): CronSecretAuthResult {
  const configuredSecrets = options.envNames
    .map((envName) => process.env[envName]?.trim())
    .filter((value): value is string => Boolean(value));

  if (configuredSecrets.length === 0) {
    console.error(`${options.routeLabel}: segredo de execução não configurado.`, {
      envNames: options.envNames,
    });
    return { authorized: false, status: 503, code: "missing_configuration" };
  }

  if (!hasValidTimestamp(request, options.maxTimestampSkewMs ?? 5 * 60_000)) {
    return { authorized: false, status: 401, code: "stale_request" };
  }

  const headerCandidates = (options.acceptedHeaderNames ?? [])
    .map((headerName) => request.headers.get(headerName)?.trim())
    .filter(Boolean);
  const candidates = [
    getBearerToken(request),
    ...headerCandidates,
  ].filter(Boolean);

  if (candidates.length === 0) {
    return { authorized: false, status: 401, code: "missing_credentials" };
  }

  const authorized = candidates.some((candidate) =>
    matchesAnySecret(candidate, configuredSecrets)
  );

  return authorized
    ? { authorized: true }
    : { authorized: false, status: 401, code: "invalid_credentials" };
}

export function cronUnauthorizedResponse(result: Exclude<CronSecretAuthResult, { authorized: true }>) {
  if (result.code === "missing_configuration") {
    return NextResponse.json(
      { ok: false, error: "Rotina não configurada no ambiente." },
      { status: result.status }
    );
  }

  return NextResponse.json(
    { ok: false, error: "Não autorizado." },
    { status: result.status }
  );
}
