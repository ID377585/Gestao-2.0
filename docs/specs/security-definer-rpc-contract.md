# SECURITY DEFINER RPC contract

Status: implementing
Priority: P0
Owner: Gestify Maintainer

## Contexto

O Supabase Security Advisor sinaliza RPCs `SECURITY DEFINER` no schema exposto `public` que podem ser chamadas por `authenticated`. Esse desenho pode ser legitimo quando a RPC e a unica fronteira de escrita e faz autorizacao interna rigorosa, mas qualquer regressao em autenticacao, tenant, role, `search_path` ou grants pode virar bypass de RLS.

As funcoes atualmente auditadas sao:

- `advance_order_status(uuid, order_status, text)`
- `cancel_order(uuid, text)`
- `reopen_order(uuid, text)`
- `gestify_ensure_stock_balance_for_product(uuid, uuid, text, text)`
- `enqueue_nutrition_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz, text, jsonb)`

## Estado observado em Production

Leitura de `pg_proc`/ACL em 2026-08-25 confirmou para as cinco funcoes:

- `SECURITY DEFINER = true`;
- owner `postgres`;
- `anon` sem `EXECUTE`;
- `authenticated` e `service_role` com `EXECUTE`;
- `search_path` explicitamente fixado;
- validacoes internas de autenticacao e escopo de estabelecimento.

As RPCs de pedido restringem role e prendem a linha do pedido com `FOR UPDATE`. A RPC de estoque exige membership ativo nao-`cliente` e produto do mesmo estabelecimento. A RPC de notificacao de Nutricao exige membership, permissao do modulo e valida o usuario-alvo no mesmo estabelecimento.

## Risco

O Advisor continua correto em sinalizar a superficie: `SECURITY DEFINER` ignora RLS sob os privilegios do owner. Portanto a seguranca depende do contrato interno da funcao. Nao devemos simplesmente trocar para `SECURITY INVOKER`, pois as tabelas de pedido/estoque deliberadamente restringem DML direto e isso pode quebrar o fluxo oficial.

## Comportamento esperado

Para qualquer RPC `SECURITY DEFINER` exposta a `authenticated`:

1. `anon` e `PUBLIC` nao podem executar;
2. `search_path` deve ser fixo e incluir apenas schemas esperados;
3. chamadas de usuario devem exigir `auth.uid()`;
4. o tenant deve ser derivado/validado contra membership ativo;
5. IDs recebidos devem ser novamente vinculados ao tenant antes de leitura/escrita;
6. roles/permissoes devem ser verificadas explicitamente;
7. toda escrita privilegiada deve manter trilha/auditoria quando aplicavel;
8. novos `SECURITY DEFINER` em `public` devem falhar no CI ate serem adicionados conscientemente ao contrato.

## Escopo desta etapa

- adicionar auditoria estatica versionada das definicoes mais recentes das cinco RPCs;
- executar essa auditoria no CI sem secrets;
- preservar a auditoria live existente para ACL/RLS no job confiavel de `main`;
- documentar que a refatoracao para implementacoes privadas deve ser testada primeiro em staging.

## Fora de escopo desta etapa

- DDL/DML em Production;
- alterar grants de Production;
- converter funcoes diretamente para `SECURITY INVOKER` sem homologacao;
- mover implementacoes para schema privado antes do bootstrap do staging.

## Criterios de aceite

- CI falha se uma das cinco definicoes perder `SECURITY DEFINER`, `search_path` ou validacoes essenciais;
- CI falha se surgir um novo `SECURITY DEFINER` no schema `public` sem entrada explicita no contrato;
- `anon` continua sem `EXECUTE` no ambiente live;
- a suite adversarial de staging comprova tenant A -> B negado para cada RPC mutavel;
- Security Advisor e reavaliado depois de qualquer refatoracao DDL.

## Rollout

1. Guard estatico em PR.
2. Bootstrap do staging.
3. Testes live de ACL/tenant no staging.
4. Refatoracao para implementacoes privadas apenas onde reduzir superficie sem quebrar o fluxo.
5. Nova rodada de Security Advisor.
6. Producao somente apos revisao humana e rollback documentado.

## Rollback

A auditoria desta etapa nao muda runtime nem banco. Reverter o commit remove apenas o gate estatico; nenhuma reversao de dados e necessaria.
