#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const serverPath = resolve(root, "src/lib/idempotency/server.ts");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260730134000_idempotency_and_job_queue_foundation.sql"
);

const server = readFileSync(serverPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");

const serverContracts = [
  [/createHash\("sha256"\)/, "payload hash must use sha256"],
  [/stableStringify/, "payload hashing must be stable"],
  [/code\s*!==\s*"23505"/, "unique conflicts must be handled explicitly"],
  [/assertSameRequestHash\(record, requestHash\)/, "same key with different payload must be rejected"],
  [/record\.status\s*===\s*"completed"/, "completed requests must be replayed"],
  [/replayed:\s*true/, "replay result must be marked"],
  [/record\.status\s*===\s*"processing"/, "processing lock must be detected"],
  [/\.lte\("locked_until"/, "expired locks must be reclaimed atomically"],
  [/\.eq\("request_hash", requestHash\)/, "reclaim must preserve request hash"],
  [/\.eq\("status", record\.status\)/, "reclaim must compare previous status"],
  [/\.eq\("status", "processing"\)/, "completion must only update processing rows"],
  [/status:\s*"failed"/, "failed execution must be recorded"],
];

const migrationContracts = [
  [
    /unique\s*\(\s*user_id\s*,\s*establishment_id\s*,\s*operation\s*,\s*idempotency_key\s*\)/i,
    "tenant-scoped idempotency key must be unique",
  ],
  [
    /create\s+unique\s+index\s+if\s+not\s+exists\s+api_idempotency_keys_user_global_key[\s\S]*?user_id\s*,\s*operation\s*,\s*idempotency_key/i,
    "global idempotency key must be unique when establishment is null",
  ],
  [/force\s+row\s+level\s+security/i, "idempotency table must force RLS"],
  [/revoke\s+all\s+privileges[\s\S]*?authenticated/i, "clients must not mutate idempotency ledger directly"],
  [/for\s+update\s+skip\s+locked/i, "job claiming must remain concurrency-safe"],
];

const failures = [];
for (const [pattern, message] of serverContracts) {
  if (!pattern.test(server)) failures.push(`server.ts: ${message}`);
}
for (const [pattern, message] of migrationContracts) {
  if (!pattern.test(migration)) failures.push(`migration: ${message}`);
}

if (failures.length) {
  console.error("[idempotency-contract] Falhas encontradas:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "[idempotency-contract] OK. Hash, replay, lock/reclaim, unique keys and SKIP LOCKED remain protected."
);
