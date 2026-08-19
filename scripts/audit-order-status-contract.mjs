#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

const root = process.cwd();
const supportedExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx"]);
const scopedRoots = [
  "src/app/(dashboard)/dashboard/pedidos",
  "src/components/orders",
  "src/app/api",
  "scripts/qa",
];

const invalidLiteral = /["']canceled["']/;
const orderMutationPatterns = [
  /\.rpc\(\s*["']advance_order_status["'][\s\S]{0,800}?p_to_status\s*:\s*["']canceled["']/,
  /\.from\(\s*["']orders["']\s*\)[\s\S]{0,1200}?\.update\([\s\S]{0,600}?\bstatus\s*:\s*["']canceled["']/,
  /["']canceled["']\s*::\s*(?:public\.)?order_status/,
];

function walk(path, files = []) {
  if (!existsSync(path)) return files;

  const stats = statSync(path);
  if (stats.isFile()) {
    files.push(path);
    return files;
  }

  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    walk(resolve(path, entry.name), files);
  }

  return files;
}

export function findOrderStatusContractViolations(content, filePath) {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const violations = [];
  const isOrderUi =
    normalizedPath.includes("/dashboard/pedidos/") ||
    normalizedPath.includes("/components/orders/");

  if (isOrderUi && invalidLiteral.test(content)) {
    violations.push("literal de status de pedido 'canceled'; use 'cancelado'");
  }

  for (const pattern of orderMutationPatterns) {
    if (pattern.test(content)) {
      violations.push(
        "mutação de pedido tenta usar 'canceled'; use cancel_order/cancelado"
      );
      break;
    }
  }

  return [...new Set(violations)];
}

function runSelfTest() {
  const unsafeRpc = `supabase.rpc("advance_order_status", { p_to_status: "canceled" })`;
  const unsafeUpdate = `supabase.from("orders").update({ status: "canceled" })`;
  const safeCancel = `supabase.rpc("cancel_order", { p_order_id: orderId, p_reason: reason })`;
  const unrelatedInventory = `supabase.from("inventory_labels").update({ status: "canceled" })`;

  if (findOrderStatusContractViolations(unsafeRpc, "src/app/api/orders/route.ts").length === 0) {
    throw new Error("self-test falhou: RPC inválida não detectada");
  }
  if (findOrderStatusContractViolations(unsafeUpdate, "src/app/api/orders/route.ts").length === 0) {
    throw new Error("self-test falhou: update inválido não detectado");
  }
  if (findOrderStatusContractViolations(safeCancel, "src/app/api/orders/route.ts").length !== 0) {
    throw new Error("self-test falhou: cancel_order canônico foi marcado como inválido");
  }
  if (findOrderStatusContractViolations(unrelatedInventory, "src/app/(dashboard)/dashboard/producao/actions.ts").length !== 0) {
    throw new Error("self-test falhou: status de inventário foi confundido com order_status");
  }
}

runSelfTest();

const findings = [];
for (const scopedRoot of scopedRoots) {
  const absoluteRoot = resolve(root, scopedRoot);
  for (const file of walk(absoluteRoot)) {
    if (!supportedExtensions.has(extname(file))) continue;

    const rel = relative(root, file).replaceAll("\\", "/");
    const content = readFileSync(file, "utf8");
    const violations = findOrderStatusContractViolations(content, rel);

    for (const violation of violations) {
      findings.push(`${rel}: ${violation}`);
    }
  }
}

if (findings.length > 0) {
  console.error("[order-status-contract] Regressões encontradas:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  "[order-status-contract] OK. Cancelamento de pedidos permanece canônico via cancelado/cancel_order."
);
