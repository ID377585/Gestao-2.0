#!/usr/bin/env node

import { readFileSync } from "node:fs";

const script = readFileSync("scripts/dr/run-operational-preflight.sh", "utf8");
const workflow = readFileSync(".github/workflows/dr-operational-preflight.yml", "utf8");
const failures = [];

function requireText(source, text, message) {
  if (!source.includes(text)) failures.push(message);
}

for (const required of [
  "set -Eeuo pipefail",
  "set +x",
  "umask 077",
  "--cipher-algo AES256",
  "sha256sum",
  "s3api head-bucket",
  "s3 cp",
  "cmp --silent",
  '"productionDatabaseAccessed": false',
  '"sourceDatabaseCredentialRequired": false',
  '"remoteObjectRetainedForLifecycle": true',
]) {
  requireText(script, required, `preflight script missing safety contract: ${required}`);
}

for (const forbidden of [
  "SUPABASE_DB_URL",
  "GESTIFY_DR_SOURCE_DB_URL",
  "SUPABASE_STORAGE_S3_ACCESS_KEY_ID",
  "create-encrypted-backup.sh",
  "restore-encrypted-backup.sh",
  "db dump",
]) {
  if (script.includes(forbidden)) {
    failures.push(`preflight script must not reference Production/live source capability: ${forbidden}`);
  }
}

for (const required of [
  "workflow_dispatch:",
  "run_operational_preflight",
  "github.ref == 'refs/heads/main'",
  "self-hosted",
  "linux",
  "x64",
  "gestify-dr",
  "environment: disaster-recovery",
  "bash scripts/dr/run-operational-preflight.sh",
  "dr-operational-preflight-*.json",
  "permissions:\n  contents: read",
]) {
  requireText(workflow, required, `preflight workflow missing safety contract: ${required}`);
}

for (const forbidden of [
  "GESTIFY_DR_SOURCE_DB_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_STORAGE_S3_ACCESS_KEY_ID",
  "GESTIFY_DR_ENABLED == 'true'",
  "schedule:",
  "pull_request_target",
  "create-encrypted-backup.sh",
  "restore-encrypted-backup.sh",
]) {
  if (workflow.includes(forbidden)) {
    failures.push(`preflight workflow must not contain live/automatic capability: ${forbidden}`);
  }
}

if (failures.length) {
  console.error("[dr-preflight-audit] Contract invalid:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("[dr-preflight-audit] OK. Preflight is manual, synthetic, self-hosted and has no Production database capability.");
