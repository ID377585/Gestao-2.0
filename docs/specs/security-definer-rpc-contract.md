# SECURITY DEFINER RPC contract

Status: validating
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

Leitura somente leitura de `pg_proc`/ACL em 2026-08-25 confirmou para as cinco funcoes:

- `SECURITY DEFINER = true`;
- owner `postgres`;
- `anon` sem `EXECUTE`;
- `authenticated` e `service_role` com `EXECUTE`;
- `search_path` explicitamente fixado;
- validacoes internas de autenticacao e escopo de estabelecimento.

As RPCs de pedido restringem role e prendem a linha do pedido com `FOR UPDATE`. A RPC de estoque exige membership ativo nao-`cliente` e produto do mesmo estabelecimento. A RPC de notificacao de Nutricao exige membership, permissao do modulo e valida o usuario-alvo no mesmo estabelecimento.

## Drift confirmado: Nutrição

A definicao live de `public.enqueue_nutrition_notification(...)` estava mais endurecida do que a ultima migration versionada. O replay anterior nao reproduzia integralmente:

- limites de `type`, `title`, `message`, `resource_type`, `dedupe_key` e payload;
- exigencia de payload JSON objeto e limite de 32 KiB;
- membership ativo no estabelecimento para chamadas de usuario;
- `user_module_permissions.module_key = 'nutricao'`, com permissao explicita prevalecendo sobre fallback administrativo;
- validacao de `target_user_id` como membro ativo do mesmo estabelecimento;
- `created_by = auth.uid()`;
- atualizacao completa do registro no caminho de deduplicacao;
- grants explicitos mantendo `anon`/`PUBLIC` sem `EXECUTE`.

## Migration versionada

A Supabase CLI 2.111.0 gerou oficialmente:

`supabase/migrations/20260825045423_harden_nutrition_notification_rpc.sql`

A migration usa `CREATE OR REPLACE FUNCTION`, fixa `search_path = private, public, auth, pg_temp`, preserva `SECURITY DEFINER` por ser a fronteira privilegiada deliberada e aplica ACL explicita:

- `PUBLIC`: sem EXECUTE;
- `anon`: sem EXECUTE;
- `authenticated`: EXECUTE;
- `service_role`: EXECUTE.

## Homologacao no staging

A definicao final foi aplicada diretamente somente no staging `tuncavkhjazruijujatb`, sem registrar uma migration MCP adicional, para evitar criar versao de historico divergente do arquivo versionado.

### Suíte adversarial da RPC de Nutrição

Executada em uma unica transacao com `ROLLBACK`. Para exercitar o FK real `nutrition_notifications.created_by -> auth.users`, foram criados quatro usuarios Auth sinteticos, nao autenticaveis e com dominio `.invalid`, apenas dentro da transacao; nenhuma conta, sessao ou fixture persistiu.

Matriz validada com resultado `PASS`:

- admin ativo sem permissao explicita recebe fallback administrativo e consegue enfileirar;
- `can_access = false` bloqueia inclusive admin;
- `can_access = true` restaura acesso;
- usuario `operacao` sem permissao explicita e bloqueado;
- usuario `operacao` com permissao explicita consegue enfileirar;
- tentativa de usar estabelecimento de outro tenant e bloqueada;
- `target_user_id` pertencente a outro tenant e bloqueado;
- membership inativa e bloqueada;
- payload JSON array e rejeitado;
- titulo acima de 240 caracteres e rejeitado;
- duas chamadas com o mesmo `dedupe_key` resultam em um unico registro e atualizam o conteudo esperado;
- role `anon` nao consegue executar a RPC.

O primeiro ensaio, usando apenas UUIDs sinteticos sem linhas em `auth.users`, falhou corretamente no FK de `created_by`; a estrategia foi corrigida sem relaxar constraint nem RLS.

## Security Advisor após homologação

Nao houve regressao de RLS aberto nem grant anonimo. O Advisor continua emitindo `authenticated_security_definer_function_executable` para RPCs que sao intencionalmente chamadas por usuarios autenticados. Esse aviso e tratado como superficie privilegiada a ser auditada, nao como justificativa para trocar automaticamente para `SECURITY INVOKER` e quebrar o fluxo oficial.

As tabelas server-only/default-deny continuam sem policies intencionalmente e nao recebem policies artificiais apenas para silenciar o Advisor.

## Risco

`SECURITY DEFINER` ignora RLS sob os privilegios do owner. Portanto a seguranca depende do contrato interno da funcao. Nao devemos simplesmente trocar para `SECURITY INVOKER`, pois as tabelas de pedido/estoque deliberadamente restringem DML direto e isso pode quebrar o fluxo oficial.

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

- auditoria estatica versionada das definicoes mais recentes das cinco RPCs;
- gate no CI sem secrets;
- migration aditiva para eliminar o drift da RPC de Nutrição;
- homologacao adversarial da RPC de Nutrição no staging;
- preservar a auditoria live existente para ACL/RLS no job confiavel de `main`.

## Fora de escopo desta etapa

- DDL/DML em Production;
- alterar grants de Production;
- converter funcoes diretamente para `SECURITY INVOKER` sem homologacao;
- mover implementacoes para schema privado sem prova de compatibilidade funcional.

## Criterios de aceite

- CI falha se uma das cinco definicoes perder `SECURITY DEFINER`, `search_path` ou validacoes essenciais;
- `anon` continua sem `EXECUTE` no ambiente live;
- replay limpo + `supabase db lint --fail-on error` com a migration real;
- suite adversarial da RPC de Nutrição: PASS;
- Security Advisor sem regressao critica;
- gates completos do repositorio;
- Vercel Preview READY.

## Rollout

1. guard estatico em PR: implementado;
2. bootstrap do staging: concluido;
3. migration da Nutrição gerada via CLI e versionada: concluido;
4. homologacao adversarial no staging: PASS;
5. Security Advisor: sem regressao critica;
6. replay/CI/Preview finais do HEAD atual;
7. revisao humana;
8. Production somente apos aprovacao humana especifica, lembrando que merge em `main` dispara deployment Production automaticamente.

## Rollback

A migration e `CREATE OR REPLACE FUNCTION` e nao altera dados existentes. Antes de qualquer Production, o rollback deve manter uma copia versionada da definicao anterior para restauracao por `CREATE OR REPLACE FUNCTION` e ACLs anteriores em caso de regressao funcional. Nenhuma mudanca foi feita em Production durante esta homologacao.
