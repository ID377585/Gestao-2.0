import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const BLOCKED = new Set(["AGPL-1.0", "AGPL-1.0-only", "AGPL-1.0-or-later", "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later", "SSPL-1.0"]);
const REVIEW = /(^|[^A-Z])(GPL|LGPL|MPL|EPL|CDDL)(-|$)|SEE LICENSE|UNLICENSED|UNKNOWN/i;
const failOnReview = process.argv.includes("--fail-on-review");
const reportPath = resolve(process.cwd(), "artifacts/compliance/oss-license-audit.json");

function normalizeLicense(value) {
  if (!value) return "UNKNOWN";
  if (typeof value === "string") return value.trim() || "UNKNOWN";
  if (Array.isArray(value)) return value.map(normalizeLicense).join(" OR ");
  if (typeof value === "object") return normalizeLicense(value.type ?? value.license);
  return String(value);
}

function classify(license) {
  const tokens = license.split(/\s+(?:OR|AND)\s+|[(),]/i).map((x) => x.trim()).filter(Boolean);
  if (tokens.some((token) => BLOCKED.has(token))) return "blocked";
  if (REVIEW.test(license)) return "review";
  return "allowed";
}

let tree;
try {
  tree = JSON.parse(execFileSync("npm", ["ls", "--all", "--json", "--long"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
} catch (error) {
  const stdout = error?.stdout?.toString?.();
  if (!stdout) throw error;
  tree = JSON.parse(stdout);
}

const packages = new Map();
function walk(node, path = []) {
  for (const [name, dep] of Object.entries(node?.dependencies ?? {})) {
    const version = dep?.version ?? "UNKNOWN";
    const key = `${name}@${version}`;
    if (!packages.has(key)) {
      const license = normalizeLicense(dep?.license ?? dep?.licenses);
      packages.set(key, { name, version, license, classification: classify(license), path: [...path, key].join(" > ") });
    }
    walk(dep, [...path, key]);
  }
}
walk(tree);

const rows = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const blocked = rows.filter((row) => row.classification === "blocked");
const review = rows.filter((row) => row.classification === "review");
const summary = { generated_at: new Date().toISOString(), total_packages: rows.length, blocked: blocked.length, review: review.length, allowed: rows.length - blocked.length - review.length };

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({ summary, blocked, review, packages: rows }, null, 2)}\n`);
console.log(`[licenses] ${rows.length} pacotes: ${summary.allowed} permitidos, ${review.length} para revisão, ${blocked.length} bloqueados.`);
console.log(`[licenses] relatório: ${reportPath}`);
if (blocked.length) {
  console.error("[licenses] licença bloqueada detectada:");
  for (const row of blocked) console.error(`- ${row.name}@${row.version}: ${row.license}`);
  process.exit(1);
}
if (failOnReview && review.length) {
  console.error("[licenses] licenças que exigem revisão jurídica/manual detectadas.");
  process.exit(2);
}
