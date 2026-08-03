#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";

const ROOTS = ["src"];

const HEAVY_RUNTIME_PACKAGES = [
  "exceljs",
  "pdf-parse",
  "node-forge",
  "soap",
  "tesseract.js",
  "@xmldom/xmldom",
  "xml-crypto",
];

const CLIENT_STATIC_FORBIDDEN = new Set([
  ...HEAVY_RUNTIME_PACKAGES,
  "fast-xml-parser",
]);

const MIDDLEWARE_FORBIDDEN = new Set([
  ...HEAVY_RUNTIME_PACKAGES,
  "heic2any",
  "jspdf",
  "jspdf-autotable",
  "qrcode",
  "recharts",
]);

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index >= 0 ? path.slice(index) : "";
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(extensionOf(fullPath))) {
      files.push(fullPath);
    }
  }

  return files;
}

function isClientFile(text) {
  const firstMeaningfulLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("//"));

  return firstMeaningfulLine === '"use client";' || firstMeaningfulLine === "'use client';";
}

function isMiddlewareFile(path) {
  const normalized = path.replaceAll("\\", "/");
  return /(^|\/)(middleware|proxy)\.[cm]?[jt]s$/.test(normalized);
}

function staticImports(text) {
  const imports = [];
  const importRe = /import\s+(?!type\b)[\s\S]*?\s+from\s+["']([^"']+)["']/g;
  const sideEffectImportRe = /import\s+["']([^"']+)["']/g;
  const requireRe = /require\(\s*["']([^"']+)["']\s*\)/g;

  for (const re of [importRe, sideEffectImportRe, requireRe]) {
    for (const match of text.matchAll(re)) {
      imports.push(match[1]);
    }
  }

  return imports;
}

function rootPackage(importPath) {
  if (importPath.startsWith("@")) {
    const [scope, name] = importPath.split("/");
    return `${scope}/${name}`;
  }

  return importPath.split("/")[0];
}

const findings = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    const rel = relative(process.cwd(), file);
    const clientFile = isClientFile(text);
    const middlewareFile = isMiddlewareFile(rel);

    if (!clientFile && !middlewareFile) continue;

    for (const importPath of staticImports(text)) {
      const pkg = rootPackage(importPath);

      if (clientFile && CLIENT_STATIC_FORBIDDEN.has(pkg)) {
        findings.push({
          file: rel,
          package: pkg,
          reason: "client component",
        });
      }

      if (middlewareFile && MIDDLEWARE_FORBIDDEN.has(pkg)) {
        findings.push({
          file: rel,
          package: pkg,
          reason: "middleware/proxy",
        });
      }
    }
  }
}

if (findings.length === 0) {
  console.log("[runtime-imports] OK: no heavy static imports in client or middleware files.");
  process.exit(0);
}

console.error("[runtime-imports] Heavy imports found in sensitive runtimes:");
for (const finding of findings) {
  console.error(
    `- ${finding.file}: ${finding.package} imported in ${finding.reason}`
  );
}
process.exit(1);
