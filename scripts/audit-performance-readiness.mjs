#!/usr/bin/env node

import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/products/catalog/route.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260908211236_performance_hot_path_indexes.sql",
  "utf8",
);

const findings = [];
const requireCondition = (condition, message) => {
  if (!condition) findings.push(message);
};

requireCondition(
  route.includes("PRODUCT_CATALOG_CACHE_TTL_MS = 15_000"),
  "product catalog cache TTL must remain explicitly bounded",
);
requireCondition(
  route.includes("productCatalogCache.get(establishmentId)") &&
    route.includes("productCatalogCache.set(establishmentId"),
  "product catalog cache must be keyed by establishmentId",
);
requireCondition(
  route.includes('.eq("establishment_id", establishmentId)') &&
    route.includes('.eq("is_active", true)') &&
    route.includes('.order("name", { ascending: true })'),
  "product catalog query hot-path contract changed",
);
requireCondition(
  route.includes("if (error)") &&
    route.indexOf("if (error)") < route.indexOf("writeProductCatalogCache(establishmentId, catalog)"),
  "Supabase errors must never be cached",
);
requireCondition(
  migration.includes("products_establishment_active_name_idx") &&
    migration.includes("(establishment_id, is_active, name)"),
  "dominant product catalog index missing",
);
requireCondition(
  migration.includes("products_establishment_active_type_name_idx") &&
    migration.includes("(establishment_id, is_active, product_type, name)"),
  "product type catalog index missing",
);
requireCondition(
  migration.includes("technical_sheets_establishment_name_created_idx") &&
    migration.includes("(establishment_id, name, created_at desc)"),
  "technical sheets listing index missing",
);
requireCondition(
  !/drop\s+index/i.test(migration),
  "performance readiness migration must not drop indexes",
);

if (findings.length) {
  console.error("[performance-readiness] Contract invalid:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  "[performance-readiness] OK. Tenant cache and measured hot-path indexes are protected.",
);
