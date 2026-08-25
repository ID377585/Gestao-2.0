# Core FK indexes — phase one

Status: implementing
Priority: P2/P3
Issue: #58

## Contexto

O Supabase Performance Advisor do staging persistente identifica FKs sem índice cobridor. Esta fase trata somente um bloco pequeno de relações core fora do grande conjunto de Nutrição.

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
- índice deve ser criado primeiro no staging;
- Security Advisor não pode regredir;
- Performance Advisor deve deixar de sinalizar estas FKs;
- replay limpo + db lint + gates completos.

## Rollback

`DROP INDEX IF EXISTS` somente para os oito índices criados por esta migration.

## Ordem

Esta migration será posterior às migrations preparadas nas PRs #57, #59 e #62. Não deve ser promovida antes delas sem rebase/revalidação da ordem canônica.
