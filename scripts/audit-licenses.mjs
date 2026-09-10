import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const BLOCKED = new Set(["AGPL-1.0", "AGPL-1.0-only", "AGPL-1.0-or-later", "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later", "SSPL-1.0"]);
const REVIEW = /(^|[^A-Z])(GPL|LGPL|MPL|EPL|CDDL)(-|$)|SEE LICENSE|UNLICENSED|UNKNOWN/i;
const failOnReview = process.argv.includes("--fail-on-review");
const outDir = resolve(process.cwd(), "artifacts/compliance");
const reportPath = resolve(outDir, "oss-license-audit.json");
const sbomPath = resolve(outDir, "oss-sbom.json");
const noticePath = resolve(outDir, "THIRD_PARTY_NOTICES.md");

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

function loadLockMetadata() {
  try {
    const lock = JSON.parse(readFileSync(resolve(process.cwd(), "package-lock.json"), "utf8"));
    const byNameVersion = new Map();
    for (const [path, meta] of Object.entries(lock.packages ?? {})) {
      if (!path.startsWith("node_modules/")) continue;
      const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
      const version = meta?.version;
      if (!name || !version) continue;
      byNameVersion.set(`${name}@${version}`, meta);
    }
    return byNameVersion;
  } catch {
    return new Map();
  }
}

let tree;
try {
  tree = JSON.parse(execFileSync("npm", ["ls", "--all", "--json", "--long"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
} catch (error) {
  const stdout = error?.stdout?.toString?.();
  if (!stdout) throw error;
  tree = JSON.parse(stdout);
}

const lockMetadata = loadLockMetadata();
const packages = new Map();
function walk(node, path = []) {
  for (const [name, dep] of Object.entries(node?.dependencies ?? {})) {
    const version = dep?.version ?? "UNKNOWN";
    const key = `${name}@${version}`;
    if (!packages.has(key)) {
      const lock = lockMetadata.get(key);
      const rawLicense = dep?.license ?? dep?.licenses ?? lock?.license ?? lock?.licenses;
      const license = normalizeLicense(rawLicense);
      const source = dep?.license || dep?.licenses ? "npm-ls" : lock?.license || lock?.licenses ? "package-lock" : "unknown";
      packages.set(key, {
        name,
        version,
        license,
        classification: classify(license),
        license_source: source,
        resolved: lock?.resolved ?? dep?.resolved ?? null,
        integrity: lock?.integrity ?? dep?.integrity ?? null,
        path: [...path, key].join(" > "),
      });
    }
    walk(dep, [...path, key]);
  }
}
walk(tree);

const rows = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const blocked = rows.filter((row) => row.classification === "blocked");
const review = rows.filter((row) => row.classification === "review");
const unknown = rows.filter((row) => row.license === "UNKNOWN");
const copyleftReview = review.filter((row) => row.license !== "UNKNOWN");
const summary = {
  generated_at: new Date().toISOString(),
  total_packages: rows.length,
  blocked: blocked.length,
  review: review.length,
  unknown: unknown.length,
  copyleft_or_special_review: copyleftReview.length,
  allowed: rows.length - blocked.length - review.length,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({ summary, blocked, review, unknown, copyleft_or_special_review: copyleftReview, packages: rows }, null, 2)}\n`);
writeFileSync(sbomPath, `${JSON.stringify({
  bomFormat: "Gestify-OSS-Inventory",
  specVersion: "1.0",
  generated_at: summary.generated_at,
  components: rows.map(({ name, version, license, classification, resolved, integrity }) => ({ name, version, license, classification, resolved, integrity })),
}, null, 2)}\n`);

const notices = [
  "# Gestify — Third-Party Software Inventory",
  "",
  `Generated: ${summary.generated_at}`,
  "",
  "This inventory records third-party package metadata detected in the installed dependency tree. It is evidence for compliance review and is not a substitute for the original license texts or legal review.",
  "",
  "| Package | Version | License | Classification |",
  "|---|---:|---|---|",
  ...rows.map((row) => `| ${row.name.replaceAll("|", "\\|")} | ${row.version} | ${row.license.replaceAll("|", "\\|")} | ${row.classification} |`),
  "",
];
writeFileSync(noticePath, notices.join("\n"));

console.log(`[licenses] ${rows.length} pacotes: ${summary.allowed} permitidos, ${review.length} para revisão, ${blocked.length} bloqueados.`);
console.log(`[licenses] revisão: ${unknown.length} UNKNOWN; ${copyleftReview.length} copyleft/especial.`);
console.log(`[licenses] relatório: ${reportPath}`);
console.log(`[licenses] inventário: ${sbomPath}`);
console.log(`[licenses] notices: ${noticePath}`);
if (blocked.length) {
  console.error("[licenses] licença bloqueada detectada:");
  for (const row of blocked) console.error(`- ${row.name}@${row.version}: ${row.license}`);
  process.exit(1);
}
if (failOnReview && review.length) {
  console.error("[licenses] licenças que exigem revisão jurídica/manual detectadas.");
  process.exit(2);
}
