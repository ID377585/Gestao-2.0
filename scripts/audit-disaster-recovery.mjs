#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const notes = [];

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function fail(message) {
  failures.push(message);
}

function requireFile(path) {
  if (!existsSync(resolve(root, path))) {
    fail(`${path}: arquivo obrigatório ausente.`);
    return false;
  }
  return true;
}

function requireSnippets(path, snippets) {
  if (!requireFile(path)) return;
  const source = readText(path);
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      fail(`${path}: conteúdo obrigatório ausente: ${snippet}`);
    }
  }
}

const requiredFiles = [
  ".github/workflows/disaster-recovery.yml",
  "docs/operations/disaster-recovery.md",
  "scripts/dr/create-encrypted-backup.sh",
  "scripts/dr/restore-encrypted-backup.sh",
  "scripts/dr/run-fixture-drill.sh",
  "scripts/dr/sanitize-supabase-backup.mjs",
  "scripts/dr/fixture.sql",
  "scripts/dr/verify-restore.sql",
  "scripts/dr/verify-live-restore.sql",
];

for (const path of requiredFiles) requireFile(path);

requireSnippets("scripts/dr/create-encrypted-backup.sh", [
  "set -Eeuo pipefail",
  "set +x",
  "umask 077",
  "BACKUP_PASSPHRASE deve ter pelo menos 32 caracteres",
  "db dump",
  "--role-only",
  "--use-copy",
  "--data-only",
  "--schema supabase_migrations",
  "--cipher-algo AES256",
  "sha256sum",
  "GESTIFY_DR_INCLUDE_STORAGE",
]);

requireSnippets("scripts/dr/restore-encrypted-backup.sh", [
  "set -Eeuo pipefail",
  "set +x",
  "umask 077",
  "SUPABASE_EXCLUDED_SERVICES",
  'start -x "$SUPABASE_EXCLUDED_SERVICES"',
  "checksum SHA-256 divergente",
  "RESTORE_TO_DISPOSABLE_TARGET",
  "origem e destino do restore são o mesmo banco",
  "session_replication_role = replica",
  "TRUNCATE TABLE supabase_migrations.schema_migrations",
  "verify-live-restore.sql",
  "Objetos foram recuperados do bundle e validados",
]);

requireSnippets("scripts/dr/run-fixture-drill.sh", [
  "SUPABASE_TELEMETRY_DISABLED",
  "MIGRATION_VERSION",
  "SUPABASE_EXCLUDED_SERVICES",
  'start -x "$SUPABASE_EXCLUDED_SERVICES"',
  "supabase/migrations/${MIGRATION_VERSION}_dr_fixture.sql",
  "supabase_migrations.schema_migrations",
  "fixture não foi aplicada como migration versionada",
  "create-encrypted-backup.sh",
  "restore-encrypted-backup.sh",
  "verify-restore.sql",
  "teste entre tenants",
]);

requireSnippets("scripts/dr/fixture.sql", [
  "alter table public.orders enable row level security",
  "create policy orders_tenant_select",
  "create policy orders_tenant_update",
  "revoke all privileges on table",
  "from anon",
  "from PUBLIC",
  "alter default privileges in schema public",
  "gestify_dr_audit_logs_append_only",
  "Tenant A",
  "Tenant B",
  "revoke all on function public.gestify_core_security_audit()",
]);

if (requireFile("scripts/dr/fixture.sql")) {
  const fixture = readText("scripts/dr/fixture.sql");
  const psqlMetaCommand = fixture
    .split(/\r?\n/)
    .find((line) => line.trimStart().startsWith("\\"));

  if (psqlMetaCommand) {
    fail(
      `scripts/dr/fixture.sql: migration não pode conter meta-comando psql: ${psqlMetaCommand.trim()}`
    );
  }

  const explicitAnonRevoke = /revoke\s+all\s+privileges\s+on\s+table[\s\S]+?from\s+anon\s*;/i;
  const explicitPublicRevoke = /revoke\s+all\s+privileges\s+on\s+table[\s\S]+?from\s+PUBLIC\s*;/;
  const anonDefaultRevoke = /alter\s+default\s+privileges\s+in\s+schema\s+public\s+revoke\s+all\s+privileges\s+on\s+tables\s+from\s+anon\s*;/i;
  const publicDefaultRevoke = /alter\s+default\s+privileges\s+in\s+schema\s+public\s+revoke\s+all\s+privileges\s+on\s+tables\s+from\s+PUBLIC\s*;/;

  if (!explicitAnonRevoke.test(fixture)) {
    fail("scripts/dr/fixture.sql: revogação explícita das tabelas para anon ausente.");
  }
  if (!explicitPublicRevoke.test(fixture)) {
    fail("scripts/dr/fixture.sql: revogação explícita das tabelas para PUBLIC ausente.");
  }
  if (!anonDefaultRevoke.test(fixture)) {
    fail("scripts/dr/fixture.sql: default privileges de anon não estão fechados.");
  }
  if (!publicDefaultRevoke.test(fixture)) {
    fail("scripts/dr/fixture.sql: default privileges de PUBLIC não estão fechados.");
  }
}

requireSnippets("scripts/dr/verify-restore.sql", [
  "request.jwt.claim.sub",
  "Tenant A visualizou",
  "Tenant A alterou pedido do tenant B",
  "Tenant B visualizou",
  "Trigger append-only",
]);

requireSnippets("scripts/dr/verify-live-restore.sql", [
  "tabelas públicas sem RLS",
  "grants anônimos/PUBLIC",
  "gestify_core_security_audit()",
]);

requireSnippets("docs/operations/disaster-recovery.md", [
  "não substitui PITR",
  "runner self-hosted",
  "RESTORE_TO_DISPOSABLE_TARGET",
  "objetos do Storage",
  "RPO",
  "RTO",
]);

if (requireFile("package.json")) {
  const packageJson = JSON.parse(readText("package.json"));
  const expectedScripts = {
    "dr:fixture": "bash scripts/dr/run-fixture-drill.sh",
    "dr:backup": "bash scripts/dr/create-encrypted-backup.sh",
    "dr:restore": "bash scripts/dr/restore-encrypted-backup.sh",
  };

  for (const [name, expected] of Object.entries(expectedScripts)) {
    if (packageJson.scripts?.[name] !== expected) {
      fail(`package.json scripts.${name} deve ser exatamente: ${expected}`);
    }
  }

  if (!String(packageJson.scripts?.["core:security:audit"] ?? "").includes(
    "audit-disaster-recovery.mjs"
  )) {
    fail("package.json scripts.core:security:audit deve executar a auditoria de DR.");
  }

  if (String(packageJson.scripts?.ci ?? "").includes("dr:fixture")) {
    fail("package.json scripts.ci não deve iniciar Docker/Supabase dentro do build da Vercel.");
  }
}

if (requireFile(".github/workflows/disaster-recovery.yml")) {
  const workflow = readText(".github/workflows/disaster-recovery.yml");
  const requiredWorkflowSnippets = [
    "permissions:\n  contents: read",
    "17 4 * * *",
    "47 4 1 1,4,7,10 *",
    "github.ref == 'refs/heads/main'",
    "vars.GESTIFY_DR_ENABLED == 'true'",
    "self-hosted",
    "gestify-dr",
    "environment: disaster-recovery",
    "npm run dr:fixture",
    "bash scripts/dr/create-encrypted-backup.sh",
    "bash scripts/dr/restore-encrypted-backup.sh",
    "restore-report-*.json",
  ];

  for (const snippet of requiredWorkflowSnippets) {
    if (!workflow.includes(snippet)) {
      fail(`disaster-recovery.yml: proteção/etapa obrigatória ausente: ${snippet}`);
    }
  }

  if (workflow.includes("pull_request_target")) {
    fail("disaster-recovery.yml não pode usar pull_request_target com rotinas de backup.");
  }

  for (const line of workflow.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("path:")) continue;
    if (/\.gpg|gestify-dr-created|gestify-dr-downloaded/i.test(trimmed)) {
      fail("disaster-recovery.yml não pode publicar bundles criptografados como artifact do GitHub.");
    }
  }
}

requireSnippets(".gitignore", [
  ".artifacts/",
  ".backups/",
  "*.tar.gz.gpg",
  "*.gpg.sha256",
  "*.gpg.metadata.json",
]);

requireSnippets(".env.example", [
  "GESTIFY_DR_SOURCE_DB_URL=",
  "GESTIFY_DR_BACKUP_PASSPHRASE=",
  "GESTIFY_DR_S3_BUCKET=",
  "GESTIFY_DR_S3_ACCESS_KEY_ID=",
  "GESTIFY_DR_S3_SECRET_ACCESS_KEY=",
  "SUPABASE_STORAGE_S3_ENDPOINT=",
]);

if (failures.length > 0) {
  console.error("[dr-audit] Auditoria reprovada:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

notes.push("drill com fixture isolada e dados fictícios está versionado");
notes.push("fixture é aplicada como migration real e preserva supabase_migrations");
notes.push("fixture é SQL puro, sem meta-comandos psql incompatíveis com migrations");
notes.push("fixture revoga privilégios de anon/PUBLIC atuais e futuros");
notes.push("drill inicia apenas o PostgreSQL necessário e reduz dependências de imagens");
notes.push("backup lógico usa dumps separados de roles, schema, data e histórico");
notes.push("bundle é criptografado antes da cópia off-site e validado por SHA-256");
notes.push("restore externo exige confirmação explícita e destino descartável");
notes.push("rotina real é restrita à main, variável de habilitação e runner self-hosted");
notes.push("GitHub artifacts recebem apenas relatórios, nunca o backup");
notes.push("Storage permanece separado e suas limitações estão documentadas");

console.log("[dr-audit] Auditoria aprovada:");
for (const note of notes) console.log(`- ${note}`);
