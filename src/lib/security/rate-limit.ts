import { NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  identifier?: string | null;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitState>();

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < 1000) return;

  for (const [key, state] of buckets.entries()) {
    if (state.resetAt <= now) buckets.delete(key);
  }
}

function buildRateLimitHeaders(params: {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}) {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(params.limit),
    "X-RateLimit-Remaining": String(Math.max(0, params.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(params.resetAt / 1000)),
  };

  if (params.retryAfterSeconds) {
    headers["Retry-After"] = String(params.retryAfterSeconds);
  }

  return headers;
}

export function rateLimit(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const identifier = options.identifier || getRequestIp(request);
  const bucketKey = `${options.key}:${identifier}`;
  const existing = buckets.get(bucketKey);

  pruneExpiredBuckets(now);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return null;
  }

  existing.count += 1;

  if (existing.count <= options.limit) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return NextResponse.json(
    {
      error: "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.",
    },
    {
      status: 429,
      headers: buildRateLimitHeaders({
        limit: options.limit,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfterSeconds,
      }),
    }
  );
}
