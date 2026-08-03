#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const TABLES = ["orders", "order_status_events"];
const FUNCTIONS = [
  "advance_order_status",
  "cancel_order",
  "reopen_order",
  "gestify_ensure_stock_balance_for_product",
  "claim_app_jobs",
];

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {
    baselinePath: "",
    failOnWorse: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--baseline") {
      args.baselinePath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--baseline=")) {
      args.baselinePath = arg.slice("--baseline=".length);
      continue;
    }

    if (arg === "--fail-on-worse") {
      args.failOnWorse = true;
      continue;
    }

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    throw new Error(`Argumento desconhecido: ${arg}`);
  }

  return args;
}

function loadBaseline(filePath) {
  if (!filePath) return null;

  const resolvedPath = resolve(process.cwd(), filePath);
  return JSON.parse(readFileSync(resolvedPath, "utf8"));
}

function loadEnv() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [];

  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    throw new Error(`[order-rls-audit] ENV ausente: ${missing.join(", ")}.`);
  }

  return { supabaseUrl, serviceRoleKey };
}

function roleList(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? "")
    .replace(/[{}]/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function countByCommand(policies) {
  return policies.reduce((acc, policy) => {
    const command = String(policy.cmd ?? "UNKNOWN");
    acc[command] = (acc[command] ?? 0) + 1;
    return acc;
  }, {});
}

function hasPublicExposure(roles) {
  const normalized = roleList(roles).map((role) => role.toLowerCase());
  return normalized.includes("anon") || normalized.includes("public");
}

function missingSnippets(definition, snippets) {
  return snippets.filter((snippet) => !String(definition).includes(snippet));
}

function formatCounts(counts) {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cmd, count]) => `${cmd}=${count}`)
    .join(", ");
}

const args = parseArgs(process.argv.slice(2));
const baseline = loadBaseline(args.baselinePath);
const { supabaseUrl, serviceRoleKey } = loadEnv();
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { data: auditPayload, error: auditError } = await supabase.rpc(
  "gestify_order_rls_audit"
);

if (auditError) {
  console.error(
    `[order-rls-audit] RPC gestify_order_rls_audit falhou: ${auditError.message}`
  );
  console.error(
    "[order-rls-audit] Aplique as migrations Supabase antes de rodar esta auditoria."
  );
  process.exit(1);
}

const policies = Array.isArray(auditPayload?.policies)
  ? auditPayload.policies
  : [];
const functions = Array.isArray(auditPayload?.functions)
  ? auditPayload.functions
  : [];

const findings = [];
const tableSummaries = {};

for (const table of TABLES) {
  const tablePolicies = (policies ?? []).filter(
    (policy) => String(policy.tablename) === table
  );
  const counts = countByCommand(tablePolicies);
  const baselineTable = baseline?.tables?.[table] ?? null;

  tableSummaries[table] = {
    total: tablePolicies.length,
    byCommand: counts,
  };

  for (const policy of tablePolicies) {
    if (hasPublicExposure(policy.roles)) {
      findings.push({
        severity: "high",
        table,
        message: `Policy ${policy.policyname} está exposta a anon/public.`,
      });
    }
  }

  if (args.failOnWorse && baselineTable) {
    if (tablePolicies.length > baselineTable.maxPolicies) {
      findings.push({
        severity: "medium",
        table,
        message: `${table} possui ${tablePolicies.length} policies; baseline permite ${baselineTable.maxPolicies}.`,
      });
    }

    for (const [command, maxCount] of Object.entries(
      baselineTable.maxByCommand ?? {}
    )) {
      if ((counts[command] ?? 0) > Number(maxCount)) {
        findings.push({
          severity: "medium",
          table,
          message: `${table}.${command} possui ${counts[command]} policies; baseline permite ${maxCount}.`,
        });
      }
    }
  }
}

for (const fn of functions ?? []) {
  if (String(fn.security_definer) !== "true" && fn.function_name !== "claim_app_jobs") {
    findings.push({
      severity: "medium",
      function: fn.function_name,
      message: `${fn.function_name} deixou de ser SECURITY DEFINER; revise o contrato antes de publicar.`,
    });
  }

  if (hasPublicExposure(fn.executable_by)) {
    findings.push({
      severity: "high",
      function: fn.function_name,
      message: `${fn.function_name} está executável por anon/public.`,
    });
  }

  const requiredSnippets =
    baseline?.requiredFunctions?.[String(fn.function_name)] ?? [];
  const missing = missingSnippets(fn.definition, requiredSnippets);

  if (missing.length > 0) {
    findings.push({
      severity: "high",
      function: fn.function_name,
      message: `${fn.function_name} perdeu validações obrigatórias: ${missing.join(", ")}.`,
    });
  }
}

const result = {
  ok: findings.length === 0,
  tables: tableSummaries,
  findings,
};

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("[order-rls-audit] Matriz atual:");
  for (const [table, summary] of Object.entries(tableSummaries)) {
    console.log(
      `- ${table}: total=${summary.total}; ${formatCounts(summary.byCommand)}`
    );
  }

  if (findings.length === 0) {
    console.log("[order-rls-audit] OK. Nenhuma regressão encontrada.");
  } else {
    console.error("[order-rls-audit] Achados:");
    for (const finding of findings) {
      console.error(
        `- [${finding.severity}] ${finding.table ?? finding.function}: ${finding.message}`
      );
    }
  }
}

if (findings.length > 0) {
  process.exit(1);
}
