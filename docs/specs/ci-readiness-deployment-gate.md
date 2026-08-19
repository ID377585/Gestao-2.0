# Gate de deployment readiness no CI

## Estado

- Status: implementing
- Prioridade: P1 de processo de release
- Data: 2026-08-19

## Contexto e evidência

O `package.json` define `npm run ci` incluindo `npm run readiness:deployment`, mas o workflow `.github/workflows/ci.yml` executa somente `readiness:check` antes dos contratos Supabase e do build.

Isso cria divergência entre o contrato local e o gate remoto: uma PR pode aparecer com CI verde sem ter executado o deployment readiness obrigatório pelo runbook do Gestify.

## Comportamento esperado

Toda execução do workflow principal de CI deve executar `npm run readiness:deployment` depois de `readiness:check` e antes do build.

## Invariantes

- não alterar Production;
- não alterar secrets;
- não executar DDL/DML;
- manter Preview/PR compatível com placeholders não sensíveis já usados pelo workflow;
- falhar fechado se o deployment readiness detectar condição inválida.

## Escopo

- adicionar o passo `Deployment readiness check` ao workflow principal de CI;
- preservar todos os gates existentes e sua ordem relativa;
- validar via GitHub Actions e Vercel Preview.

## Fora de escopo

- branch protection;
- merge automático;
- deploy de Production;
- alterações no conteúdo do checker `check-deployment-readiness.mjs`.

## Critérios de aceite

- workflow principal executa explicitamente `npm run readiness:deployment`;
- lint, typecheck, audit, Excel smoke, tenant write audit, readiness estático, deployment readiness, contratos Supabase/RLS e build passam;
- Vercel Preview fica READY;
- nenhuma mutation em Production.

## Rollback

Reverter o commit desta PR remove apenas o passo adicional do CI e esta spec. Nenhuma alteração de runtime, banco ou dados é necessária.
