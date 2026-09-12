#!/usr/bin/env node

const confirmation = process.env.GESTIFY_PROD_LOAD_CONFIRMATION?.trim();
const targetRaw = process.env.GESTIFY_PROD_LOAD_TARGET_URL?.trim() || "https://www.gestify.app";
const path = process.env.GESTIFY_PROD_LOAD_PATH?.trim() || "/login";
const total = Number(process.env.GESTIFY_PROD_LOAD_REQUESTS || 120);
const concurrency = Number(process.env.GESTIFY_PROD_LOAD_CONCURRENCY || 3);
const maxErrorRate = Number(process.env.GESTIFY_PROD_LOAD_MAX_ERROR_RATE || 0.01);
const maxP95Ms = Number(process.env.GESTIFY_PROD_LOAD_MAX_P95_MS || 3000);

if (confirmation !== "load:gestify-production:controlled") {
  throw new Error("Invalid Production load confirmation.");
}
if (!Number.isInteger(total) || total < 1 || total > 200) {
  throw new Error("GESTIFY_PROD_LOAD_REQUESTS must be between 1 and 200");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) {
  throw new Error("GESTIFY_PROD_LOAD_CONCURRENCY must be between 1 and 3");
}
if (!path.startsWith("/") || path.startsWith("//")) {
  throw new Error("GESTIFY_PROD_LOAD_PATH must be a relative absolute path");
}

const base = new URL(targetRaw);
const allowedHosts = new Set(["gestify.app", "www.gestify.app"]);
if (base.protocol !== "https:" || !allowedHosts.has(base.hostname.toLowerCase())) {
  throw new Error(`Production load target not allowlisted: ${base.origin}`);
}

// Only explicitly read-only, non-mutating routes are permitted.
const allowedPaths = new Set(["/", "/login"]);
if (!allowedPaths.has(path)) {
  throw new Error(`Production load path is not read-only allowlisted: ${path}`);
}

const target = new URL(path, base);
const durations = [];
const statuses = new Map();
let errors = 0;
let next = 0;

function percentile(values, ratio) {
  if (!values.length) return null;
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
      const response = await fetch(target, {
        method: "GET",
        headers: { "user-agent": "gestify-production-controlled-load/1.0" },
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
      durations.push(performance.now() - started);
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
if (result.errorRate > maxErrorRate) process.exit(1);
if ((result.latencyMs.p95 ?? Infinity) > maxP95Ms) process.exit(1);
