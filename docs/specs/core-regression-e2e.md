# Regressão/E2E final do core Gestify

## Estado

- Status: validated em staging
- Prioridade: P1
- PR: #55
- Data: 2026-08-27

## Objetivo

Transformar a regressão isolada de status da PR #55 em uma verificação reutilizável dos principais contratos operacionais do Gestify, sem usar Production como ambiente de teste.

## Escopo

A suíte `scripts/qa/staging-core-e2e.sql` cria somente fixtures sintéticas dentro de uma transação e executa `ROLLBACK` ao final. O cenário cobre:

1. contexto autenticado sintético e membership ativa;
2. dois tenants independentes e um usuário com membership inativa;
3. criação de produto, pedido e itens;
4. ciclo completo do pedido até `entregue` por `advance_order_status`;
5. trilha de eventos de status;
6. tentativa de mutação cross-tenant negada;
7. usuário inativo negado;
8. movimentação e saldo de estoque coerentes;
9. fatura e item de fatura com total coerente, representando a base usada por faturamento/exportação;
10. unicidade do ledger de idempotência;
11. invariantes de concorrência: `FOR UPDATE` no avanço de status e índice UNIQUE do ledger por usuário/tenant/operação/chave.

## Idempotência no servidor

O gate `scripts/audit-idempotency-contract.mjs` protege o contrato de `runIdempotentAction`:

- hash SHA-256 estável;
- tratamento explícito de `23505`;
- rejeição de reutilização da chave com payload diferente;
- replay de operação concluída;
- bloqueio de operação ainda em processamento;
- reclaim atômico apenas após expiração do lock;
- conclusão somente a partir de `processing`;
- registro de falha;
- unicidade tenant-scoped e global no schema;
- `FOR UPDATE SKIP LOCKED` na fila de jobs.

## Evidência executada em staging

Execução contra `gestify-staging` (`tuncavkhjazruijujatb`) retornou:

- `result = PASS`;
- `final_order_status = entregue`;
- `status_events = 6`;
- `final_stock = 3` após saldo inicial 5 e movimento -2;
- `invoice_total = 20`;
- `idempotency_unique = true`;
- `order_lock_contract = true`.

A transação terminou com `ROLLBACK`; nenhuma fixture sintética permaneceu.

## Concorrência: interpretação correta

A suíte valida os mecanismos de serialização que impedem corrida lógica no banco: row lock `FOR UPDATE`, UNIQUE para a chave idempotente e `SKIP LOCKED` para leases de jobs. Saturação com múltiplas conexões simultâneas e p95/p99 pertence ao teste de carga controlado e não deve ser confundida com a regressão funcional desta PR.

## Invariantes de segurança

- Production nunca é alvo da suíte E2E.
- Fixtures usam UUIDs aleatórios e são revertidas.
- Nenhum segredo é versionado.
- Nenhum alias `canceled` é criado no enum.
- Nenhuma RLS/policy é relaxada para testes.
- Cross-tenant e membership inativa precisam falhar.

## Gates

Antes de promoção:

- Order status contract audit;
- idempotency/concurrency contract audit;
- lint;
- typecheck;
- production dependency audit;
- Excel smoke;
- tenant writes audit;
- readiness:check;
- readiness:deployment;
- build;
- Vercel Preview READY.

## Rollback

Esta PR altera apenas arquivos de teste, CI e documentação. O rollback é a reversão da PR. Não há migration nem dado de Production a desfazer.
