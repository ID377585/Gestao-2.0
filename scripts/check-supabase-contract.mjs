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

function isMissingRpcError(error) {
  const message = String(error?.message ?? "");
  return (
    message.includes("Could not find the function") ||
    message.includes("schema cache")
  );
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [];

if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

if (missing.length > 0) {
  console.error(`[supabase-contract] ENV ausente: ${missing.join(", ")}.`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function runContract(rpcName, label) {
  const { data, error } = await supabase.rpc(rpcName);

  if (error) {
    console.error(`[supabase-contract] RPC ${rpcName} falhou: ${error.message}`);

    if (isMissingRpcError(error)) {
      console.error(
        `[supabase-contract] Aplique as migrations Supabase antes de validar ${label}.`
      );
    }

    process.exit(1);
  }

  if (!data?.ok) {
    console.error(`[supabase-contract] ${label} inválido:`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`[supabase-contract] ${label} OK.`);
  return data;
}

await runContract("gestify_contract_check", "Contrato funcional Supabase");
const securityContract = await runContract(
  "gestify_core_security_audit",
  "Contrato de segurança Gestify Core"
);

console.log(
  `[supabase-contract] Core ${securityContract.contract_version ?? "desconhecido"}; ` +
    `buckets públicos permitidos=${JSON.stringify(
      securityContract.allowed_public_buckets ?? []
    )}.`
);
