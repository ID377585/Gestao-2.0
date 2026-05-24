#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import process from "node:process";

const ROOT = resolve(process.cwd());
const SOURCE_DIRS = ["src/app", "src/lib", "src/server"].map((dir) =>
  join(ROOT, dir)
);

const WRITE_METHODS = [
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
  ".rpc(",
];

const TENANT_ID_TOKENS = [
  "establishmentId",
  "establishment_id",
  "productId",
  "product_id",
  "orderId",
  "order_id",
  "invoiceId",
  "invoice_id",
  "technicalSheetId",
  "technical_sheet_id",
  "supplierId",
  "supplier_id",
];

const SAFE_TENANT_GUARD_TOKENS = [
  "getActiveMembershipOrRedirect",
  "getAuthenticatedTenantUserOrThrow",
  "getScopeId(ctx)",
  ".eq(\"establishment_id\"",
  ".eq('establishment_id'",
  "establishment_id:",
  "p_establishment_id",
];

const SERVER_ADMIN_TOKENS = [
  "createSupabaseAdminClient",
  "getSupabaseAdminClient",
  "supabaseAdmin",
];

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
]);

const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
    failOnFindings: argv.includes("--fail-on-findings"),
  };
}

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index >= 0 ? path.slice(index) : "";
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (stat.isFile() && FILE_EXTENSIONS.has(extensionOf(fullPath))) {
      files.push(fullPath);
    }
  }

  return files;
}

function includesAny(content, tokens) {
  return tokens.some((token) => content.includes(token));
}

function contextAround(lines, lineIndex, radius = 18) {
  const start = Math.max(0, lineIndex - radius);
  const end = Math.min(lines.length, lineIndex + radius + 1);
  return lines.slice(start, end).join("\n");
}

function classifyRisk(context) {
  const hasWrite = includesAny(context, WRITE_METHODS);
  const hasTenantId = includesAny(context, TENANT_ID_TOKENS);
  const hasTenantGuard = includesAny(context, SAFE_TENANT_GUARD_TOKENS);
  const usesAdmin = includesAny(context, SERVER_ADMIN_TOKENS);

  if (!hasWrite || !hasTenantId) return null;
  if (usesAdmin && !hasTenantGuard) return "high";
  if (!hasTenantGuard) return "medium";
  return "review";
}

function auditFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, index) => {
    const hasWrite = WRITE_METHODS.some((method) => line.includes(method));
    const hasTenantId = TENANT_ID_TOKENS.some((token) => line.includes(token));

    if (!hasWrite && !hasTenantId) return;

    const context = contextAround(lines, index);
    const risk = classifyRisk(context);
    if (!risk) return;

    findings.push({
      file: relative(ROOT, filePath),
      line: index + 1,
      risk,
      sample: line.trim(),
      reason:
        risk === "high"
          ? "Uso de cliente admin/service role próximo de ID de tenant sem guarda de tenant claramente detectada."
          : risk === "medium"
            ? "Escrita ou RPC próxima de ID sensível sem guarda de tenant claramente detectada."
            : "Escrita/RPC com guarda aparente; revisar manualmente para confirmar escopo ativo.",
    });
  });

  return findings;
}

const args = parseArgs(process.argv.slice(2));
const files = SOURCE_DIRS.flatMap((dir) => walk(dir));
const findings = files.flatMap((file) => auditFile(file));
const summary = findings.reduce(
  (acc, finding) => {
    acc.total += 1;
    acc[finding.risk] = (acc[finding.risk] ?? 0) + 1;
    return acc;
  },
  { total: 0, high: 0, medium: 0, review: 0 }
);

const payload = { summary, findings };

if (args.json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("[tenant-write-audit] Resumo:");
  console.log(`- total=${summary.total}`);
  console.log(`- high=${summary.high}`);
  console.log(`- medium=${summary.medium}`);
  console.log(`- review=${summary.review}`);

  for (const finding of findings) {
    console.log(
      `\n[${finding.risk.toUpperCase()}] ${finding.file}:${finding.line}\n` +
        `  ${finding.sample}\n` +
        `  ${finding.reason}`
    );
  }
}

if (args.failOnFindings && (summary.high > 0 || summary.medium > 0)) {
  process.exit(2);
}
