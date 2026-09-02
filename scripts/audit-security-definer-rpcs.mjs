#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');

const contracts = {
  advance_order_status: [
    /security\s+invoker/i,
    /set\s+search_path/i,
    /private\.advance_order_status_impl/i,
  ],
  cancel_order: [
    /security\s+invoker/i,
    /set\s+search_path/i,
    /private\.cancel_order_impl/i,
  ],
  reopen_order: [
    /security\s+invoker/i,
    /set\s+search_path/i,
    /private\.reopen_order_impl/i,
  ],
  gestify_ensure_stock_balance_for_product: [
    /security\s+invoker/i,
    /set\s+search_path/i,
    /private\.gestify_ensure_stock_balance_for_product_impl/i,
  ],
  enqueue_nutrition_notification: [
    /security\s+invoker/i,
    /set\s+search_path/i,
    /private\.enqueue_nutrition_notification_impl/i,
  ],
};

const privilegedMoveContracts = {
  advance_order_status: /alter\s+function\s+public\.advance_order_status[\s\S]*?set\s+schema\s+private[\s\S]*?rename\s+to\s+advance_order_status_impl/i,
  cancel_order: /alter\s+function\s+public\.cancel_order[\s\S]*?set\s+schema\s+private[\s\S]*?rename\s+to\s+cancel_order_impl/i,
  reopen_order: /alter\s+function\s+public\.reopen_order[\s\S]*?set\s+schema\s+private[\s\S]*?rename\s+to\s+reopen_order_impl/i,
  gestify_ensure_stock_balance_for_product: /alter\s+function\s+public\.gestify_ensure_stock_balance_for_product[\s\S]*?set\s+schema\s+private[\s\S]*?rename\s+to\s+gestify_ensure_stock_balance_for_product_impl/i,
  enqueue_nutrition_notification: /alter\s+function\s+public\.enqueue_nutrition_notification[\s\S]*?set\s+schema\s+private[\s\S]*?rename\s+to\s+enqueue_nutrition_notification_impl/i,
};

function listMigrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function extractFunctionDefinition(sql, functionName) {
  const startPattern = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${functionName}\\s*\\(`,
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
let allMigrationSql = '';

for (const file of listMigrationFiles()) {
  const fullPath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(fullPath, 'utf8');
  allMigrationSql += `\n-- ${file}\n${sql}\n`;

  for (const functionName of Object.keys(contracts)) {
    const definition = extractFunctionDefinition(sql, functionName);
    if (definition) latestDefinitions.set(functionName, { file, definition });
  }
}

const findings = [];

for (const [functionName, requiredPatterns] of Object.entries(contracts)) {
  const latest = latestDefinitions.get(functionName);
  if (!latest) {
    findings.push(`${functionName}: no public facade definition found in migrations.`);
    continue;
  }

  for (const pattern of requiredPatterns) {
    pattern.lastIndex = 0;
    if (!pattern.test(latest.definition)) {
      findings.push(`${functionName}: latest public facade in ${latest.file} is missing contract pattern ${pattern}.`);
    }
  }

  const movePattern = privilegedMoveContracts[functionName];
  movePattern.lastIndex = 0;
  if (!movePattern.test(allMigrationSql)) {
    findings.push(`${functionName}: privileged implementation is not moved from public to private *_impl.`);
  }
}

if (findings.length > 0) {
  console.error('SECURITY DEFINER RPC surface audit failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('SECURITY DEFINER RPC surface audit passed.');
for (const [functionName, latest] of latestDefinitions.entries()) {
  console.log(`- ${functionName}: public SECURITY INVOKER facade in ${latest.file}`);
}
