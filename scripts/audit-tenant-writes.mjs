#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
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
  "assertSameEstablishment",
  "getCollaboratorMembershipOrThrow",
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
  const valueAfter = (name) => {
    const index = argv.indexOf(name);
    if (index < 0) return null;
    return argv[index + 1] ?? null;
  };

  return {
    json: argv.includes("--json"),
    quiet: argv.includes("--quiet"),
    failOnFindings: argv.includes("--fail-on-findings"),
    baselinePath: valueAfter("--baseline"),
    updateBaselinePath: valueAfter("--update-baseline"),
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

function findingKey(finding) {
  return [finding.risk, finding.file, finding.sample].join("::");
}

function readBaseline(filePath) {
  if (!filePath) return new Set();
  const absolutePath = resolve(ROOT, filePath);
  if (!existsSync(absolutePath)) return new Set();

  const parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  const accepted =
    Array.isArray(parsed?.accepted) ? parsed.accepted :
    Array.isArray(parsed?.findings) ? parsed.findings.map(findingKey) :
    [];

  return new Set(accepted.map(String));
}

function writeBaseline(filePath, findings) {
  const absolutePath = resolve(ROOT, filePath);
  const accepted = [...new Set(findings.map(findingKey))].sort();

  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(
    absolutePath,
    JSON.stringify(
      {
        version: 1,
        generated_at: new Date().toISOString(),
        accepted,
      },
      null,
      2,
    ) + "\n",
  );
}

const args = parseArgs(process.argv.slice(2));
const files = SOURCE_DIRS.flatMap((dir) => walk(dir));
const findings = files.flatMap((file) => auditFile(file));
const baseline = readBaseline(args.baselinePath);
const annotatedFindings = findings.map((finding) => ({
  ...finding,
  baselineAccepted: baseline.has(findingKey(finding)),
}));
const summary = findings.reduce(
  (acc, finding) => {
    acc.total += 1;
    acc[finding.risk] = (acc[finding.risk] ?? 0) + 1;
    return acc;
  },
  { total: 0, high: 0, medium: 0, review: 0, newHigh: 0, newMedium: 0 }
);
const actionableFindings = annotatedFindings.filter(
  (finding) =>
    !finding.baselineAccepted &&
    (finding.risk === "high" || finding.risk === "medium")
);

summary.newHigh = actionableFindings.filter(
  (finding) => finding.risk === "high"
).length;
summary.newMedium = actionableFindings.filter(
  (finding) => finding.risk === "medium"
).length;

if (args.updateBaselinePath) {
  writeBaseline(args.updateBaselinePath, findings);
}

const payload = { summary, findings: annotatedFindings };

if (args.json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("[tenant-write-audit] Resumo:");
  console.log(`- total=${summary.total}`);
  console.log(`- high=${summary.high}`);
  console.log(`- medium=${summary.medium}`);
  console.log(`- review=${summary.review}`);
  if (args.baselinePath) {
    console.log(`- newHigh=${summary.newHigh}`);
    console.log(`- newMedium=${summary.newMedium}`);
  }
  if (args.updateBaselinePath) {
    console.log(`- baseline=${args.updateBaselinePath}`);
  }

  const findingsToPrint = args.quiet
    ? annotatedFindings.filter((finding) => !finding.baselineAccepted)
    : annotatedFindings;

  for (const finding of findingsToPrint) {
    console.log(
      `\n[${finding.risk.toUpperCase()}${
        finding.baselineAccepted ? " baseline" : ""
      }] ${finding.file}:${finding.line}\n` +
        `  ${finding.sample}\n` +
        `  ${finding.reason}`
    );
  }

  if (args.quiet && findingsToPrint.length < annotatedFindings.length) {
    console.log(
      `\n[tenant-write-audit] ${annotatedFindings.length - findingsToPrint.length} achados baseline omitidos no modo quiet.`
    );
  }
}

if (args.failOnFindings && (summary.newHigh > 0 || summary.newMedium > 0)) {
  process.exit(2);
}
