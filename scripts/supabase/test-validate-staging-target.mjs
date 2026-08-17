#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const validatorPath = resolve(
  process.cwd(),
  "scripts/supabase/validate-staging-target.mjs"
);
const tempDirectory = mkdtempSync(join(tmpdir(), "gestify-staging-guard-"));
const projectsPath = join(tempDirectory, "projects.json");
const stagingProjectId = "aaaaaaaaaaaaaaaaaaaa";
const productionProjectId = "bbbbbbbbbbbbbbbbbbbb";

writeFileSync(
  projectsPath,
  JSON.stringify(
    [
      {
        id: stagingProjectId,
        name: "gestify-staging",
        region: "sa-east-1",
      },
      {
        id: productionProjectId,
        name: "gestify-production",
        region: "sa-east-1",
      },
    ],
    null,
    2
  )
);

const baseEnv = {
  ...process.env,
  TARGET_ENVIRONMENT: "staging",
  GITHUB_ENVIRONMENT: "staging",
  STAGING_PROJECT_ID: stagingProjectId,
  PRODUCTION_PROJECT_ID: productionProjectId,
  STAGING_PROJECT_NAME: "gestify-staging",
  STAGING_EXPECTED_REGION: "sa-east-1",
  STAGING_SUPABASE_URL: `https://${stagingProjectId}.supabase.co`,
};

function runCase(name, { args = [], env = {}, expectSuccess }) {
  const result = spawnSync(
    process.execPath,
    [validatorPath, "--projects-json", projectsPath, ...args],
    {
      cwd: process.cwd(),
      env: { ...baseEnv, ...env },
      encoding: "utf8",
    }
  );

  const succeeded = result.status === 0;
  if (succeeded !== expectSuccess) {
    console.error(`[staging-guard-test] Caso falhou: ${name}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
}

try {
  runCase("plano válido", {
    args: ["--action", "plan"],
    expectSuccess: true,
  });

  runCase("staging igual à produção", {
    args: ["--action", "plan"],
    env: { PRODUCTION_PROJECT_ID: stagingProjectId },
    expectSuccess: false,
  });

  runCase("URL aponta para outro projeto", {
    args: ["--action", "plan"],
    env: {
      STAGING_SUPABASE_URL: "https://cccccccccccccccccccc.supabase.co",
    },
    expectSuccess: false,
  });

  runCase("apply sem confirmação", {
    args: ["--action", "apply"],
    expectSuccess: false,
  });

  runCase("apply confirmado", {
    args: [
      "--action",
      "apply",
      "--confirmation",
      `apply:gestify-staging:${stagingProjectId}`,
    ],
    expectSuccess: true,
  });

  runCase("região divergente", {
    args: ["--action", "plan"],
    env: { STAGING_EXPECTED_REGION: "us-east-1" },
    expectSuccess: false,
  });

  console.log("[staging-guard-test] OK. Todos os cenários passaram.");
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
