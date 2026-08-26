# Core FK indexes — phase one

Status: validated
Priority: P2/P3
Issue: #58

## Contexto

O Supabase Performance Advisor do staging persistente identificava FKs sem índice cobridor. Esta fase trata somente um bloco pequeno de relações core fora do grande conjunto de Nutrição.

## Escopo

Adicionar índices simples e aditivos para as colunas das FKs:
- `company_subscriptions.plan_slug`;
- `hr_bank_hours.user_id`;
- `hr_employee_schedules.user_id`;
- `hr_time_clock_adjustments.event_id`;
- `music_player_settings.default_station_id`;
- `tenant_invitations.accepted_by`;
- `tenant_invitations.invited_by`;
- `user_module_permissions.updated_by`.

## Fora de escopo

- remover índices classificados apenas como `unused_index`;
- consolidar policies RLS;
- adicionar dezenas de índices de Nutrição numa única migration;
- alterar constraints/FKs ou dados.

## Segurança e invariantes

- migration aditiva com `CREATE INDEX IF NOT EXISTS`;
- nenhum RLS/grant/policy muda;
- índice criado primeiro no staging;
- Security Advisor sem regressão atribuível a esta migration;
- Performance Advisor não sinaliza mais estas oito FKs como não indexadas;
- replay, db lint, CI e Preview devem permanecer verdes.

## Evidência de staging

A migration homologada no staging é `20260825140647_core_fk_indexes_phase_one`. Os oito índices estão presentes no catálogo de `pg_indexes`. O Performance Advisor atual não lista estas oito FKs em `unindexed_foreign_keys`; os índices recém-criados podem aparecer como `unused_index` até receberem carga real, o que não é motivo para remoção nesta fase.

## Rollback

`DROP INDEX IF EXISTS` somente para os oito índices criados por esta migration.

## Ordem

Esta migration é posterior às migrations já promovidas de replay/RLS e RPC hardening e foi rebaseada sobre a `main` após a fundação de DR (#63).
