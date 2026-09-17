import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const auth = read("src/lib/admin/gestify-admin-auth.server.ts");
const executor = read("src/lib/admin/gestify-admin-route.server.ts");
const audit = read("src/lib/admin/gestify-admin-request.server.ts");
const data = read("src/lib/admin/gestify-admin-data.server.ts");
const extra = read("src/lib/admin/gestify-admin-extra.server.ts");
const migration = read("supabase/migrations/20260917062436_create_gestify_admin_request_log.sql");
const hardening = read(
  "supabase/migrations/20260917114744_harden_gestify_admin_and_reconcile_nutrition_staging.sql",
);

const routeNames = [
  "platform-overview",
  "companies",
  "company-details",
  "company-users",
  "subscription-status",
  "trial-accounts",
  "past-due-subscriptions",
  "plan-usage",
  "recent-signups",
  "user-activity",
  "enabled-modules",
  "platform-health",
];

for (const name of routeNames) {
  const path = `src/app/api/internal/admin/v1/${name}/route.ts`;
  assert(existsSync(join(root, path)), `missing route ${name}`);
  if (existsSync(join(root, path))) {
    const source = read(path);
    assert(source.includes("executeGestifyAdminRead"), `${name} bypasses central admin executor`);
    assert(!source.includes("getSupabaseAdminClient"), `${name} accesses Supabase directly`);
    assert(!/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(source), `${name} exposes a write method`);
  }
}

assert(auth.includes('EXPECTED_ISSUER = "kratelis-company-os"'), "wrong M2M issuer contract");
assert(auth.includes('EXPECTED_AUDIENCE = "gestify-admin"'), "wrong M2M audience contract");
assert(auth.includes('REQUIRED_SCOPE = "gestify.admin.read"'), "missing read scope");
assert(auth.includes("MAX_TOKEN_LIFETIME_SECONDS = 5 * 60"), "missing short token lifetime cap");
assert(auth.includes('GESTIFY_ADMIN_ENABLED'), "missing global admin kill switch");
assert(auth.includes('GESTIFY_ADMIN_READS_ENABLED'), "missing read kill switch");
assert(auth.includes('GESTIFY_ADMIN_WRITES_ENABLED'), "missing write fail-closed guard");
assert(auth.includes('header.alg !== "HS256"'), "M2M algorithm not pinned");
assert(auth.includes("timingSafeEqual"), "M2M signature comparison is not timing-safe");

assert(executor.includes("rateLimit"), "missing rate limit");
assert(executor.includes("beginGestifyAdminRequest"), "missing audit begin");
assert(executor.includes("completeGestifyAdminRequest"), "missing audit completion");
assert(executor.includes('"cache-control": "no-store"'), "admin responses may be cached");
assert(executor.includes('"x-content-type-options": "nosniff"'), "missing nosniff header");

assert(audit.includes('code ?? ""') && audit.includes('"23505"'), "missing unique-token replay handling");
assert(audit.includes('"token_replay"'), "missing replay error contract");
assert(audit.includes('"audit_unavailable"'), "audit failure does not fail closed");

assert(migration.includes("token_id text not null"), "audit ledger missing token id");
assert(migration.includes("unique (token_id)"), "token id is not unique");
assert(migration.includes("enable row level security"), "audit ledger missing RLS");
assert(migration.includes("revoke all on table public.gestify_admin_request_log from public, anon, authenticated"), "client grants not revoked");
assert(hardening.includes("gestify_admin_request_log_no_client_access"), "missing explicit deny-all policy");
assert(hardening.includes("security invoker"), "nutrition staging wrapper not reconciled to invoker");

const combinedData = `${data}\n${extra}`;
assert(combinedData.includes("contractual_recurring_amount_not_collected_revenue"), "financial amount semantics are ambiguous");
assert(extra.includes("subscription_status_past_due_not_reconciled_financial_overdue"), "past_due semantics are ambiguous");
assert(extra.includes("telemetryAvailable: false"), "module entitlement may be confused with telemetry");

for (const forbidden of ["eval(", "new Function(", "child_process", "exec(", "spawn(", "arbitrary_sql"]) {
  assert(!`${auth}\n${executor}\n${audit}\n${data}\n${extra}`.includes(forbidden), `forbidden capability present: ${forbidden}`);
}

if (failures.length) {
  console.error("Gestify Admin M2 contract audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Gestify Admin M2 contract audit: PASS (${routeNames.length} read-only routes).`);
