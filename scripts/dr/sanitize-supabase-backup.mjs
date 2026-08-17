#!/usr/bin/env node

import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import process from "node:process";

const [sourceArg, targetArg] = process.argv.slice(2);
if (!sourceArg || !targetArg) {
  console.error("Uso: node sanitize-supabase-backup.mjs <origem> <destino>");
  process.exit(1);
}

const sourceDir = resolve(sourceArg);
const targetDir = resolve(targetArg);
mkdirSync(targetDir, { recursive: true });

const requiredFiles = [
  "roles.sql",
  "schema.sql",
  "data.sql",
  "history-schema.sql",
  "history-data.sql",
  "manifest.json",
  "critical-counts.tsv",
];

for (const fileName of requiredFiles) {
  const sourcePath = join(sourceDir, fileName);
  try {
    readFileSync(sourcePath);
  } catch {
    console.error(`Arquivo obrigatório ausente no backup: ${fileName}`);
    process.exit(1);
  }
}

function commentKnownRestoreConflicts(fileName, transforms) {
  const sourcePath = join(sourceDir, fileName);
  const targetPath = join(targetDir, fileName);
  let source = readFileSync(sourcePath, "utf8");
  const counters = {};

  for (const transform of transforms) {
    let count = 0;
    source = source
      .split(/\r?\n/)
      .map((line) => {
        if (!line.startsWith("-- GESTIFY-DR-SANITIZED") && transform.test(line)) {
          count += 1;
          return `-- GESTIFY-DR-SANITIZED ${line}`;
        }
        return line;
      })
      .join("\n");
    counters[transform.name] = count;
  }

  writeFileSync(targetPath, `${source.replace(/\n*$/, "")}\n`, {
    mode: 0o600,
  });
  return counters;
}

const rolesCounters = commentKnownRestoreConflicts("roles.sql", [
  {
    name: "cli_login_postgres_grant",
    test: (line) =>
      /^GRANT\s+"postgres"\s+TO\s+"cli_login_postgres".*;\s*$/i.test(
        line.trim()
      ),
  },
]);

const schemaCounters = commentKnownRestoreConflicts("schema.sql", [
  {
    name: "supabase_admin_owner",
    test: (line) =>
      /^ALTER\b.*\bOWNER\s+TO\s+"supabase_admin";\s*$/i.test(line.trim()),
  },
]);

const historyCounters = commentKnownRestoreConflicts("history-schema.sql", [
  {
    name: "history_supabase_admin_owner",
    test: (line) =>
      /^ALTER\b.*\bOWNER\s+TO\s+"supabase_admin";\s*$/i.test(line.trim()),
  },
]);

for (const fileName of [
  "data.sql",
  "history-data.sql",
  "manifest.json",
  "critical-counts.tsv",
]) {
  cpSync(join(sourceDir, fileName), join(targetDir, fileName), {
    force: true,
  });
}

for (const optionalName of ["storage", "storage-buckets.txt"]) {
  try {
    cpSync(join(sourceDir, optionalName), join(targetDir, optionalName), {
      recursive: true,
      force: true,
    });
  } catch {
    // Storage is optional and intentionally absent from database-only backups.
  }
}

const report = {
  format: "gestify-dr-sanitization-v1",
  files: {
    roles: basename(join(targetDir, "roles.sql")),
    schema: basename(join(targetDir, "schema.sql")),
    historySchema: basename(join(targetDir, "history-schema.sql")),
  },
  commentedLines: {
    ...rolesCounters,
    ...schemaCounters,
    ...historyCounters,
  },
};

writeFileSync(
  join(targetDir, "sanitization-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  { mode: 0o600 }
);

console.log(JSON.stringify(report));
