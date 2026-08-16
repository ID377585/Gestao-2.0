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

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const adminKey =
  process.env.SUPABASE_SECRET_KEY_PREVIEW ??
  process.env.SUPABASE_SECRET_KEY_NEW ??
  process.env.SUPABASE_SECRET_KEY;

const missing = [];

if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!adminKey) missing.push("SUPABASE_SECRET_KEY");

if (missing.length > 0) {
  console.error(`[supabase-contract] ENV ausente: ${missing.join(", ")}.`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, adminKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { data, error } = await supabase.rpc("gestify_contract_check");

if (error) {
  console.error(
    `[supabase-contract] RPC gestify_contract_check falhou: ${error.message}`
  );

  if (
    String(error.message ?? "").includes("Could not find the function") ||
    String(error.message ?? "").includes("schema cache")
  ) {
    console.error(
      "[supabase-contract] Aplique as migrations Supabase antes de rodar o contrato neste banco."
    );
  }

  process.exit(1);
}

if (!data?.ok) {
  console.error("[supabase-contract] Contrato Supabase inválido:");
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log("[supabase-contract] Contrato Supabase OK.");
