# Regressão: `order_status = canceled`

## Estado

- Status: implementando
- Prioridade: P1 (falha funcional isolada em fluxo de pedidos)
- Data da evidência: 2026-08-19

## Evidência observada

O Postgres de produção registrou `invalid input value for enum order_status: "canceled"` em 2026-08-19T01:04:55.710Z.

O contrato canônico do Gestify usa `cancelado` para o status do pedido. O cancelamento suportado passa pela RPC `cancel_order`, que também preserva as validações de autenticação, membership, tenant e papel do usuário.

A busca no código atual não encontrou um caller do domínio de pedidos enviando `canceled`. Há usos legítimos de `canceled` em outros domínios (por exemplo, status de etiquetas), portanto uma substituição global seria incorreta.

## Comportamento esperado

1. Nenhum caller do domínio de pedidos deve gravar ou enviar `canceled` como `order_status`.
2. Cancelamentos devem usar `cancel_order` e resultar em `cancelado`.
3. O enum de produção não deve ganhar um alias `canceled`.
4. Usos legítimos de `canceled` fora de `order_status` devem continuar funcionando.

## Escopo da correção

- Adicionar auditoria estática para impedir a reintrodução de `canceled` em mutações/status de pedidos.
- Cobrir RPC `advance_order_status`, update direto em `orders.status` e cast para `order_status`.
- Preservar usos de `canceled` em outros domínios.
- Executar a auditoria no gate de CI/build antes do deploy.

## Fora de escopo

- Alterar o enum `order_status` em produção.
- Criar compatibilidade silenciosa no banco para `canceled`.
- Relaxar as validações da RPC de cancelamento.

## Critérios de aceite

- A auditoria falha para `p_to_status: "canceled"`.
- A auditoria falha para update de `orders.status = "canceled"`.
- A auditoria aceita `cancel_order`.
- A auditoria não acusa `inventory_labels.status = "canceled"`.
- Lint, typecheck, audit, tenant write audit, readiness e build permanecem verdes.
- Validação de staging não executa qualquer mutação em produção.

## Rollback

Reverter os commits desta branch remove apenas o gate estático/documentação. Nenhuma mudança de schema ou dado é necessária para rollback.
