#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

const deploymentEnvironment = String(process.env.VERCEL_ENV ?? "").trim().toLowerCase();

if (deploymentEnvironment !== "production") {
  console.log(
    `[readiness:deployment] Ambiente ${deploymentEnvironment || "não-Vercel"}; strict de Production não se aplica.`
  );
  process.exit(0);
}

console.log(
  "[readiness:deployment] VERCEL_ENV=production; executando readiness:strict antes do build."
);

const result = spawnSync(
  process.execPath,
  ["scripts/check-production-readiness.mjs", "--strict"],
  {
    stdio: "inherit",
    env: process.env,
  }
);

if (result.error) {
  console.error(
    `[readiness:deployment] Falha ao iniciar validação estrita: ${result.error.message}`
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
