# Nutrition duplicate index cleanup

Status: validated
Priority: P2
Issue: #58

## Contexto

O Supabase Performance Advisor do staging persistente identificou dois pares de índices UNIQUE duplicados no módulo de Nutrição.

Consulta direta a `pg_indexes` confirmou definições idênticas:

- `nutrition_document_versions_unique` e `nutrition_document_versions_unique_idx`: `(establishment_id, document_id, version)`;
- `nutrition_pop_versions_unique` e `nutrition_pop_versions_unique_idx`: `(establishment_id, pop_id, version)`.

Consulta a `pg_constraint` confirmou que os índices **sem** `_idx` são os backing indexes das constraints UNIQUE e devem ser preservados. Os índices com `_idx` não sustentam constraints.

## Problema

Manter índices UNIQUE idênticos duplica custo de escrita e armazenamento sem benefício de consulta/integridade.

## Escopo

Remover somente:
- `public.nutrition_document_versions_unique_idx`;
- `public.nutrition_pop_versions_unique_idx`.

## Fora de escopo

- não remover backing indexes das constraints;
- não remover índices apenas marcados como `unused_index` no staging vazio;
- não tratar FKs sem índice nesta migration;
- não consolidar policies RLS nesta migration.

## Migration versionada

A Supabase CLI 2.111.0 gerou oficialmente:

`supabase/migrations/20260825051118_cleanup_nutrition_duplicate_indexes.sql`

A migration contém somente dois `DROP INDEX IF EXISTS` para os índices `_idx` redundantes e não altera dados, constraints, RLS, policies ou grants.

O passo temporário usado no CI para gerar o timestamp oficial foi removido imediatamente; o workflow de integridade voltou ao conteúdo original.

## Homologação no staging

O DDL equivalente foi aplicado somente no staging `tuncavkhjazruijujatb` para homologação. A migration **não foi registrada no histórico remoto do staging**, pois as migrations P0 #57 (`20260825044140`) e #59 (`20260825045423`) ainda não foram promovidas para `main`/histórico canônico. Isso evita criar histórico fora de ordem ou uma nova versão MCP divergente.

Após o DDL:

- `nutrition_document_versions_unique_idx` não existe mais;
- `nutrition_pop_versions_unique_idx` não existe mais;
- `nutrition_document_versions_unique` permanece e continua backing index da constraint UNIQUE `(establishment_id, document_id, version)`;
- `nutrition_pop_versions_unique` permanece e continua backing index da constraint UNIQUE `(establishment_id, pop_id, version)`.

## Advisors após homologação

### Performance Advisor

Os dois avisos `duplicate_index` correspondentes aos pares de Nutrição desapareceram. Permanecem itens separados de dívida estrutural:

- FKs sem índices em vários módulos;
- `unused_index` no staging ainda sem carga representativa — não usar como justificativa para remoção;
- `multiple_permissive_policies`, que exigem revisão semântica de RLS por módulo;
- configuração Auth com número absoluto de conexões, que não faz parte desta migration.

### Security Advisor

Nenhuma regressão foi introduzida. Permanecem apenas:

- tabelas server-only/default-deny com RLS e sem policies (`api_idempotency_keys`, `app_job_queue`, `demo_leads`);
- warnings de RPCs `SECURITY DEFINER` executáveis por `authenticated`, já tratados pelo contrato/auditoria da PR #59.

Não apareceu RLS desabilitado, policy em tabela com RLS desligado ou novo grant anônimo.

## Invariantes

- constraints UNIQUE continuam válidas: confirmado;
- nenhum dado foi alterado: confirmado;
- RLS/policies/grants não mudaram: confirmado;
- Security Advisor sem regressão: confirmado;
- Production não foi alterada: confirmado;
- replay limpo deve continuar verde no HEAD final;
- gates completos e Preview ainda devem ser revalidados no HEAD documental final.

## Testes finais

1. replay completo Postgres 17 no HEAD final;
2. `supabase db lint --local --level error --fail-on error`;
3. lint/typecheck/audit/tenant writes/readiness/deployment readiness/build;
4. Vercel Preview READY.

## Rollout

A ordem canônica futura é:

1. #57 — `20260825044140_fix_replay_rls_contract.sql`;
2. #59 — `20260825045423_harden_nutrition_notification_rpc.sql`;
3. #62 — `20260825051118_cleanup_nutrition_duplicate_indexes.sql`.

Como cada merge em `main` dispara deployment Production automaticamente, nenhuma dessas PRs deve ser mergeada sem aprovação humana específica para o efeito em Production. Após os merges anteriores, as PRs posteriores devem ser atualizadas sobre a nova `main` e revalidadas antes de promoção.

## Rollback

Se necessário, recriar explicitamente apenas os dois índices redundantes:

- `CREATE UNIQUE INDEX nutrition_document_versions_unique_idx ON public.nutrition_document_versions (establishment_id, document_id, version);`
- `CREATE UNIQUE INDEX nutrition_pop_versions_unique_idx ON public.nutrition_pop_versions (establishment_id, pop_id, version);`

As constraints UNIQUE não dependem desses índices redundantes.