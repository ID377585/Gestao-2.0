# Nutrition duplicate index cleanup

Status: implementing
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

## Invariantes

- constraints UNIQUE devem continuar válidas;
- nenhum dado deve ser alterado;
- RLS/policies/grants não mudam;
- replay limpo deve continuar verde;
- Production não é alterada sem aprovação específica.

## Testes

1. replay completo Postgres 17;
2. `supabase db lint --local --level error --fail-on error`;
3. aplicar primeiro no staging;
4. confirmar que os `_idx` desapareceram;
5. confirmar que as duas constraints UNIQUE e seus backing indexes permanecem;
6. reexecutar Performance e Security Advisors;
7. gates completos do repositório + Preview.

## Rollout

Esta mudança deve ser promovida somente depois das migrations P0 #57 (`20260825044140`) e #59 (`20260825045423`) para manter ordem canônica do histórico.

## Rollback

Recriar os dois índices redundantes com `CREATE UNIQUE INDEX` nas mesmas colunas, somente se houver necessidade comprovada. As constraints não dependem deles.