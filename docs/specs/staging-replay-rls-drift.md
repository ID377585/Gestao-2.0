# Staging replay RLS drift

## Estado

- Status: validated
- Prioridade: P0
- Issue: #56
- Data da evidência: 2026-08-25

## Contexto e evidência

O primeiro bootstrap persistente do Supabase staging `tuncavkhjazruijujatb` concluiu com sucesso a aplicação do histórico versionado de migrations. Em seguida, o Security Advisor revelou que o replay completo não reproduziu integralmente o estado de segurança do Supabase Production `ubwbnpckbwtllitonpjj`.

O staging recriado apresentou tabelas públicas com policies existentes mas RLS desabilitado e outras tabelas core sem as policies que existem no ambiente live. A comparação de `pg_class.relrowsecurity` e `pg_policies` com Production foi feita somente leitura.

## Impacto

Um replay limpo, restore ou novo ambiente criado apenas a partir do histórico versionado pode apresentar autorização diferente da Production. Isso compromete isolamento de tenant, confiabilidade de disaster recovery e a capacidade de homologar alterações com segurança.

## Estado observado no replay

Após o bootstrap, foi necessário habilitar RLS no staging para tabelas que já estão protegidas em Production, incluindo:

- `establishment_memberships`
- `establishments`
- `inventory_labels`
- `memberships`
- `order_invoice_items`
- `order_invoices`
- `order_items`
- `order_line_items`
- `pre_invoice_items`
- `pre_invoices`
- `products`
- `profiles`
- `technical_sheets`
- `user_notification_preferences`

Depois de habilitar RLS, o Advisor expôs ausência de policies no replay para:

- `establishments`
- `memberships`
- `order_items`
- `order_line_items`
- `technical_sheets`

As policies live de Production foram lidas e reproduzidas temporariamente somente no staging para validação. Em `order_line_items`, o ramo legado `auth.role() = 'service_role'` foi removido das policies `TO authenticated`, preservando membership ativa como condição de autorização.

## Hardening adicional validado no staging

- `public.update_updated_at_column()` com `search_path = pg_catalog, public`;
- `public.set_updated_at()` com `search_path = pg_catalog, public`;
- `private.gestify_legacy_table_names()` com `search_path = pg_catalog, private`;
- `anon` sem `EXECUTE` em `public.current_user_can_manage_establishment(uuid)`;
- `authenticated` e `service_role` preservados para `current_user_can_manage_establishment(uuid)` porque a função é usada por policies internas.

Após a validação, o Security Advisor deixou de apontar RLS desabilitado, mutable `search_path` e execução anônima da função privilegiada. As tabelas `api_idempotency_keys`, `app_job_queue` e `demo_leads` continuam RLS-enabled sem policy como default-deny/server-only e não devem receber policy apenas para silenciar o Advisor.

## Migration versionada

A Supabase CLI 2.111.0 gerou oficialmente:

`supabase/migrations/20260825044140_fix_replay_rls_contract.sql`

O replay descartável completo em Postgres 17 passou com a migration real e `supabase db lint --local --level error --fail-on error` verde.

A migration foi aplicada no staging persistente. Como a ação MCP `apply_migration` atribuiu inicialmente uma versão própria (`20260825045114`), o metadado do staging foi reconciliado em transação guardada para a versão canônica do arquivo (`20260825044140`) sem alterar schema ou dados de negócio. `list_migrations` confirmou o histórico alinhado.

## Suíte adversarial multiempresa

Executada no staging em uma única transação com fixtures sintéticas e `ROLLBACK`, sem usuários Auth reais e sem persistência de dados.

Matriz validada:

- Tenant A enxerga apenas seu próprio `establishment`;
- Tenant A não enxerga `establishment` do Tenant B;
- `memberships` ficam restritas ao usuário autenticado;
- Tenant A enxerga apenas sua própria `technical_sheet`;
- Tenant A não lê `technical_sheet` do Tenant B;
- Tenant A enxerga apenas seu próprio `order_line_item`;
- insert legítimo de `technical_sheets` no Tenant A funciona;
- insert cross-tenant em `technical_sheets` é bloqueado por RLS;
- insert legítimo de `order_line_items` no Tenant A funciona;
- insert cross-tenant em `order_line_items` é bloqueado por RLS;
- `current_user_can_manage_establishment` retorna `true` para o próprio tenant e `false` para o outro tenant;
- usuário com membership inativa não lê establishment nem ficha técnica e não recebe permissão de gestão;
- role `anon` não consegue executar `current_user_can_manage_establishment`.

Resultado final da suíte: `PASS`.

## Comportamento esperado

1. Um ambiente novo criado somente a partir das migrations deve reproduzir o contrato de segurança esperado.
2. Toda tabela de negócio exposta deve sair do replay com RLS habilitado.
3. Policies de tenant/propriedade devem existir no replay antes de qualquer teste funcional.
4. Funções `SECURITY DEFINER` não devem ser executáveis por `anon` salvo requisito explícito e documentado.
5. `search_path` de funções relevantes deve ser fixado.
6. `service_role` não deve ser modelado por `auth.role()` dentro de policy `TO authenticated`.

## Invariantes de segurança

- Nenhuma alteração deste item é aplicada diretamente em Production durante desenvolvimento/homologação.
- `TO authenticated` nunca é suficiente sem predicado de tenant/propriedade quando o dado é multiempresa.
- Não criar policy permissiva para tabelas server-only apenas para remover aviso de linter.
- Não usar `user_metadata` em autorização.
- Não ampliar grants de `anon`.

## Design técnico

A correção definitiva é uma migration aditiva que:

1. habilita RLS de forma idempotente nas tabelas críticas do replay;
2. restaura/reconcilia policies core ausentes usando `DROP POLICY IF EXISTS` + `CREATE POLICY`;
3. retira o grant anônimo de `current_user_can_manage_establishment(uuid)` quando a função existe e mantém os roles necessários;
4. fixa `search_path` das funções identificadas quando presentes;
5. preserva o comportamento default-deny das tabelas internas;
6. não modifica dados de tenant.

## Validação obrigatória

- replay limpo do histórico completo: concluído;
- `supabase db lint --fail-on error` verde: concluído;
- Security Advisor sem `rls_disabled_in_public` e sem `policy_exists_rls_disabled`: concluído;
- `anon_execute = false` para `current_user_can_manage_establishment(uuid)`: concluído no staging;
- testes tenant A/B para leitura e escrita: PASS;
- usuário inativo negado: PASS;
- fluxos legítimos de fichas técnicas e itens de pedido preservados: PASS no escopo RLS da suíte;
- gates do repositório: em validação no HEAD atual.

## Performance

O Performance Advisor do staging novo também lista FKs sem índice, policies permissivas sobrepostas e pares de índices duplicados no módulo de Nutrição. Esses itens serão tratados separadamente após o fechamento do P0 de segurança. Avisos de `unused_index` em staging recém-criado não são evidência suficiente para remoção.

## Rollout

1. migration gerada via CLI: concluído;
2. replay descartável: concluído;
3. aplicação no staging persistente: concluído;
4. Security Advisor: concluído sem regressão crítica de RLS;
5. suíte adversarial multiempresa: PASS;
6. CI/Preview final;
7. revisão humana;
8. somente após aprovação específica considerar Production.

## Rollback

Durante homologação, o staging pode ser reconstruído integralmente pelo workflow de bootstrap. A migration é aditiva e idempotente; em Production, qualquer rollback futuro deve restaurar explicitamente as policies anteriores somente se houver regressão funcional comprovada. Nenhuma alteração em Production foi realizada nesta validação.
