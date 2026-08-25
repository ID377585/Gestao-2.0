# Proxy/Auth resilience

Status: implementing
Priority: P1
Issues: #60, #61

## Contexto

Production registrou em 20/08/2026 falhas de Auth upstream (`522`) e execuções do antigo middleware excedendo o limite da plataforma. O código atual já mantém `/login`, `/forgot-password` e `/reset-password` independentes de chamadas Supabase, mas rotas protegidas ainda podem aguardar chamadas remotas sem orçamento explícito.

Next.js 16 também depreca a convenção `middleware.ts` em favor de `proxy.ts`.

## Objetivo

Migrar a fronteira para `src/proxy.ts` sem alterar a semântica de autenticação/autorização e limitar a duração das chamadas remotas para que uma degradação upstream falhe rápido e fechado.

## Invariantes de segurança

- falha/timeout do Auth nunca concede sessão, tenant ou módulo;
- páginas públicas de autenticação continuam respondendo sem depender do Supabase;
- rotas protegidas sem identidade válida continuam redirecionando para login;
- timeout upstream em rota protegida resulta em 503 sem cache, nunca em `NextResponse.next()` por fallback;
- cookies inválidos continuam sendo limpos apenas no caso de token/sessão inválida conhecido;
- CORS e matchers existentes são preservados;
- nenhuma chave privilegiada é introduzida no cliente.

## Design

- mover a lógica existente para `src/lib/network/proxy-handler.ts` sem reescrever regras de autorização;
- usar `src/proxy.ts` como entrypoint Next.js;
- orçamento total do proxy: 8s;
- timeout de chamadas `fetch` do client Supabase usado pelo proxy: 6s;
- resposta de orçamento excedido: HTTP 503, `Cache-Control: no-store`, `Retry-After: 5`, código `AUTH_UPSTREAM_TIMEOUT`;
- logs distinguem timeout de proxy dos erros de sessão existentes.

## Testes e critérios de aceite

1. `src/middleware.ts` não existe e `src/proxy.ts` existe;
2. matcher preserva dashboard, compras, financeiro, auth e API;
3. rotas públicas de auth retornam antes da criação do client Supabase;
4. timeout do fetch é menor que o orçamento total do proxy;
5. timeout total é fail-closed 503;
6. CI: QA guard, proxy/auth audit, lint, typecheck, dependency audit, Excel, tenant writes, readiness, build;
7. Preview Vercel READY e sem warning de convenção `middleware` depreciada;
8. nenhuma regressão de login/redirect/CORS em Preview.

## Observabilidade

Monitorar `AUTH_UPSTREAM_TIMEOUT`, `[proxy] upstream timeout budget exceeded`, 5xx e latência de rotas protegidas. Se o upstream estabilizar mas esses eventos persistirem, investigar membership/module-permission queries separadamente.

## Rollout

Branch isolada -> CI/Preview -> testes de rotas -> revisão humana -> merge. Nenhuma migration de banco.

## Rollback

Reverter a PR restaura `src/middleware.ts` e remove os timeouts explícitos. Nenhum dado/schema é alterado.
