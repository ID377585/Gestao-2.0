# CI production secret isolation

Status: implementing
Priority: P1
Owner: Daily Maintainer
Related PR: #44

## Contexto e evidência

O workflow principal de CI era executado em eventos `pull_request` e `push` para `main`, com `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY` definidos no `env` do job inteiro. Isso tornava a credencial administrativa disponível a todos os passos de CI de uma pull request.

Há evidência operacional de checks de contrato/RLS atingindo o projeto Supabase de produção durante execuções de PR. Mesmo quando os scripts atuais são diagnósticos, a disponibilidade da credencial privilegiada no job cria uma fronteira de confiança inadequada para código ainda não mesclado.

## Problema

Pull requests não devem receber credenciais Supabase de produção. Um PR capaz de alterar scripts executados pelo CI não pode ter acesso a uma chave administrativa de produção antes de revisão e merge.

## Impacto

Risco de leitura ou mutação privilegiada em produção a partir de código de PR, inclusive por automações de desenvolvimento. O risco é agravado porque `service_role`/secret key contorna RLS.

## Comportamento esperado

- CI de `pull_request` usa somente placeholders não sensíveis ou credenciais explicitamente não produtivas.
- Credenciais Supabase de produção nunca ficam no `env` global do job de validação.
- Checks que realmente precisam consultar produção rodam somente após `push` para `main`.
- Secrets de produção são injetados somente nos passos estritamente necessários.
- QA/E2E mutável continua protegido pelo hard guard de project ref.

## Invariantes

- nenhum segredo de produção disponível para código de pull request;
- nenhuma mudança em banco, Auth, Storage ou dados de produção por esta alteração;
- nenhuma redução de lint, typecheck, audit, tenant audit, readiness ou build;
- contrato Supabase e auditoria RLS continuam obrigatórios em `main` quando secrets estiverem configurados;
- Santino permanece protegida contra qualquer escrita automatizada.

## Escopo

- `.github/workflows/ci.yml`;
- hard guard/auditoria QA já incluídos no PR #44;
- separação do job de validação e do job de contrato de produção.

## Fora de escopo

- rotação de secrets;
- configuração de GitHub Environment protegido;
- alteração de permissões Supabase;
- qualquer DDL/DML em produção;
- merge ou deploy de produção.

## Design técnico

O job `validate` recebe apenas placeholders. Um job separado `production-contract` é condicionado a `push` na `main`. A URL e a secret key reais são passadas apenas aos passos `Supabase contract` e `Order RLS/RPC audit`, além de um passo mínimo de validação de presença dos secrets.

## Testes

- GitHub Actions deve iniciar o job `validate` em PR sem acesso a secrets reais;
- `production-contract` deve ser `skipped` em PR;
- lint/typecheck/audit/smoke/tenant audit/readiness/build devem permanecer verdes;
- após merge aprovado, `production-contract` deve rodar em `push` para `main` e falhar fechado caso os secrets necessários estejam ausentes.

## Critérios de aceitação

1. Nenhuma expressão `${{ secrets.* }}` aparece no `env` global do job `validate`.
2. Nenhum passo de PR executa `supabase:contract` ou `orders:rls:ci` contra produção.
3. Secrets reais aparecem somente no job `production-contract`, condicionado a `push` em `main`.
4. O QA production guard permanece ativo.
5. CI do PR fica verde sem tocar produção.

## Rollout

Somente por PR. Não requer alteração de banco ou Vercel.

## Rollback

Reverter o commit de workflow restaura o comportamento anterior, mas isso reabre a exposição de secrets em PR e portanto não é recomendado exceto para diagnóstico controlado.
