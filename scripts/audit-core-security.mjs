#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const notes = [];

function addFailure(message) {
  failures.push(message);
}

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assertFileContains(path, snippets) {
  if (!existsSync(resolve(root, path))) {
    addFailure(`${path}: arquivo obrigatório ausente.`);
    return;
  }

  const source = readText(path);
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      addFailure(`${path}: conteúdo obrigatório ausente: ${snippet}`);
    }
  }
}

function walkFiles(directory) {
  const absolute = resolve(root, directory);
  if (!existsSync(absolute)) return [];

  const files = [];
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...walkFiles(relative(root, path)));
    } else {
      files.push(path);
    }
  }

  return files;
}

if (existsSync(resolve(root, "update-user-password.js"))) {
  addFailure(
    "update-user-password.js não pode existir no repositório; use uma operação administrativa auditada e server-side."
  );
}

const supabaseTemp = resolve(root, "supabase/.temp");
if (existsSync(supabaseTemp) && readdirSync(supabaseTemp).length > 0) {
  addFailure("supabase/.temp contém arquivos rastreáveis; remova-os do Git.");
}

const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const executableFiles = [
  ...walkFiles("src"),
  ...readdirSync(root)
    .map((entry) => resolve(root, entry))
    .filter((path) => {
      try {
        return statSync(path).isFile() && sourceExtensions.has(extname(path));
      } catch {
        return false;
      }
    }),
].filter((path) => sourceExtensions.has(extname(path)));

const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
const publicSecretPattern =
  /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)/;
const hardcodedPasswordPattern =
  /(?:newPassword|password)\s*[:=]\s*["'][^"'\n]{8,}["']/i;

for (const absolutePath of executableFiles) {
  const path = relative(root, absolutePath).replaceAll("\\", "/");
  const source = readFileSync(absolutePath, "utf8");

  if (jwtPattern.test(source)) {
    addFailure(`${path}: possível JWT/chave hardcoded encontrado.`);
  }

  if (publicSecretPattern.test(source)) {
    addFailure(`${path}: segredo potencial exposto por variável NEXT_PUBLIC_*.`);
  }

  if (hardcodedPasswordPattern.test(source)) {
    addFailure(`${path}: possível senha hardcoded encontrada.`);
  }

  const isClientModule = /^\s*["']use client["'];?/m.test(source);
  if (isClientModule && source.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    addFailure(`${path}: service role referenciada em módulo client-side.`);
  }
}

assertFileContains(".gitignore", [".env.*", "supabase/.temp/", ".vercel"]);
assertFileContains(".vercelignore", [".env.*", "!.env.example"]);
assertFileContains(".env.example", [
  "SUPABASE_SERVICE_ROLE_KEY=",
  "CRON_SECRET=",
  "FISCAL_SYNC_SECRET=",
  "JOB_WORKER_SECRET=",
  "NUTRITION_CRON_SECRET=",
  "OPERATIONAL_READINESS_SECRET=",
]);

assertFileContains("src/app/entradas/page.tsx", [
  'redirect("/dashboard/entradas")',
]);

if (existsSync(resolve(root, "src/app/entradas/page.tsx"))) {
  const legacyEntradas = readText("src/app/entradas/page.tsx");
  if (legacyEntradas.includes("use client") || legacyEntradas.includes("supabase")) {
    addFailure(
      "src/app/entradas/page.tsx deve apenas redirecionar para a rota protegida /dashboard/entradas."
    );
  }
}

assertFileContains(
  "supabase/migrations/20260810170000_harden_nutrition_notification_rpc.sql",
  [
    "nutrition module access denied",
    "notification target is outside establishment",
    "created_by",
    "revoke all on function public.enqueue_nutrition_notification",
  ]
);

assertFileContains(
  "supabase/migrations/20260810172000_revoke_anon_nutrition_privileges.sql",
  [
    "revoke all privileges on table",
    "from anon",
    "nutrition\\_%",
  ]
);

assertFileContains(
  "supabase/migrations/20260810173500_make_technical_sheets_bucket_private.sql",
  ["set public = false", "technical-sheets"]
);

const packageJson = JSON.parse(readText("package.json"));
if (packageJson.engines?.node !== "22.x") {
  addFailure("package.json deve fixar engines.node em 22.x.");
}
if (!String(packageJson.scripts?.ci ?? "").includes("core:security:audit")) {
  addFailure("package.json scripts.ci deve executar core:security:audit.");
}

if (failures.length > 0) {
  console.error("[core-security] Auditoria reprovada:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

notes.push("segredos não aparecem hardcoded no código executável verificado");
notes.push("rota legada /entradas não acessa o Supabase diretamente");
notes.push("migrations de hardening do módulo de nutrição estão versionadas");
notes.push("privilégios anônimos do módulo de nutrição permanecem revogados");
notes.push("bucket technical-sheets permanece privado");
notes.push("arquivos temporários do Supabase estão fora da árvore rastreada");

console.log("[core-security] Auditoria aprovada:");
for (const note of notes) {
  console.log(`- ${note}`);
}
