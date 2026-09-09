# Spec — CI/CD readiness 100

Status: implementing
Updated: 2026-09-09
Priority: P2 reliability / CI-CD

## Contexto e evidência

A `main` já exige CI principal e replay de migrations, mas o pipeline ainda apresenta gaps objetivos para um contrato de CI/CD 100%:

1. o workflow `Development dependency audit` encontra vulnerabilidades HIGH transitivas em tooling/devDependencies;
2. workflows ainda usam Actions oficiais `@v4`, que hoje executam sob compatibilidade forçada com Node 24 e emitem avisos de depreciação do runtime Node 20.

## Objetivo

Fechar os gaps reproduzíveis de CI/CD sem afrouxar gates, sem alterar runtime de negócio e sem tocar Production diretamente.

## Invariantes

- nenhum gate de segurança pode ser removido ou tornado não-bloqueante;
- `npm audit --omit=dev --audit-level=high` deve continuar verde;
- o audit completo deve ficar sem HIGH/CRITICAL;
- `npm ci` deve continuar determinístico pelo lockfile;
- lint, typecheck, tenant writes, readiness, build e migration replay devem permanecer verdes;
- Actions oficiais devem usar versões atuais compatíveis com Node 24;
- nenhum secret deve ser incluído no repositório;
- nenhuma mudança de banco, Auth, RLS ou tenant.

## Mudanças planejadas

- atualizar overrides transitivos vulneráveis para versões corrigidas compatíveis;
- regenerar `package-lock.json` de modo reproduzível;
- atualizar Actions oficiais usadas pelos workflows para versões atuais;
- manter artefatos de auditoria e falha explícita para findings HIGH/CRITICAL;
- adicionar contrato estático de CI/CD para impedir regressão dos itens acima.

## Critérios de aceitação

- Development dependency audit: PASS, 0 HIGH/CRITICAL;
- Production dependency audit: PASS;
- CI principal: PASS;
- Fresh migration replay on Postgres 17: PASS;
- Vercel Preview: READY;
- sem avisos de Action baseada no runtime Node 20 nos jobs atualizados;
- branch protection/ruleset da main permanece exigindo PR e checks obrigatórios.

## Rollback

Reverter a PR. Como o escopo é workflow/package metadata/lockfile, não existe rollback de banco ou dados tenant.
