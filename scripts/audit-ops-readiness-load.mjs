#!/usr/bin/env node

import { readFileSync } from "node:fs";

const load = readFileSync("scripts/ops/controlled-load.mjs", "utf8");
const monitor = readFileSync("scripts/ops/check-readiness.mjs", "utf8");
const loadWorkflow = readFileSync(".github/workflows/staging-load-test.yml", "utf8");
const monitorWorkflow = readFileSync(".github/workflows/readiness-monitor.yml", "utf8");

const findings = [];
const requireCondition = (condition, message) => {
  if (!condition) findings.push(message);
};

for (const host of ["gestify.app", "www.gestify.app", "gestao-2-0.vercel.app"]) {
  requireCondition(load.includes(host), `load guard missing Production host ${host}`);
}
requireCondition(load.includes("load:gestify-staging"), "load confirmation guard missing");
requireCondition(load.includes("ubwbnpckbwtllitonpjj"), "Production Supabase project guard missing");
requireCondition(load.includes("p95") && load.includes("p99") && load.includes("errorRate"), "load metrics incomplete");
requireCondition(load.includes("http:") && load.includes("https:"), "load protocol guard missing");
requireCondition(loadWorkflow.includes("workflow_dispatch"), "load workflow must be manual only");
requireCondition(!loadWorkflow.includes("schedule:"), "load workflow must never be scheduled");
requireCondition(monitorWorkflow.includes("GESTIFY_MONITORING_ENABLED"), "monitor must be opt-in");
requireCondition(monitorWorkflow.includes("*/15 * * * *"), "monitor cadence must remain explicit");
requireCondition(monitor.includes("x-operational-readiness-secret"), "monitor must use protected readiness endpoint");
requireCondition(monitor.includes("12_000"), "monitor must have bounded timeout");

if (findings.length) {
  console.error("[ops-readiness-load] Contract invalid:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log("[ops-readiness-load] OK. Monitoring is opt-in and load testing is Production-guarded.");
