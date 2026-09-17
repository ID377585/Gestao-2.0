import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const EXPECTED_ISSUER = "kratelis-company-os";
const EXPECTED_AUDIENCE = "gestify-admin";
const REQUIRED_SCOPE = "gestify.admin.read";
const MAX_TOKEN_LIFETIME_SECONDS = 5 * 60;

export class GestifyAdminAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 503,
  ) {
    super(message);
    this.name = "GestifyAdminAuthError";
  }
}

type JwtHeader = {
  alg?: unknown;
  typ?: unknown;
};

type JwtPayload = {
  iss?: unknown;
  aud?: unknown;
  scope?: unknown;
  exp?: unknown;
  iat?: unknown;
  jti?: unknown;
};

export type GestifyAdminCaller = {
  issuer: string;
  audience: string;
  scopes: string[];
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
};

function enabled(name: string): boolean {
  return process.env[name] === "true";
}

export function assertGestifyAdminReadEnabled() {
  if (!enabled("GESTIFY_ADMIN_ENABLED") || !enabled("GESTIFY_ADMIN_READS_ENABLED")) {
    throw new GestifyAdminAuthError("Gestify Admin API is disabled.", 503);
  }

  if (enabled("GESTIFY_ADMIN_WRITES_ENABLED")) {
    throw new GestifyAdminAuthError(
      "Gestify Admin read-only boundary refuses startup while writes are enabled.",
      503,
    );
  }
}

function decodeJson<T>(value: string): T {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    throw new GestifyAdminAuthError("Invalid M2M token encoding.", 401);
  }
}

function requireSigningSecret(): string {
  const secret = process.env.GESTIFY_ADMIN_M2M_HS256_SECRET;
  if (!secret || secret.length < 32) {
    throw new GestifyAdminAuthError("Gestify Admin M2M verifier is not configured.", 503);
  }
  return secret;
}

function parseScopes(scope: unknown): string[] {
  if (typeof scope !== "string") return [];
  return scope
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function requireGestifyAdminCaller(authorization: string | null): GestifyAdminCaller {
  assertGestifyAdminReadEnabled();

  if (!authorization?.startsWith("Bearer ")) {
    throw new GestifyAdminAuthError("Missing bearer token.", 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new GestifyAdminAuthError("Malformed M2M token.", 401);
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson<JwtHeader>(encodedHeader);
  const payload = decodeJson<JwtPayload>(encodedPayload);

  if (header.alg !== "HS256" || (header.typ !== undefined && header.typ !== "JWT")) {
    throw new GestifyAdminAuthError("Unsupported M2M token algorithm.", 401);
  }

  const expectedSignature = createHmac("sha256", requireSigningSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw new GestifyAdminAuthError("Invalid M2M token signature.", 401);
  }

  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new GestifyAdminAuthError("Invalid M2M token signature.", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const issuedAt = typeof payload.iat === "number" ? payload.iat : NaN;
  const expiresAt = typeof payload.exp === "number" ? payload.exp : NaN;

  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
    throw new GestifyAdminAuthError("M2M token is missing temporal claims.", 401);
  }
  if (issuedAt > now + 30 || expiresAt <= now) {
    throw new GestifyAdminAuthError("M2M token is not currently valid.", 401);
  }
  if (expiresAt - issuedAt <= 0 || expiresAt - issuedAt > MAX_TOKEN_LIFETIME_SECONDS) {
    throw new GestifyAdminAuthError("M2M token lifetime exceeds policy.", 401);
  }
  if (payload.iss !== EXPECTED_ISSUER || payload.aud !== EXPECTED_AUDIENCE) {
    throw new GestifyAdminAuthError("M2M token issuer or audience is not allowed.", 403);
  }

  const scopes = parseScopes(payload.scope);
  if (!scopes.includes(REQUIRED_SCOPE)) {
    throw new GestifyAdminAuthError("M2M token does not grant Gestify admin read scope.", 403);
  }
  if (typeof payload.jti !== "string" || payload.jti.length < 8 || payload.jti.length > 128) {
    throw new GestifyAdminAuthError("M2M token is missing a valid token id.", 401);
  }

  return {
    issuer: EXPECTED_ISSUER,
    audience: EXPECTED_AUDIENCE,
    scopes,
    tokenId: payload.jti,
    issuedAt,
    expiresAt,
  };
}
