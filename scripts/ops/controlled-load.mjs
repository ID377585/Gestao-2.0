#!/usr/bin/env node

const targetRaw = process.env.GESTIFY_LOAD_TARGET_URL?.trim();
const confirmation = process.env.GESTIFY_LOAD_CONFIRMATION?.trim();
const path = process.env.GESTIFY_LOAD_PATH?.trim() || "/login";
const total = Number(process.env.GESTIFY_LOAD_REQUESTS || 100);
const concurrency = Number(process.env.GESTIFY_LOAD_CONCURRENCY || 5);
const maxErrorRate = Number(process.env.GESTIFY_LOAD_MAX_ERROR_RATE || 0.01);
const maxP95Ms = Number(process.env.GESTIFY_LOAD_MAX_P95_MS || 3000);
const readinessSecret = process.env.GESTIFY_LOAD_READINESS_SECRET?.trim();

if (!targetRaw) throw new Error("GESTIFY_LOAD_TARGET_URL is required");
if (confirmation !== "load:gestify-staging") {
  throw new Error("Invalid load confirmation. Expected load:gestify-staging");
}
if (!Number.isInteger(total) || total < 1 || total > 2000) throw new Error("GESTIFY_LOAD_REQUESTS must be between 1 and 2000");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 25) throw new Error("GESTIFY_LOAD_CONCURRENCY must be between 1 and 25");
if (!path.startsWith("/") || path.startsWith("//")) throw new Error("GESTIFY_LOAD_PATH must be a relative absolute path");

const base = new URL(targetRaw);
if (!['http:', 'https:'].includes(base.protocol)) throw new Error("GESTIFY_LOAD_TARGET_URL must use http or https");
const hostname = base.hostname.toLowerCase();
const forbiddenHosts = new Set([
  "gestify.app",
  "www.gestify.app",
  "gestao-2-0.vercel.app",
  ...(process.env.GESTIFY_PRODUCTION_HOSTS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
]);

if (forbiddenHosts.has(hostname) || hostname.endsWith(".gestify.app")) {
  throw new Error(`Load tests are forbidden against Production host: ${hostname}`);
}
if (targetRaw.includes("ubwbnpckbwtllitonpjj")) {
  throw new Error("Load tests are forbidden against the Production Supabase project");
}

const target = new URL(path, base);
const durations = [];
const statuses = new Map();
let errors = 0;
let next = 0;

function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

async function worker() {
  while (true) {
    const current = next++;
    if (current >= total) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const started = performance.now();
    try {
      const headers = { "user-agent": "gestify-controlled-load/1.1" };
      if (readinessSecret) headers["x-operational-readiness-secret"] = readinessSecret;
      const response = await fetch(target, {
        method: "GET",
        headers,
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
      const duration = performance.now() - started;
      durations.push(duration);
      statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
      if (response.status >= 500 || response.status === 429) errors += 1;
    } catch {
      durations.push(performance.now() - started);
      errors += 1;
      statuses.set("network_error", (statuses.get("network_error") || 0) + 1);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const result = {
  target: `${base.origin}${path}`,
  requests: total,
  concurrency,
  errors,
  errorRate: total ? errors / total : 1,
  latencyMs: {
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95),
    p99: percentile(durations, 0.99),
    max: durations.length ? Math.max(...durations) : null,
  },
  statuses: Object.fromEntries([...statuses.entries()].map(([key, value]) => [String(key), value])),
  thresholds: { maxErrorRate, maxP95Ms },
  generatedAt: new Date().toISOString(),
};

console.log(JSON.stringify(result, null, 2));

if (result.errorRate > maxErrorRate) {
  console.error(`Error rate ${result.errorRate} exceeded ${maxErrorRate}`);
  process.exit(1);
}
if ((result.latencyMs.p95 ?? Infinity) > maxP95Ms) {
  console.error(`p95 ${result.latencyMs.p95}ms exceeded ${maxP95Ms}ms`);
  process.exit(1);
}
