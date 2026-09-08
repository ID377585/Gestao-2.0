#!/usr/bin/env node

import process from "node:process";

export function normalizeSupabaseDrDbUrl(rawUrl, projectRef) {
  if (!rawUrl) throw new Error("GESTIFY_DR_SOURCE_DB_URL ausente");

  const url = new URL(rawUrl);
  const hostname = url.hostname.toLowerCase();
  const isSharedPooler = hostname.endsWith(".pooler.supabase.com");

  if (isSharedPooler) {
    // pg_dump/restore must use session mode rather than transaction mode.
    if (!url.port || url.port === "6543") url.port = "5432";

    if (decodeURIComponent(url.username) === "postgres") {
      if (!projectRef) {
        throw new Error(
          "GESTIFY_DR_SOURCE_PROJECT_REF é obrigatório para normalizar usuário do Shared Pooler"
        );
      }
      url.username = `postgres.${projectRef}`;
    }
  }

  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }

  return url.toString();
}

function selfTest() {
  const ref = "abcdefghijklmnopqrst";
  const normalized = normalizeSupabaseDrDbUrl(
    "postgresql://postgres:test-password@aws-1-sa-east-1.pooler.supabase.com:6543/postgres",
    ref
  );
  const parsed = new URL(normalized);

  if (parsed.port !== "5432") throw new Error("self-test: session port não normalizada");
  if (decodeURIComponent(parsed.username) !== `postgres.${ref}`) {
    throw new Error("self-test: usuário do Shared Pooler não normalizado");
  }
  if (parsed.searchParams.get("sslmode") !== "require") {
    throw new Error("self-test: sslmode=require ausente");
  }

  const stronger = normalizeSupabaseDrDbUrl(
    "postgresql://postgres.abcdefghijklmnopqrst:test-password@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full",
    ref
  );
  if (new URL(stronger).searchParams.get("sslmode") !== "verify-full") {
    throw new Error("self-test: sslmode mais forte foi sobrescrito");
  }

  console.log("[dr-db-url] self-test OK");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const [, , rawUrl, projectRef = ""] = process.argv;
  try {
    process.stdout.write(normalizeSupabaseDrDbUrl(rawUrl, projectRef));
  } catch (error) {
    console.error(`[dr-db-url] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
