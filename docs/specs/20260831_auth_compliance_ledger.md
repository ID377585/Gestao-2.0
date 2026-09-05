# Auth compliance ledger hardening

Status: validated

## Contexto e evidência

O fluxo anterior de compliance gravava telemetria e aceite contratual em `auth.users.app_metadata` e permitia que o guard criasse aceite implicitamente. O runtime também dependia de tabelas próprias de compliance que inicialmente não existiam em staging nem Production.

## Resultado validado

- `auth.users` permanece responsável por identidade/autenticação; acesso e aceite rotineiros não alteram `app_metadata`.
- O aceite da versão vigente é persistido em `public.user_terms_acceptances`, ledger append-only.
- Acesso autenticado é persistido em `public.user_access_logs`, também append-only.
- O guard apenas consulta o ledger e redireciona para consentimento explícito quando necessário.
- `POST /api/auth/compliance` exige `acceptTerms: true`.
- `establishment_id` é derivado server-side de membership ativa.
- `anon` e `authenticated` não têm acesso direto às tabelas.
- RLS está habilitado e forçado.
- `service_role` possui somente `SELECT` e `INSERT`, sem `UPDATE`/`DELETE`.
- Uma versão de termos só pode ser aceita uma vez por usuário.

## Evidência

- Staging: migrations canônicas `20260901110313` e `20260901110454` aplicadas e validadas.
- Production: schema preparado de forma controlada antes do cutover da aplicação; RLS e grants validados sem usar dados reais da Santino.
- Marcadores `20260902133545` e `20260902133555` preservam as versões registradas no histórico remoto de Production sem duplicar DDL.
- Fresh migration replay em PostgreSQL 17: success.
- DB lint: success.
- CI completo: success, incluindo segurança, auth/proxy, lint, typecheck, dependency audit, tenant writes, readiness e build.
- Vercel Preview do HEAD: READY.
- Fixture backup and restore drill: success.
- Security Advisor de Production: nenhuma regressão atribuível às novas tabelas; findings remanescentes são anteriores e fora deste escopo.

## Compatibilidade com usuários existentes

Aceites antigos existentes apenas em metadata não são convertidos automaticamente em novos registros jurídicos. Usuários sem registro no novo ledger deverão manifestar aceite explícito da versão vigente. Isso evita transformar evidência histórica potencialmente implícita em evidência nova sem ação inequívoca do usuário.

## Rollback

Após Production, rollback deve ser forward-only e preservar o ledger jurídico. As tabelas e registros de aceite não devem ser apagados para reverter código.
