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
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("//"));
}

function isRouteHandler(path) {
  return /(^|\/)app\/api\/.+\/route\.[cm]?[jt]s$/.test(path.replaceAll("\\", "/"));
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

  // API route handlers are server-only by Next.js contract. Other privileged modules
  // must explicitly import server-only so accidental client imports fail at build time.
  if (!isRouteHandler(rel) && !/^import\s+["']server-only["'];/m.test(text)) {
    findings.push(`${rel}: privileged Supabase primitive without explicit server-only boundary`);
  }
}

if (findings.length) {
  console.error("[server-boundaries] Privileged boundary violations found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("[server-boundaries] OK: privileged Supabase primitives are confined to explicit server boundaries.");
