#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

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
    apply: false,
    establishmentId: "",
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--apply") {
      args.apply = true;
      continue;
    }

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (arg === "--establishment-id") {
      args.establishmentId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--establishment-id=")) {
      args.establishmentId = arg.slice("--establishment-id=".length);
      continue;
    }

    throw new Error(`Argumento desconhecido: ${arg}`);
  }

  return args;
}

function printUsage() {
  console.log(`Uso:
  npm run supabase:legacy-tenant:audit
  npm run supabase:legacy-tenant:audit -- --establishment-id <uuid>
  npm run supabase:legacy-tenant:backfill -- --establishment-id <uuid>

Por padrão, o script só audita. Use --apply para gravar o backfill.`);
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
    throw new Error(`[legacy-tenant] ENV ausente: ${missing.join(", ")}.`);
  }

  return { supabaseUrl, serviceRoleKey };
}

function getTables(payload) {
  return Array.isArray(payload?.tables) ? payload.tables : [];
}

function printTableSummary(payload) {
  const tables = getTables(payload);
  const rows = tables.map((table) => ({
    table: String(table.table ?? ""),
    nullRows: Number(table.null_establishment_rows ?? table.missing_before ?? 0),
    updated: Number(table.updated ?? 0),
  }));

  const totalNullRows = rows.reduce((sum, row) => sum + row.nullRows, 0);
  const totalUpdated = rows.reduce((sum, row) => sum + row.updated, 0);

  console.log("[legacy-tenant] Resumo por tabela:");

  for (const row of rows) {
    const updatedText = row.updated ? `, atualizadas=${row.updated}` : "";
    console.log(`- ${row.table}: sem empresa=${row.nullRows}${updatedText}`);
  }

  console.log(
    `[legacy-tenant] Total sem empresa=${totalNullRows}, total atualizado=${totalUpdated}.`
  );
}

function isMissingRpcError(error) {
  const message = String(error?.message ?? "");
  return (
    message.includes("Could not find the function") ||
    message.includes("schema cache")
  );
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

if (args.apply && !args.establishmentId) {
  console.error(
    "[legacy-tenant] --apply exige --establishment-id <uuid> para evitar backfill acidental."
  );
  process.exit(1);
}

const { supabaseUrl, serviceRoleKey } = loadEnv();
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const rpcName = args.establishmentId
  ? "gestify_backfill_legacy_tenant"
  : "gestify_legacy_tenant_null_counts";
const rpcParams = args.establishmentId
  ? {
      p_establishment_id: args.establishmentId,
      p_dry_run: !args.apply,
    }
  : undefined;

const { data, error } = await supabase.rpc(rpcName, rpcParams);

if (error) {
  if (isMissingRpcError(error)) {
    console.error(
      `[legacy-tenant] RPC ${rpcName} não encontrada. Aplique as migrations Supabase antes de auditar/backfillar.`
    );
  } else {
    console.error(`[legacy-tenant] RPC ${rpcName} falhou: ${error.message}`);
  }

  process.exit(1);
}

if (args.json) {
  console.log(JSON.stringify(data, null, 2));
} else {
  if (args.establishmentId) {
    console.log(
      `[legacy-tenant] Backfill ${args.apply ? "aplicado" : "simulado"} para ${args.establishmentId}.`
    );
  } else {
    console.log("[legacy-tenant] Auditoria de linhas legadas sem empresa.");
  }

  printTableSummary(data);
}

const hasNullRows = getTables(data).some((table) => {
  return Number(table.null_establishment_rows ?? table.missing_before ?? 0) > 0;
});

if (hasNullRows && !args.apply) {
  console.error(
    "[legacy-tenant] Ainda existem linhas sem empresa. Rode o backfill com --apply após validar o establishment correto."
  );
  process.exit(2);
}
