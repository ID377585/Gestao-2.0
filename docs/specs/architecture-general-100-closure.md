# Arquitetura Geral — fechamento técnico 100%

Estado: validated / ready for promotion
Data: 2026-09-11
Base auditada: main `2b4e92216f7bc5932cf2446d10d5eb1e1b2cc1e8`
HEAD final validado: `046dd84266cd52aac0c0688cb5a830750d7b1331`
Prioridade: P1/P2

## Contexto

O Gestify está em uso ativo pela Santino. Esta frente fechou os critérios técnicos da Arquitetura Geral preservando isolamento multiempresa, segurança, reprodutibilidade e continuidade operacional. Durante a validação final foram feitas correções RLS autorizadas em Production, sempre forward-only e sem exclusão de dados.

## Resultado

**Arquitetura Geral: 100% no escopo técnico definido nesta spec.**

Os dez critérios técnicos abaixo estão implementados e sustentados por evidência reproduzível em branch, CI, staging e verificações controladas de Production. Isso não significa risco operacional ou de segurança literalmente zero.

## Invariantes

- Nenhum dado de usuário foi apagado.
- Alterações de banco desta frente são forward-only.
- Nenhuma correção enfraqueceu RLS, isolamento de tenant, autenticação, idempotência ou rollback.
- `establishment_id` e autorização server/database permanecem fronteiras de segurança.
- O replay completo das migrations em PostgreSQL 17 foi validado no HEAD final.
- Production continua sujeita a rollback de código/deploy e remediação de banco somente forward-only.

## Matriz final — critérios de 100%

1. **Topologia e runtime — VALIDADO.** Node 22.x; runtime/import contracts presentes; CI completo verde.
2. **Camadas e fronteiras — VALIDADO.** Auditor de server boundaries distingue Server Components/Server Actions e bloqueia primitives privilegiadas em Client Components.
3. **Multi-tenancy — VALIDADO.** Tenant write audit verde; RPCs críticas preservam autenticação/tenant/role/permissão.
4. **Banco e migrations — VALIDADO.** Reconciliação forward-only, FKs/policies corrigidas e fresh migration replay PostgreSQL 17 verde. A consolidação RLS remanescente foi tornada replay-safe para tabelas legadas opcionais existentes em ambientes long-lived.
5. **Integridade/transações — VALIDADO.** Pedidos/estoque usam locks transacionais; idempotência possui hash, replay, payload mismatch, uniqueness e reclaim protegidos por gate.
6. **Assíncrono — VALIDADO.** Job queue possui `FOR UPDATE SKIP LOCKED`, lease token, `locked_until`, heartbeat, retry/dead state e dedupe.
7. **Erros e observabilidade — VALIDADO.** QA production guard, proxy/auth resilience, ops readiness/load e performance readiness verdes.
8. **Dependências e supply chain — VALIDADO.** Production/full dependency audit e OSS license audit verdes.
9. **Deploy e rollback — VALIDADO.** Production readiness e deployment readiness verdes; rollback definido abaixo.
10. **Evidência integrada — VALIDADO.** CI #800, Supabase migration integrity #201, DR #251 e Development dependency audit #90 concluíram com SUCCESS no HEAD `046dd842...`.

## Evidência final de CI

HEAD validado: `046dd84266cd52aac0c0688cb5a830750d7b1331`.

- CI run #800: SUCCESS.
- Supabase migration integrity run #201: SUCCESS.
  - migration filenames: SUCCESS;
  - disposable Supabase/PostgreSQL 17 + replay completo: SUCCESS;
  - lint fresh database: SUCCESS.
- Disaster recovery drill run #251: SUCCESS.
- Development dependency audit run #90: SUCCESS.

O CI final inclui QA production guard, SECURITY DEFINER audit, Auth/proxy resilience, order status, idempotency/concurrency, observability/load, performance, lint, TypeScript, dependency audits, OSS licensing, Excel smoke, tenant writes, production readiness, deployment readiness e Next.js build.

## Banco / RLS / drift

A validação revelou tabelas legadas presentes em ambientes long-lived que não são criadas pelo histórico canônico de um banco vazio. A migration `20260911062000_architecture_rls_policy_consolidation_remaining.sql` foi corrigida para aplicar consolidação somente quando as tabelas e dependências correspondentes existem. Isso preserva o hardening dos ambientes reais e mantém o fresh replay reproduzível.

A consolidação RLS executada em Production nesta frente foi autorizada e não removeu dados. Alterações de policies e reconciliações permanecem versionadas e forward-only.

## Boundaries / SECURITY DEFINER / transações / filas

- `src/lib/supabase/server.ts` é explicitamente `server-only`.
- O auditor de boundaries bloqueia primitives administrativas no cliente.
- Fachadas públicas críticas auditadas permanecem SECURITY INVOKER; implementações privilegiadas ficam em `private` com validações e `search_path` controlado.
- SECURITY DEFINER e idempotência/concurrency passaram no CI.
- Pedidos/estoque mantêm locks transacionais.
- A fila mantém claim concorrente com `SKIP LOCKED`, lease, heartbeat, retry/dead e dedupe.

## Rollback

- Código: revert do merge/commit ou rollback do deployment Vercel.
- Banco: remediação exclusivamente forward-only restaurando comportamento/policies necessários; nunca reescrever migrations aplicadas.
- Dados: nunca apagar dados como mecanismo de rollback.

## Checklist

- [x] HEAD real da main identificado
- [x] branch isolada criada
- [x] Security/Performance Advisors avaliados
- [x] migration history reconciliado por estratégia forward-only reproduzível
- [x] boundaries privilegiadas auditadas
- [x] FKs sem índice avaliadas/corrigidas
- [x] policies redundantes avaliadas/corrigidas
- [x] fresh replay PostgreSQL 17 verde
- [x] lint de banco fresco verde
- [x] gates obrigatórios verdes
- [x] staging validado
- [x] evidência e rollback documentados
- [x] critérios de Arquitetura Geral 100% satisfeitos

## Estado de promoção

A implementação está **validated / ready for promotion**. O fundador concedeu autorização explícita para a sequência de promoção desta frente, incluindo merge da PR #110, deploy controlado e validação pós-promoção, com a restrição permanente de não apagar dados. A promoção deve continuar respeitando gates, smoke tests, isolamento da Santino e rollback não destrutivo.
