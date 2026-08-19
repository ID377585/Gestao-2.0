import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const productionRef = 'ubwbnpckbwtllitonpjj';
const riskyName = /(e2e|smoke|qa|test)/i;
const codeExt = /\.(mjs|cjs|js|ts|tsx)$/i;
const excluded = new Set(['node_modules', '.next', '.git']);
const requiredGuard = 'assert-safe-supabase-target';
const mutationSignals = /(\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.delete\s*\(|auth\.admin\.|rpc\s*\()/;
const credentialSignals = /(SUPABASE_(SERVICE_ROLE|SECRET)_KEY|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL)/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root);
const findings = [];

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const content = fs.readFileSync(file, 'utf8');

  if (
    rel.startsWith('.github/workflows/') &&
    content.includes(productionRef) &&
    /(e2e|smoke|qa)/i.test(content)
  ) {
    findings.push(`${rel}: QA/E2E workflow contains the production Supabase project ref.`);
  }

  if (!codeExt.test(rel) || !riskyName.test(path.basename(rel))) continue;

  const touchesSupabase = /supabase/i.test(content) && credentialSignals.test(content);
  const mayMutate = mutationSignals.test(content);

  if (touchesSupabase && mayMutate && !content.includes(requiredGuard)) {
    findings.push(
      `${rel}: mutation-capable QA/E2E script uses Supabase credentials without the shared safe-target guard.`,
    );
  }
}

if (findings.length) {
  console.error('QA production guard audit failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('QA production guard audit passed.');
