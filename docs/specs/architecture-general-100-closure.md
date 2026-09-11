# Arquitetura Geral — fechamento técnico 100%

Estado: validated
Data: 2026-09-11
Base auditada: main `2b4e92216f7bc5932cf2446d10d5eb1e1b2cc1e8`
Prioridade: P1/P2

## Contexto

O Gestify está em uso ativo. Esta frente suspende temporariamente o avanço de LGPD para concentrar a manutenção no fechamento objetivo da Arquitetura Geral, sem alterar Production nem interromper usuários.

## Resultado

**Arquitetura Geral: 100% no escopo técnico definido nesta spec.**

Este 100% significa que os dez critérios técnicos abaixo estão implementados e sustentados por evidência reproduzível em branch/CI/staging. Não significa risco operacional ou de segurança literalmente zero e não autoriza merge/deploy em Production.

## Invariantes

- Production permaneceu somente leitura durante esta frente.
- Toda alteração passou por branch, gates, staging, evidência e PR draft.
- Nenhuma correção enfraqueceu RLS, isolamento de tenant, autenticação, idempotência ou rollback.
- `establishment_id` e autorização server/database permanecem fronteiras de segurança.
- O replay completo das migrations em Postgres 17 foi validado no HEAD da branch.

## Matriz final — critérios de 100%

1. **Topologia e runtime — VALIDADO.** Node 22.x; runtime/import contracts presentes; CI completo verde.
2. **Camadas e fronteiras — VALIDADO.** Cliente administrativo concentrado em módulos server-only; novo `audit-server-boundaries.mjs` bloqueia primitives privilegiadas em Client Components e exige boundary explícita fora de route handlers.
3. **Multi-tenancy — VALIDADO.** Tenant write audit verde; RPCs críticas validam autenticação/tenant/role/permissão; nenhuma rota conhecida de tenant escape foi encontrada nesta auditoria.
4. **Banco e migrations — VALIDADO.** Fundação faltante de staging reconciliada forward-only; FKs/policies corrigidas; fresh migration replay Postgres 17 e database lint verdes.
5. **Integridade/transações — VALIDADO.** Contratos de pedidos/estoque usam row/advisory transaction locks; idempotência possui hash, replay, payload mismatch, uniqueness e reclaim protegidos por gate.
6. **Assíncrono — VALIDADO.** Job queue possui `FOR UPDATE SKIP LOCKED`, lease token, `locked_until`, heartbeat, retry/dead state e dedupe.
7. **Erros e observabilidade — VALIDADO.** QA production guard, proxy/auth resilience, ops readiness/load e performance readiness passaram no CI.
8. **Dependências e supply chain — VALIDADO.** Production audit, full dependency audit e OSS license audit verdes; evidência OSS gerada pelo workflow.
9. **Deploy e rollback — VALIDADO.** Production readiness e deployment readiness verdes; rollback documentado nesta spec e na PR.
10. **Evidência integrada — VALIDADO.** CI run 783 verde; migration integrity run 184 verde; DR run 233 verde; development dependency audit run 72 verde.

## Evidência final de staging

### Security Advisor

Sem WARN/ERROR. Restam somente 12 INFO `rls_enabled_no_policy` em tabelas deliberadamente sem acesso direto autenticado/cliente, incluindo `api_idempotency_keys`, `app_job_queue` e tabelas de compliance/service-only. A existência de RLS sem policy aqui é deny-by-default e não é tratada como regressão.

Remediação/referência do Advisor: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

### Performance Advisor

As categorias arquiteturalmente impeditivas observadas no início foram eliminadas:

- `unindexed_foreign_keys`: não aparece mais;
- `multiple_permissive_policies`: não aparece mais.

Restam apenas:

- `unused_index` INFO — 305 ocorrências. Não remover em massa com base em staging sem carga representativa; vários índices são novos, de FK, segurança ou acesso operacional e ainda não acumularam uso.
- `auth_db_connections_absolute` INFO — configuração operacional de capacidade do Auth; deve ser revista quando houver scale-up da instância, não é falha arquitetural do código/schema.

Referências do Advisor:
- https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- https://supabase.com/docs/guides/deployment/going-into-prod

## Evidência final de CI

HEAD validado da branch: `6eafaf7ad190f62f7f2b4f4c830fe1773dce47c8` antes deste commit documental.

Workflow CI run `34559913795` / run number 783: SUCCESS.

Passaram:
- QA production guard audit;
- SECURITY DEFINER RPC audit;
- Proxy/auth resilience contract;
- Order status contract audit;
- Idempotency and concurrency contract audit;
- Readiness monitoring and load guard audit;
- Performance readiness audit;
- lint;
- TypeScript;
- production dependency audit;
- full dependency audit;
- OSS license compliance audit;
- Excel export smoke;
- tenant write audit;
- production readiness static check;
- deployment readiness check;
- Next.js build.

Workflow Supabase migration integrity run `34559913868` / run number 184: SUCCESS.
- migration filenames: SUCCESS;
- disposable Supabase stack + replay completo: SUCCESS;
- lint fresh database: SUCCESS.

Outros workflows do mesmo HEAD:
- Disaster recovery drill run 233: SUCCESS;
- Development dependency audit run 72: SUCCESS.

## Boundaries / SECURITY DEFINER / transações / filas

- `src/lib/supabase/server.ts` é explicitamente `server-only`.
- O auditor de boundaries bloqueia uso de primitives administrativas no cliente.
- Fachadas públicas críticas auditadas permanecem SECURITY INVOKER; implementações privilegiadas ficam em `private` e mantêm validações de auth/tenant/role e `search_path` controlado.
- O gate SECURITY DEFINER passou no CI.
- O gate de idempotência/concurrency passou no CI.
- Pedidos/estoque mantêm locks transacionais.
- A fila mantém claim concorrente com `SKIP LOCKED`, lease, heartbeat, retry/dead e dedupe.

## Decisão sobre INFOs residuais

Os INFOs residuais dos Advisors não reduzem o score arquitetural porque não representam falha conhecida de isolamento, integridade, autorização, reproducibilidade ou runtime:

- RLS sem policy em tabelas service-only implementa deny-by-default para clientes;
- índices sem uso não devem ser removidos sem workload representativo;
- estratégia absoluta de conexões Auth é capacidade operacional e deve ser revista junto com futuro scale-up.

Esses itens continuam observáveis como dívida operacional/performance, sem bloquear o fechamento técnico da arquitetura.

## Rollback

- Código: reverter os commits da PR #110 antes de merge, ou usar revert após eventual merge autorizado.
- Banco: qualquer reversão deve ser forward-only, restaurando policies/índices anteriores; nunca reescrever histórico aplicado.
- Production: nenhuma alteração foi feita nesta etapa.

## Checklist

- [x] HEAD real da main identificado
- [x] branch isolada criada
- [x] Security Advisor de staging executado
- [x] Performance Advisor de staging executado
- [x] lacunas arquiteturais iniciais registradas
- [x] staging/migration history reconciliado por estratégia forward-only reproduzível
- [x] boundaries privilegiadas auditadas
- [x] FKs sem índice avaliadas/corrigidas
- [x] policies redundantes avaliadas/corrigidas
- [x] Security Advisor sem regressão
- [x] Performance Advisor sem dívida arquitetural impeditiva
- [x] gates obrigatórios verdes
- [x] staging validado
- [x] PR com evidência e rollback
- [x] critérios de Arquitetura Geral 100% integralmente satisfeitos

## Estado de promoção

A implementação está **validated**, mas a PR #110 deve permanecer draft até decisão humana de promoção. Merge em `main`, deploy Vercel Production ou DDL/DML em Supabase Production continuam fora desta autorização e exigem aprovação específica.
