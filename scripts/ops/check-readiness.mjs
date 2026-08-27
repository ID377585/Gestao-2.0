#!/usr/bin/env node

const targetRaw = process.env.GESTIFY_MONITORING_URL?.trim();
const secret = process.env.GESTIFY_MONITORING_SECRET?.trim();

if (!targetRaw) throw new Error("GESTIFY_MONITORING_URL is required");
if (!secret) throw new Error("GESTIFY_MONITORING_SECRET is required");

const target = new URL("/api/ops/readiness", targetRaw);
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 12_000);
const started = performance.now();

try {
  const response = await fetch(target, {
    method: "GET",
    headers: {
      "x-operational-readiness-secret": secret,
      "user-agent": "gestify-readiness-monitor/1.0",
    },
    cache: "no-store",
    signal: controller.signal,
  });
  const durationMs = Math.round(performance.now() - started);
  const payload = await response.json().catch(() => null);
  const output = {
    ok: response.ok && payload?.ok === true,
    httpStatus: response.status,
    durationMs,
    readinessStatus: payload?.summary?.status ?? null,
    critical: payload?.summary?.critical ?? null,
    warnings: payload?.summary?.warnings ?? null,
    generatedAt: new Date().toISOString(),
  };
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exit(1);
} finally {
  clearTimeout(timeoutId);
}
