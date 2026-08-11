#!/usr/bin/env node

import { readFileSync } from "node:fs";
import process from "node:process";

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const VALID_ACTIONS = new Set(["plan", "apply", "verify"]);

function fail(message) {
  console.error(`[staging-guard] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    action: "plan",
    confirmation: "",
    projectsJson: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--action") {
      args.action = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--action=")) {
      args.action = arg.slice("--action=".length);
      continue;
    }

    if (arg === "--confirmation") {
      args.confirmation = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--confirmation=")) {
      args.confirmation = arg.slice("--confirmation=".length);
      continue;
    }

    if (arg === "--projects-json") {
      args.projectsJson = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--projects-json=")) {
      args.projectsJson = arg.slice("--projects-json=".length);
      continue;
    }

    fail(`Argumento desconhecido: ${arg}`);
  }

  return args;
}

function requiredEnv(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) fail(`Variável obrigatória ausente: ${name}.`);
  return value;
}

function readProjects(filePath) {
  if (!filePath) return [];

  let payload;
  try {
    payload = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Não foi possível ler ${filePath}: ${error.message}`);
  }

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.projects)) return payload.projects;
  if (Array.isArray(payload?.data)) return payload.data;

  fail("A saída de `supabase projects list --output json` não contém uma lista reconhecível.");
}

function projectRef(project) {
  return String(
    project?.ref ?? project?.id ?? project?.project_ref ?? project?.projectRef ?? ""
  ).trim();
}

function projectName(project) {
  return String(project?.name ?? project?.project_name ?? "").trim();
}

function projectRegion(project) {
  return String(project?.region ?? project?.database?.region ?? "").trim();
}

function validateProjectUrl(rawUrl, expectedRef) {
  if (!rawUrl) return;

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail("STAGING_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL não é uma URL válida.");
  }

  if (url.protocol !== "https:") {
    fail("A URL do Supabase de staging precisa usar HTTPS.");
  }

  const hostname = url.hostname.toLowerCase();
  const suffix = ".supabase.co";

  if (hostname.endsWith(suffix)) {
    const urlProjectRef = hostname.slice(0, -suffix.length);
    if (urlProjectRef !== expectedRef) {
      fail("A URL de staging aponta para um project ref diferente de STAGING_PROJECT_ID.");
    }
    return;
  }

  if (String(process.env.STAGING_CUSTOM_DOMAIN_CONFIRMED ?? "").toLowerCase() !== "true") {
    fail(
      "A URL usa domínio personalizado. Defina STAGING_CUSTOM_DOMAIN_CONFIRMED=true somente após validar o vínculo com o projeto de staging."
    );
  }
}

const args = parseArgs(process.argv.slice(2));
if (!VALID_ACTIONS.has(args.action)) {
  fail(`Ação inválida: ${args.action}. Use plan, apply ou verify.`);
}

const targetEnvironment = requiredEnv("TARGET_ENVIRONMENT").toLowerCase();
if (targetEnvironment !== "staging") {
  fail("TARGET_ENVIRONMENT precisa ser exatamente staging.");
}

const githubEnvironment = String(process.env.GITHUB_ENVIRONMENT ?? "").trim();
if (githubEnvironment && githubEnvironment.toLowerCase() !== "staging") {
  fail("GITHUB_ENVIRONMENT precisa ser exatamente staging.");
}

const stagingProjectId = requiredEnv("STAGING_PROJECT_ID");
const productionProjectId = requiredEnv("PRODUCTION_PROJECT_ID");
const expectedProjectName = String(
  process.env.STAGING_PROJECT_NAME ?? "gestify-staging"
).trim();
const expectedRegion = String(
  process.env.STAGING_EXPECTED_REGION ?? "sa-east-1"
).trim();

if (!PROJECT_REF_PATTERN.test(stagingProjectId)) {
  fail("STAGING_PROJECT_ID não possui o formato esperado de project ref do Supabase.");
}

if (!PROJECT_REF_PATTERN.test(productionProjectId)) {
  fail("PRODUCTION_PROJECT_ID não possui o formato esperado de project ref do Supabase.");
}

if (stagingProjectId === productionProjectId) {
  fail("O projeto de staging não pode ser o mesmo projeto de produção.");
}

if (!expectedProjectName) {
  fail("STAGING_PROJECT_NAME não pode ficar vazio.");
}

const stagingUrl = String(
  process.env.STAGING_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
).trim();
validateProjectUrl(stagingUrl, stagingProjectId);

const projects = readProjects(args.projectsJson);
if (args.projectsJson) {
  const project = projects.find((candidate) => projectRef(candidate) === stagingProjectId);
  if (!project) {
    fail("STAGING_PROJECT_ID não foi encontrado na organização acessível pelo token informado.");
  }

  const actualName = projectName(project);
  if (actualName && actualName !== expectedProjectName) {
    fail(
      `O projeto ${stagingProjectId} se chama ${actualName}; esperado ${expectedProjectName}.`
    );
  }

  const actualRegion = projectRegion(project);
  if (expectedRegion && actualRegion && actualRegion !== expectedRegion) {
    fail(
      `O projeto ${stagingProjectId} está em ${actualRegion}; esperado ${expectedRegion}.`
    );
  }
}

const expectedConfirmation = `apply:${expectedProjectName}:${stagingProjectId}`;
if (args.action === "apply" && args.confirmation !== expectedConfirmation) {
  fail(`Confirmação inválida. Use exatamente: ${expectedConfirmation}`);
}

const summary = {
  ok: true,
  action: args.action,
  targetEnvironment,
  stagingProjectId,
  productionProjectId,
  expectedProjectName,
  expectedRegion,
  stagingUrlValidated: Boolean(stagingUrl),
  organizationInventoryValidated: Boolean(args.projectsJson),
  applyConfirmed: args.action === "apply",
};

console.log(`[staging-guard] OK: ${JSON.stringify(summary)}`);
