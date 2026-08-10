#!/usr/bin/env node

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const actionsPath = resolve(
  root,
  "src/app/(dashboard)/dashboard/pedidos/actions.ts"
);

function replaceOnce(content, before, after, label) {
  const first = content.indexOf(before);
  if (first < 0) throw new Error(`[order-rls-v3] Padrao ausente: ${label}`);
  if (content.indexOf(before, first + before.length) >= 0) {
    throw new Error(`[order-rls-v3] Padrao duplicado: ${label}`);
  }
  return content.slice(0, first) + after + content.slice(first + before.length);
}

let source = readFileSync(actionsPath, "utf8");

source = replaceOnce(
  source,
  `        const supabaseAdmin = createSupabaseAdminClient();\n        const { data: legacyUpdatedOrder, error: legacyUpdateErr } =\n          await supabaseAdmin\n            .from("orders")`,
  `        const { data: legacyUpdatedOrder, error: legacyUpdateErr } =\n          await supabase\n            .from("orders")`,
  "fallback de cancelamento"
);

source = replaceOnce(
  source,
  `        const supabaseAdmin = createSupabaseAdminClient();\n        const { data: legacyUpdatedOrder, error: legacyUpdateErr } =\n          await supabaseAdmin\n            .from("orders")`,
  `        const { data: legacyUpdatedOrder, error: legacyUpdateErr } =\n          await supabase\n            .from("orders")`,
  "fallback de reabertura"
);

source = source
  .replaceAll("A RPC canonica grava", "A RPC canônica grava")
  .replaceAll("na mesma transacao.", "na mesma transação.")
  .replaceAll("Pedido nao encontrado apos", "Pedido não encontrado após")
  .replaceAll('OBS: no banco deixamos "so admin". Aqui tambem deixo so admin pra UX.', 'OBS: no banco deixamos "só admin". Aqui também deixo só admin pra UX.');

writeFileSync(actionsPath, source, "utf8");

for (const relativePath of [
  "scripts/maintenance/fix-order-rls-v3-fallback.mjs",
  ".github/workflows/fix-order-rls-v3-fallback.yml",
]) {
  try {
    unlinkSync(resolve(root, relativePath));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log("[order-rls-v3] Fallback legado corrigido sem nova dependencia de secret.");
