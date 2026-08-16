#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const envFileArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--env-file="));
const envFile = envFileArg ? envFileArg.slice("--env-file=".length) : ".env.local";

const requiredProductionEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "CRON_SECRET",
  "FISCAL_SYNC_SECRET",
  "JOB_WORKER_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_APP_URL",
];

const modernAdminEnv = ["SUPABASE_SECRET_KEY"];

const recommendedProductionEnv = [
  "ALERTS_FROM_EMAIL",
  "ALERTS_CRON_SECRET",
  "GESTIFY_ALLOWED_CORS_ORIGINS",
  "LEAD_IP_HASH_SALT",
];

const requiredExampleKeys = [
  ...requiredProductionEnv,
  ...recommendedProductionEnv,
  "SUPABASE_SECRET_KEY",
  "GESTIFY_NEW_SIGNUPS_ENABLED",
  "GESTIFY_SECURITY_HARDENING_CONFIRMED",
  "GESTIFY_ALERT_EMAIL_QUEUE_ENABLED",
];

const checks = [];

function readText(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function addCheck(name, ok, detail, severity = "error") {
  checks.push({ name, ok, detail, severity });
}

function parseEnvFile(path) {
  const fullPath = resolve(process.cwd(), path);
  if (!existsSync(fullPath)) return {};

  const env = {};
  for (const line of readFileSync(fullPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index < 0) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }

  return env;
}

const envExamplePath = ".env.example";
const envExampleExists = existsSync(resolve(process.cwd(), envExamplePath));
const envExample = parseEnvFile(envExamplePath);
const localEnv = parseEnvFile(envFile);
const packageJson = readJson("package.json");
const vercelJson = readJson("vercel.json");
const nextConfig = readText("next.config.js");

if (!envExampleExists) {
  addCheck(
    ".env.example disponível",
    false,
    "Arquivo não incluído no pacote atual; em Vercel isso pode ser causado por .vercelignore.",
    "warning"
  );
} else {
  for (const key of requiredExampleKeys) {
    addCheck(
      `.env.example inclui ${key}`,
      Object.prototype.hasOwnProperty.call(envExample, key),
      "Variável documentada para configuração por ambiente."
    );
  }
}

for (const key of requiredProductionEnv) {
  addCheck(
    `${envFile} define ${key}`,
    Boolean(localEnv[key] || process.env[key]),
    "Obrigatória em Production. No CI, valide com variáveis reais do ambiente."
  );
}

addCheck(
  `${envFile} define SUPABASE_SECRET_KEY`,
  modernAdminEnv.some((key) => Boolean(localEnv[key] || process.env[key])),
  "Defina a credencial server-side canônica SUPABASE_SECRET_KEY. Aliases antigos e chaves JWT legadas não são aceitos."
);

for (const key of recommendedProductionEnv) {
  addCheck(
    `${envFile} recomenda ${key}`,
    Boolean(localEnv[key] || process.env[key]),
    "Recomendada para operação comercial e observabilidade.",
    "warning"
  );
}

const publicSecretNames = Object.keys({ ...envExample, ...localEnv }).filter(
  (key) =>
    key.startsWith("NEXT_PUBLIC_") &&
    /(SECRET|SERVICE_ROLE|PRIVATE|TOKEN|PASSWORD)/i.test(key)
);

addCheck(
  "Nenhum segredo sensível usa NEXT_PUBLIC_",
  publicSecretNames.length === 0,
  publicSecretNames.length
    ? `Revise: ${publicSecretNames.join(", ")}`
    : "A publishable key do Supabase é pública; credenciais administrativas ficam server-side."
);

addCheck(
  "Chaves Supabase JWT legadas não são requisito de runtime",
  !Object.prototype.hasOwnProperty.call(envExample, "SUPABASE_SERVICE_ROLE_KEY") &&
    !Object.prototype.hasOwnProperty.call(envExample, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  "O Gestify deve operar apenas com publishable/secret keys modernas."
);

addCheck(
  "package.json fixa Node 22.x",
  packageJson.engines?.node === "22.x",
  "Vercel, CI e desenvolvimento devem usar o mesmo runtime."
);

for (const nodeFile of [".nvmrc", ".node-version"]) {
  addCheck(
    `${nodeFile} fixa Node 22`,
    existsSync(resolve(process.cwd(), nodeFile)) &&
      readText(nodeFile).trim().startsWith("22"),
    "Ajuda a evitar runtime local diferente da Vercel/CI."
  );
}

addCheck(
  "Vercel usa npm run ci no build",
  vercelJson.buildCommand === "npm run ci",
  "Build de produção deve executar validações antes de gerar o app."
);

const cronPaths = new Set((vercelJson.crons ?? []).map((cron) => cron.path));
addCheck(
  "Cron fiscal configurado",
  cronPaths.has("/api/fiscal/sync"),
  "Sincronização fiscal deve ser executada por cron protegido."
);
addCheck(
  "Cron do worker de jobs configurado",
  cronPaths.has("/api/jobs/process"),
  "Fila precisa de processamento periódico para e-mails e tarefas assíncronas.",
  "warning"
);

for (const headerName of [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-Frame-Options",
]) {
  addCheck(
    `Header ${headerName} configurado`,
    nextConfig.includes(headerName),
    "Header de segurança esperado no Next.js."
  );
}

addCheck(
  "Novos cadastros permanecem congelados",
  localEnv.GESTIFY_NEW_SIGNUPS_ENABLED !== "true",
  "Mantenha false até staging, RLS consolidado e teste de restore.",
  "warning"
);

addCheck(
  "Hardening comercial não está confirmado prematuramente",
  localEnv.GESTIFY_SECURITY_HARDENING_CONFIRMED !== "true",
  "Só marque true após concluir a matriz de prontidão comercial.",
  "warning"
);

const failed = checks.filter((check) => !check.ok && check.severity === "error");
const warnings = checks.filter((check) => !check.ok && check.severity === "warning");

console.log("[readiness] Resultado:");
for (const check of checks) {
  const marker = check.ok ? "OK" : check.severity === "warning" ? "WARN" : "FAIL";
  console.log(`- [${marker}] ${check.name}: ${check.detail}`);
}

console.log(
  `[readiness] Resumo: total=${checks.length}; failed=${failed.length}; warnings=${warnings.length}`
);

if (strict && failed.length > 0) {
  process.exit(1);
}
