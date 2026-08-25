#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');

const contracts = {
  advance_order_status: [
    /security\s+definer/i,
    /set\s+search_path/i,
    /auth\.uid\s*\(\s*\)/i,
    /active_membership\s*\(/i,
    /establishment_id\s*=\s*v_establishment_id/i,
    /role cannot advance order/i,
    /for\s+update/i,
  ],
  cancel_order: [
    /security\s+definer/i,
    /set\s+search_path/i,
    /auth\.uid\s*\(\s*\)/i,
    /active_membership\s*\(/i,
    /establishment_id\s*=\s*v_establishment_id/i,
    /only admin\/operacao can cancel/i,
    /for\s+update/i,
  ],
  reopen_order: [
    /security\s+definer/i,
    /set\s+search_path/i,
    /auth\.uid\s*\(\s*\)/i,
    /active_membership\s*\(/i,
    /establishment_id\s*=\s*v_establishment_id/i,
    /only admin can reopen/i,
    /only canceled orders can be reopened/i,
    /for\s+update/i,
  ],
  gestify_ensure_stock_balance_for_product: [
    /security\s+definer/i,
    /set\s+search_path/i,
    /auth\.uid\s*\(\s*\)/i,
    /memberships/i,
    /establishment_memberships/i,
    /role::text[^\n]*<>\s*'cliente'/i,
    /p\.establishment_id\s*=\s*p_establishment_id/i,
    /pg_advisory_xact_lock/i,
  ],
  enqueue_nutrition_notification: [
    /security\s+definer/i,
    /set\s+search_path/i,
    /auth\.uid\s*\(\s*\)/i,
    /memberships/i,
    /establishment_memberships/i,
    /user_module_permissions/i,
    /module_key\s*=\s*'nutricao'/i,
    /notification target is outside establishment/i,
  ],
};

function listMigrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function extractFunctionDefinition(sql, functionName) {
  const startPattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\(`,
    'ig',
  );
  let match;
  let latest = null;

  while ((match = startPattern.exec(sql)) !== null) {
    const tail = sql.slice(match.index);
    const markerMatch = tail.match(/\n\$(?:function)?\$;|\n\$[a-zA-Z_][a-zA-Z0-9_]*\$;/);
    if (!markerMatch || markerMatch.index === undefined) {
      latest = tail;
      continue;
    }
    latest = tail.slice(0, markerMatch.index + markerMatch[0].length);
  }

  return latest;
}

const latestDefinitions = new Map();

for (const file of listMigrationFiles()) {
  const fullPath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(fullPath, 'utf8');

  for (const functionName of Object.keys(contracts)) {
    const definition = extractFunctionDefinition(sql, functionName);
    if (definition) latestDefinitions.set(functionName, { file, definition });
  }
}

const findings = [];

for (const [functionName, requiredPatterns] of Object.entries(contracts)) {
  const latest = latestDefinitions.get(functionName);
  if (!latest) {
    findings.push(`${functionName}: no CREATE OR REPLACE definition found in migrations.`);
    continue;
  }

  for (const pattern of requiredPatterns) {
    if (!pattern.test(latest.definition)) {
      findings.push(`${functionName}: latest definition in ${latest.file} is missing contract pattern ${pattern}.`);
    }
  }
}

if (findings.length > 0) {
  console.error('SECURITY DEFINER RPC audit failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('SECURITY DEFINER RPC audit passed.');
for (const [functionName, latest] of latestDefinitions.entries()) {
  console.log(`- ${functionName}: ${latest.file}`);
}
