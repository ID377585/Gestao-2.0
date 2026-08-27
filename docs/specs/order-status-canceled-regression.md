# Regressão: `order_status = canceled`

## Estado

- Status: validated
- Prioridade: P1
- Evidência inicial: 2026-08-19
- Revalidação: 2026-08-27

## Problema

Production registrou `invalid input value for enum order_status: "canceled"`. O contrato canônico do Gestify usa `cancelado`; cancelamentos suportados passam por `cancel_order`.

## Correção

A PR #55 mantém uma auditoria estática que bloqueia:

- `p_to_status: "canceled"` em `advance_order_status`;
- update direto de `orders.status = "canceled"`;
- cast de `"canceled"` para `order_status`.

Usos legítimos de `canceled` em outros domínios continuam permitidos.

## Regressão integrada

A revalidação de 27/08/2026 ampliou a PR #55 com uma suíte E2E transacional para staging. Ela percorre o ciclo canônico `pedido_criado -> aceitou_pedido -> em_preparo -> em_separacao -> em_faturamento -> em_transporte -> entregue`, valida eventos de status, isolamento cross-tenant e membership inativa, e termina com `ROLLBACK`.

## Critérios de aceite

- auditoria estática do status: PASS;
- lifecycle completo no staging: PASS;
- pelo menos seis eventos canônicos de status: PASS;
- tentativa cross-tenant: negada;
- membership inativa: negada;
- nenhuma fixture persiste no staging;
- nenhuma alteração de enum/schema em Production.

## Rollout e rollback

A mudança é somente teste/CI/documentação. Reverter a PR remove os guards e a suíte. Não há DDL/DML de Production associado.
