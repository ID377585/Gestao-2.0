# P0 — Middleware auth timeout

Status: implementing

## Evidência

Em 2026-08-20, produção apresentou 504 `MIDDLEWARE_INVOCATION_TIMEOUT` em `gestify.app`. A Vercel registrou 27 ocorrências de middleware sem resposta inicial em 25s e erros `AuthRetryableFetchError` 522. Os logs de Auth do Supabase mostram chamadas `GET /user` com latências anormais, incluindo dezenas e centenas de segundos.

## Problema

`src/middleware.ts` executa `supabase.auth.getUser()` no caminho crítico de todas as rotas protegidas/autenticação. `getUser()` depende de uma chamada remota ao Auth `/user`; quando esse upstream degrada, a Vercel encerra o middleware antes de qualquer resposta e o sistema fica inacessível.

## Impacto e prioridade

P0 de disponibilidade: usuários autenticados não conseguem acessar o Gestify mesmo com conexão e Vercel operacionais.

## Comportamento esperado

A validação criptográfica da sessão no middleware não deve depender de uma chamada remota ao endpoint `/user` quando claims JWT verificáveis estiverem disponíveis. Regras de termos, tenant e permissões de módulo devem permanecer inalteradas.

## Invariantes de segurança

- não confiar em `user_metadata` para autorização;
- manter `app_metadata` para compliance de termos;
- manter verificação criptográfica do JWT;
- não remover checagem de membership/tenant/permissão de módulo;
- não fazer fail-open em caso de sessão inválida;
- nenhuma mudança de RLS, schema, dado ou secret.

## Design

Substituir `auth.getUser()` por `auth.getClaims()` no middleware e derivar:

- `userId` de `claims.sub`;
- compliance de termos de `claims.app_metadata`.

Todo o restante do fluxo do middleware permanece igual.

## Critérios de aceitação

- lint e typecheck verdes;
- audit e tenant write audit verdes;
- `readiness:check` e `readiness:deployment` verdes;
- build verde;
- Preview Vercel READY;
- login e rota protegida respondem sem `MIDDLEWARE_INVOCATION_TIMEOUT` no Preview;
- nenhum novo erro de autorização/tenant;
- rollback é simplesmente reverter o commit do middleware.

## Rollout

Primeiro Preview. Produção somente após evidência verde e autorização humana específica para merge/deploy.