# Spec — SECURITY DEFINER surface hardening

Status: implementing
Updated: 2026-09-02
Priority: P0 security hardening

## Contexto e evidência

O Supabase Security Advisor sinaliza RPCs `SECURITY DEFINER` no schema `public` executáveis por `authenticated`. A aplicação precisa manter os contratos RPC públicos já consumidos pelo frontend, mas a implementação privilegiada não precisa permanecer exposta pelo Data API.

Funções alvo:

- `advance_order_status(uuid, order_status, text)`
- `cancel_order(uuid, text)`
- `reopen_order(uuid, text)`
- `gestify_ensure_stock_balance_for_product(uuid, uuid, text, text)`
- `enqueue_nutrition_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz, text, jsonb)`
- `current_user_can_manage_establishment(uuid)` quando presente
- `order_belongs_to_user(uuid, uuid)`

## Problema

Uma função `SECURITY DEFINER` no schema exposto `public`, quando executável por `authenticated`, torna-se uma superfície RPC privilegiada. Mesmo quando o corpo valida `auth.uid()`, tenant e papel, manter o privilégio elevado diretamente na superfície pública aumenta risco e ruído de advisor.

## Comportamento esperado

1. Os nomes e assinaturas públicas usados pela aplicação permanecem estáveis.
2. As fachadas em `public` passam a ser `SECURITY INVOKER`.
3. A implementação privilegiada é movida para `private` e renomeada com sufixo `_impl`.
4. `anon` e `PUBLIC` não recebem `EXECUTE`.
5. `authenticated` mantém somente os contratos necessários ao fluxo normal.
6. `order_belongs_to_user` não volta a ser executável por `authenticated`; o contrato atual de produção é preservado como `service_role` only.
7. Policies que usam `current_user_can_manage_establishment` continuam funcionando através da fachada invoker sem alterar semântica de tenant/admin.

## Invariantes de segurança

- Nenhuma operação pode aceitar tenant informado pelo cliente sem validar membership ativa do `auth.uid()`.
- Mudanças de status de pedido continuam limitadas ao estabelecimento do pedido e aos papéis já autorizados.
- Notificações de nutrição continuam validando membership, permissão de módulo e usuário alvo dentro do tenant.
- Inicialização de saldo continua impedindo produto de outro estabelecimento.
- `search_path` permanece explícito.
- Nenhuma permissão é ampliada para `anon` ou `PUBLIC`.

## Design técnico

Usar o padrão já existente em `accept_order`: mover a função privilegiada existente de `public` para `private`, renomeá-la para `*_impl` e recriar em `public` uma fachada `SECURITY INVOKER` com a mesma assinatura. Isso preserva a implementação já validada e reduz a alteração funcional ao mínimo.

## Testes e critérios de aceitação

- replay/migration integrity verde;
- lint/typecheck/audit/readiness/build verdes;
- auditoria estática de SECURITY DEFINER atualizada e verde;
- staging: fachadas públicas com `prosecdef = false`;
- staging: implementações privadas com `prosecdef = true`;
- staging: `anon` sem execute;
- staging: `authenticated` com execute apenas nas fachadas de negócio necessárias;
- Supabase Security Advisor sem os WARN de `authenticated_security_definer_function_executable` para essas fachadas;
- core E2E de pedidos permanece verde.

## Rollout

1. Aplicar apenas em staging.
2. Reexecutar advisors e testes de fluxo principal.
3. Abrir PR com evidências.
4. Produção somente após revisão/aprovação humana específica.

## Rollback

Reverter por migration complementar que remova as fachadas invoker e mova/renomeie cada implementação privada de volta ao schema `public`, restaurando grants anteriores. Não há alteração de dados.