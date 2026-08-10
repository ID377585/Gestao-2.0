#!/usr/bin/env node

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const actionsPath = resolve(
  root,
  "src/app/(dashboard)/dashboard/pedidos/actions.ts"
);

function replaceExactly(content, before, after, expectedCount, label) {
  const parts = content.split(before);
  const actualCount = parts.length - 1;

  if (actualCount !== expectedCount) {
    throw new Error(
      `[order-rls-v3] Contagem inesperada para ${label}: esperada=${expectedCount} atual=${actualCount}`
    );
  }

  return parts.join(after);
}

let source = readFileSync(actionsPath, "utf8");

source = replaceExactly(
  source,
  `        const supabaseAdmin = createSupabaseAdminClient();\n        const { data: legacyUpdatedOrder, error: legacyUpdateErr } =\n          await supabaseAdmin\n            .from("orders")`,
  `        const { data: legacyUpdatedOrder, error: legacyUpdateErr } =\n          await supabase\n            .from("orders")`,
  2,
  "fallbacks de cancelamento e reabertura"
);

source = source
  .replaceAll("A RPC canonica grava", "A RPC canônica grava")
  .replaceAll("na mesma transacao.", "na mesma transação.")
  .replaceAll("Pedido nao encontrado apos", "Pedido não encontrado após")
  .replaceAll(
    'OBS: no banco deixamos "so admin". Aqui tambem deixo so admin pra UX.',
    'OBS: no banco deixamos "só admin". Aqui também deixo só admin pra UX.'
  );

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

console.log(
  "[order-rls-v3] Fallback legado corrigido sem nova dependência de secret."
);
