# Spec — Supabase RPC security readiness 100%

Status: validated
Updated: 2026-09-09
Priority: P0 security hardening

## Contexto e evidência

Production ainda expõe cinco RPCs `SECURITY DEFINER` executáveis por `authenticated` no schema `public`: `advance_order_status`, `cancel_order`, `reopen_order`, `gestify_ensure_stock_balance_for_product` e `enqueue_nutrition_notification`.

Staging já recebeu e validou a migration histórica `20260902143000_harden_security_definer_rpc_surface`, mas o arquivo ainda não estava presente na `main` porque a PR original não foi promovida. Production ainda não registra essa versão.

A documentação atual do Supabase recomenda manter implementações `SECURITY DEFINER` fora de schemas expostos, restringir `EXECUTE` explicitamente e preferir `SECURITY INVOKER` na superfície pública.

## Problema

Uma implementação privilegiada diretamente no schema exposto aumenta a superfície de ataque e é sinalizada pelo Security Advisor. A correção precisa preservar assinaturas públicas, autorização, tenant isolation e comportamento transacional.

## Comportamento esperado

1. As cinco RPCs públicas permanecem com os mesmos nomes e assinaturas consumidos pela aplicação.
2. As fachadas em `public` são `SECURITY INVOKER`.
3. As implementações privilegiadas ficam no schema `private` com sufixo `_impl`.
4. `PUBLIC` e `anon` não recebem `EXECUTE` nas fachadas nem implementações.
5. `authenticated` mantém apenas as RPCs necessárias aos fluxos existentes.
6. `order_belongs_to_user` continua `service_role` only.
7. Nenhuma linha de negócio ou tenant é transformada por esta migration.
8. O replay limpo deve produzir o mesmo contrato validado em staging.

## Invariantes de segurança

- `auth.uid()` e as validações atuais de membership/role/permissão permanecem dentro das implementações privilegiadas existentes.
- Nenhuma operação cross-tenant passa a ser permitida.
- Nenhum grant é ampliado para `anon` ou `PUBLIC`.
- Nenhuma secret/service-role key é exposta ao cliente.
- O schema `private` permanece fora da superfície Data API pública.
- A migration histórica aplicada em staging não é renumerada nem reescrita com outro timestamp.

## Design técnico

Restaurar na árvore versionada a migration já aplicada em staging sob a mesma versão `20260902143000`, mover as implementações privilegiadas de `public` para `private`, recriar fachadas públicas `SECURITY INVOKER` e atualizar a auditoria estática para falhar caso uma futura migration volte a deixar essas RPCs como `SECURITY DEFINER` públicas.

## Evidência de validação

- Staging: `public_authenticated_security_definer_count = 0`.
- Staging: `public_anon_security_definer_count = 0`.
- Staging: cinco fachadas alvo `SECURITY INVOKER`; implementações privilegiadas em `private.*_impl`.
- Staging: `order_belongs_to_user` permanece `service_role` only.
- Staging: zero tabelas públicas sem RLS.
- Staging Security Advisor: zero WARN `authenticated_security_definer_function_executable`.
- Production read-only: cinco WARN alvo permanecem inalterados até promoção autorizada.
- A migration versionada preserva exatamente a versão já aplicada em staging: `20260902143000`.
- O gate de dependências de produção também foi endurecido com versões corrigidas de Next.js, `sharp` e `@xmldom/xmldom`; o lockfile foi regenerado de forma reproduzível sem desabilitar o `npm audit`.

## Testes e critérios de aceitação

- auditoria estática `audit-security-definer-rpcs.mjs` verde;
- lint verde;
- typecheck verde;
- dependency audit de produção verde;
- tenant writes audit verde;
- readiness check/deployment verde;
- build verde;
- migration replay/integrity verde;
- staging: cinco fachadas públicas com `prosecdef = false`;
- staging: implementações privadas com `prosecdef = true`;
- staging: `PUBLIC`/`anon` sem execute;
- staging: contratos de `authenticated`/`service_role` preservados;
- staging: Security Advisor com zero WARN `authenticated_security_definer_function_executable`;
- testes de pedidos/estoque/nutrição sem regressão de autorização.

## Rollout

1. Branch isolada baseada na `main` atual.
2. Preservar migration histórica exata já aplicada em staging.
3. Validar estado físico e grants em staging.
4. Rerodar Security Advisor e gates de CI.
5. PR pronta para revisão somente após todos os gates finais do HEAD definitivo.
6. Production somente após autorização humana específica para merge e DDL/promoção.

## Rollback

Em caso de regressão após futura promoção, aplicar migration forward-only que remova as fachadas invoker e mova/renomeie as implementações privadas de volta ao schema `public`, restaurando os grants anteriores. Não reescrever migration já aplicada e não alterar dados tenant.
