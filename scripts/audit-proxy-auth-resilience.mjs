#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const proxyPath = resolve(root, "src/proxy.ts");
const legacyMiddlewarePath = resolve(root, "src/middleware.ts");
const handlerPath = resolve(root, "src/lib/network/proxy-handler.ts");
const supabaseMiddlewarePath = resolve(root, "src/utils/supabase/middleware.ts");
const compliancePath = resolve(root, "src/lib/auth/terms-compliance.server.ts");
const complianceRoutePath = resolve(root, "src/app/api/auth/compliance/route.ts");
const complianceMigrationPath = resolve(
  root,
  "supabase/migrations/20260901110313_create_auth_compliance_ledgers.sql"
);

const findings = [];

function requireCondition(ok, message) {
  if (!ok) findings.push(message);
}

requireCondition(existsSync(proxyPath), "src/proxy.ts deve existir");
requireCondition(!existsSync(legacyMiddlewarePath), "src/middleware.ts não deve existir após migração para proxy");
requireCondition(existsSync(handlerPath), "handler interno do proxy deve existir");
requireCondition(existsSync(supabaseMiddlewarePath), "client Supabase do proxy deve existir");
requireCondition(existsSync(compliancePath), "módulo server-side de compliance deve existir");
requireCondition(existsSync(complianceRoutePath), "API de compliance deve existir");
requireCondition(existsSync(complianceMigrationPath), "migration do ledger de compliance deve existir");

const proxy = existsSync(proxyPath) ? readFileSync(proxyPath, "utf8") : "";
const handler = existsSync(handlerPath) ? readFileSync(handlerPath, "utf8") : "";
const supabaseMiddleware = existsSync(supabaseMiddlewarePath)
  ? readFileSync(supabaseMiddlewarePath, "utf8")
  : "";
const compliance = existsSync(compliancePath)
  ? readFileSync(compliancePath, "utf8")
  : "";
const complianceRoute = existsSync(complianceRoutePath)
  ? readFileSync(complianceRoutePath, "utf8")
  : "";
const complianceMigration = existsSync(complianceMigrationPath)
  ? readFileSync(complianceMigrationPath, "utf8")
  : "";

requireCondition(/PROXY_TOTAL_BUDGET_MS\s*=\s*8_000/.test(proxy), "proxy deve manter orçamento total explícito de 8s");
requireCondition(/status:\s*503/.test(proxy), "timeout do proxy deve retornar HTTP 503");
requireCondition(/AUTH_UPSTREAM_TIMEOUT/.test(proxy), "proxy deve identificar timeout upstream de Auth");
requireCondition(/Cache-Control["']?\s*:\s*["']no-store["']/.test(proxy), "resposta 503 deve ser no-store");
requireCondition(/Retry-After["']?\s*:\s*["']5["']/.test(proxy), "resposta 503 deve informar Retry-After");
requireCondition(/Promise\.race/.test(proxy), "proxy deve impor orçamento total com Promise.race");

for (const matcher of ["/dashboard/:path*", "/compras/:path*", "/financeiro/:path*", "/login", "/forgot-password", "/reset-password", "/api/:path*"]) {
  requireCondition(proxy.includes(matcher), `matcher obrigatório ausente: ${matcher}`);
}

const authShortCircuit = handler.indexOf("if (isAuthRoute(pathname))");
const clientCreation = handler.indexOf("createSupabaseMiddlewareClient(req)");
requireCondition(authShortCircuit >= 0, "handler deve manter short-circuit das rotas públicas de auth");
requireCondition(clientCreation >= 0, "handler deve criar client Supabase somente depois das rotas públicas");
requireCondition(authShortCircuit >= 0 && clientCreation >= 0 && authShortCircuit < clientCreation,
  "rotas públicas de auth devem retornar antes de qualquer client Supabase");

requireCondition(/MIDDLEWARE_FETCH_TIMEOUT_MS\s*=\s*6_000/.test(supabaseMiddleware), "fetch Supabase do proxy deve ter timeout explícito de 6s");
requireCondition(/AbortController/.test(supabaseMiddleware), "fetch Supabase deve ser abortável");
requireCondition(/global:\s*\{[\s\S]*fetch:\s*fetchWithTimeout/.test(supabaseMiddleware), "createServerClient deve usar fetch com timeout");

requireCondition(
  !compliance.includes("auth.admin.updateUserById"),
  "compliance não pode mutar auth.users/app_metadata em acesso ou aceite rotineiro"
);
requireCondition(
  compliance.includes('.from("user_terms_acceptances").insert('),
  "aceite explícito deve ser persistido no ledger user_terms_acceptances"
);
requireCondition(
  compliance.includes('.from("user_access_logs").insert('),
  "telemetria de acesso deve ser persistida em user_access_logs"
);
requireCondition(
  !/ensureCurrentTermsAcceptedOrRedirect[\s\S]*recordTermsAcceptance\(/.test(compliance),
  "guard de termos não pode registrar aceite implicitamente"
);
requireCondition(
  compliance.includes("redirect(") && compliance.includes("terms=required"),
  "guard sem aceite deve redirecionar para consentimento explícito"
);
requireCondition(
  complianceRoute.includes("body?.acceptTerms === true"),
  "POST de compliance deve exigir acceptTerms=true explícito"
);
requireCondition(
  !complianceRoute.includes("app_metadata"),
  "API de compliance não pode usar app_metadata como fonte de verdade"
);
requireCondition(
  !handler.includes("readTermsComplianceFromMetadata") &&
    !handler.includes("hasAcceptedCurrentTerms"),
  "middleware não pode autorizar compliance por claims/app_metadata"
);
requireCondition(
  /unique \(user_id, terms_version_id\)/i.test(complianceMigration),
  "ledger deve ser idempotente por usuário e versão"
);
requireCondition(
  complianceMigration.includes("force row level security") &&
    complianceMigration.includes("user_terms_acceptances_no_direct_access") &&
    complianceMigration.includes("user_access_logs_no_direct_access"),
  "tabelas internas de compliance devem ter RLS forçado e deny policy explícita"
);
requireCondition(
  complianceMigration.includes(
    "revoke all on table public.user_terms_acceptances from anon, authenticated, service_role"
  ) &&
    complianceMigration.includes(
      "revoke all on table public.user_access_logs from anon, authenticated, service_role"
    ) &&
    complianceMigration.includes(
      "grant select, insert on table public.user_terms_acceptances to service_role"
    ) &&
    complianceMigration.includes(
      "grant select, insert on table public.user_access_logs to service_role"
    ),
  "ledger/log devem ser append-only para service_role e inacessíveis diretamente a usuários"
);

if (findings.length > 0) {
  console.error("[proxy-auth-resilience] Contrato inválido:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("[proxy-auth-resilience] OK. Proxy fail-closed, auth pública independente e compliance explícito em ledger preservados.");
