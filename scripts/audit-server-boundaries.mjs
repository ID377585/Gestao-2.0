#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const PRIVILEGED_PATTERNS = [
  /\bgetSupabaseAdminClient\b/,
  /\bcreateSupabaseAdminClient\b/,
  /\bsupabaseAdmin\b/,
  /\bSUPABASE_SERVICE_ROLE_KEY\b/,
  /\bgetRequiredSupabaseServiceRoleKey\b/,
];

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index >= 0 ? path.slice(index) : "";
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) walk(fullPath, files);
    else if (SOURCE_EXTENSIONS.has(extensionOf(fullPath))) files.push(fullPath);
  }
  return files;
}

function firstDirective(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("//"));
}

function normalized(path) {
  return path.replaceAll("\\", "/");
}

function isRouteHandler(path) {
  return /(^|\/)app\/api\/.+\/route\.[cm]?[jt]s$/.test(normalized(path));
}

function isAppRouterServerEntry(path, text) {
  if (firstDirective(text) === '"use client";' || firstDirective(text) === "'use client';") return false;
  return /(^|\/)app\/.+\/(page|layout)\.[cm]?[jt]sx?$/.test(normalized(path));
}

function isServerAction(text) {
  const directive = firstDirective(text);
  return directive === '"use server";' || directive === "'use server';";
}

function importsProtectedServerModule(text) {
  return /from\s+["'](?:@\/lib\/supabase\/server|\.\/supabase\/server|\.\/server)["']/.test(text);
}

const findings = [];
for (const file of walk("src")) {
  const rel = relative(process.cwd(), file).replaceAll("\\", "/");
  const text = readFileSync(file, "utf8");
  if (!PRIVILEGED_PATTERNS.some((pattern) => pattern.test(text))) continue;

  const directive = firstDirective(text);
  if (directive === '"use client";' || directive === "'use client';") {
    findings.push(`${rel}: privileged Supabase primitive referenced by a client component`);
    continue;
  }

  // Next route handlers, Server Actions and App Router server entries are server
  // boundaries by framework contract. Importing the canonical Supabase server
  // module is also protected transitively because that module imports server-only.
  // Reusable privileged modules that do neither must explicitly import server-only.
  const protectedBoundary =
    isRouteHandler(rel) ||
    isServerAction(text) ||
    isAppRouterServerEntry(rel, text) ||
    importsProtectedServerModule(text) ||
    /^import\s+["']server-only["'];/m.test(text);

  if (!protectedBoundary) {
    findings.push(`${rel}: privileged Supabase primitive without explicit or transitive server-only boundary`);
  }
}

if (findings.length) {
  console.error("[server-boundaries] Privileged boundary violations found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("[server-boundaries] OK: privileged Supabase primitives are confined to protected server boundaries.");
