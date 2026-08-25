#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const proxyPath = resolve(root, "src/proxy.ts");
const legacyMiddlewarePath = resolve(root, "src/middleware.ts");
const handlerPath = resolve(root, "src/lib/network/proxy-handler.ts");
const supabaseMiddlewarePath = resolve(root, "src/utils/supabase/middleware.ts");

const findings = [];

function requireCondition(ok, message) {
  if (!ok) findings.push(message);
}

requireCondition(existsSync(proxyPath), "src/proxy.ts deve existir");
requireCondition(!existsSync(legacyMiddlewarePath), "src/middleware.ts não deve existir após migração para proxy");
requireCondition(existsSync(handlerPath), "handler interno do proxy deve existir");
requireCondition(existsSync(supabaseMiddlewarePath), "client Supabase do proxy deve existir");

const proxy = existsSync(proxyPath) ? readFileSync(proxyPath, "utf8") : "";
const handler = existsSync(handlerPath) ? readFileSync(handlerPath, "utf8") : "";
const supabaseMiddleware = existsSync(supabaseMiddlewarePath)
  ? readFileSync(supabaseMiddlewarePath, "utf8")
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

if (findings.length > 0) {
  console.error("[proxy-auth-resilience] Contrato inválido:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("[proxy-auth-resilience] OK. Proxy fail-closed, auth pública independente e budgets explícitos preservados.");
