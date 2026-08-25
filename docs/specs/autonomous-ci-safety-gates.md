# Autonomous CI safety gates

Status: implementing
Priority: P1
Owner: Gestify Maintainer

## Contexto

A auditoria semanal identificou tres bloqueadores para ampliar com seguranca a autonomia do Gestify: pull requests recebendo credenciais de producao no job geral de CI, ausencia do gate `readiness:deployment` no workflow principal e falta de um bloqueio versionado contra QA/E2E mutavel apontando para o Supabase de producao.

## Problema

Sem esses controles, codigo ainda nao mesclado pode executar com credenciais privilegiadas, um CI pode ficar verde sem validar readiness de deploy e scripts de QA podem atingir o ambiente errado.

## Impacto

Risco P1 de automacao: uma futura rotina de auto-merge/deploy poderia confiar em um conjunto incompleto de gates ou permitir que codigo de PR tivesse acesso desnecessario a Production.

## Comportamento esperado

- PRs usam somente placeholders nao sensiveis no job `validate`.
- Credenciais reais de Production aparecem apenas no job `production-contract`, executado somente apos push em `main`.
- `npm run readiness:deployment` e obrigatorio no job `validate`.
- todo script QA/E2E potencialmente mutavel que use Supabase precisa do guard compartilhado de target.
- Production `ubwbnpckbwtllitonpjj` e recusada explicitamente para mutacoes QA/E2E.
- mutacoes automatizadas de QA so podem ocorrer em staging `tuncavkhjazruijujatb` com `GESTIFY_QA_ALLOW_WRITES=true`.

## Invariantes

- nenhuma alteracao de dados, Auth, Storage ou schema de Production.
- nenhuma escrita em tenants reais.
- Empresa Santino permanece imutavel para automacoes.
- lint, typecheck, dependency audit, tenant audit, readiness e build permanecem obrigatorios.

## Escopo

- `.github/workflows/ci.yml`
- `scripts/audit-qa-production-guards.mjs`
- `scripts/qa/assert-safe-supabase-target.mjs`

## Fora de escopo

- branch protection configurada no GitHub (controle de repositorio, nao codigo versionado).
- DDL/DML em Production.
- rotacao de secrets.
- restore drill.

## Testes e criterios de aceite

1. CI da PR passa sem acesso a secrets reais de Production.
2. `production-contract` nao roda em pull_request.
3. `readiness:deployment` roda no job `validate`.
4. auditoria de QA production guards passa.
5. Preview Vercel fica READY.
6. nenhuma alteracao de banco e realizada.

## Rollout

Branch isolada -> PR -> CI/Preview -> revisao -> merge. Depois do merge, validar o job `production-contract` no push da `main`.

## Observabilidade

Registrar conclusao dos jobs do GitHub Actions e estado do Vercel Preview. Em caso de falha, nao promover.

## Rollback

Reverter o merge restaura o workflow anterior, mas reabre os riscos de exposicao de secrets em PR e de CI incompleto; portanto usar rollback apenas para diagnostico controlado.
