# Readiness, monitoring and controlled load

Status: validated
Priority: P2/P3
Issue: #28

## Contexto

O Gestify já possui `/api/ops/readiness`, protegido por secret e rate limit, que verifica runtime, secrets, tabelas críticas e fila operacional. Faltavam execução periódica controlada e evidência objetiva de latência/capacidade em staging.

A implementação foi reaplicada sobre a `main` atual em 2026-08-27 para eliminar a defasagem histórica da PR #65.

## Objetivos

1. adicionar monitor periódico opt-in para o readiness;
2. adicionar harness manual de carga para staging/Preview com p50/p95/p99 e taxa de erro;
3. impedir tecnicamente que o harness de carga rode contra Production;
4. manter o contrato de segurança auditado no CI.

## Invariantes

- load test nunca roda contra `gestify.app`, `www.gestify.app` ou o domínio Production do projeto;
- load test bloqueia explicitamente o project ref Supabase Production `ubwbnpckbwtllitonpjj`;
- load test exige confirmação literal `load:gestify-staging`;
- load test aceita somente URL HTTP/HTTPS;
- monitoramento não modifica banco nem dados;
- segredo do readiness nunca é impresso;
- monitor periódico é opt-in via `GESTIFY_MONITORING_ENABLED=true`;
- carga é somente manual (`workflow_dispatch`) e nunca agendada;
- qualquer 5xx/429 ou taxa de erro acima do limite falha o job e preserva evidência no Actions.

## Métricas

- total de requests;
- errors e error rate;
- p50, p95 e p99;
- max latency;
- status codes.

## Critério inicial de carga

Para smoke controlado em staging/Preview:
- 100 requests;
- concorrência 5;
- error rate <= 1%;
- p95 <= 3000ms em rota pública leve.

Limites de negócio/DB mais agressivos devem ser definidos somente após baseline do staging.

## Observabilidade operacional

O monitor chama `/api/ops/readiness` a cada 15 minutos apenas quando habilitado. O job tem timeout e falha se o endpoint ou payload não estiver saudável.

A observabilidade do provedor continua complementar: erros/runtime da Vercel devem ser revisados para separar falhas reais da aplicação de falhas transitórias de upstream.

## Evidência observada em 2026-08-27

Na janela de 7 dias da Vercel foram observados erros concentrados em 2026-08-20 relacionados a `AuthRetryableFetchError`/status 522 e timeout de middleware, além de eventos residuais de refresh token e timeout do Open-Meteo. Isso reforça a necessidade do monitor de readiness e do baseline controlado em staging, sem justificar teste de carga em Production.

## Rollback

Reverter a PR remove workflows/scripts e a etapa de auditoria do CI. Nenhuma alteração de schema, tenant data, secrets ou configuração de Production é feita por esta PR.

## Critérios de aceitação

- branch baseada na `main` atual;
- CI completo verde;
- auditor `scripts/audit-ops-readiness-load.mjs` verde;
- Preview/staging saudável;
- primeiro smoke controlado em staging/Preview com evidência p50/p95/p99 e error rate;
- nenhum request de carga para Production.
