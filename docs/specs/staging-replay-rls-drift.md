# Staging replay RLS drift

## Estado

- Status: implementing
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

A correção definitiva será uma migration aditiva, gerada pela Supabase CLI conforme o runbook, que deve:

1. habilitar RLS de forma idempotente nas tabelas críticas do replay;
2. restaurar/reconciliar policies core ausentes usando `DROP POLICY IF EXISTS` + `CREATE POLICY` quando aplicável;
3. retirar o grant anônimo de `current_user_can_manage_establishment(uuid)` e manter os roles necessários;
4. fixar `search_path` das funções identificadas;
5. preservar o comportamento default-deny das tabelas internas;
6. não modificar dados de tenant.

O nome/version da migration não será inventado manualmente. A criação do arquivo deve ser feita por `supabase migration new` ou fluxo oficial equivalente da CLI.

## Validação obrigatória

- replay limpo do histórico completo;
- `supabase migration list` consistente;
- `supabase db lint --fail-on error` verde;
- Security Advisor sem `rls_disabled_in_public` e sem `policy_exists_rls_disabled`;
- `anon_execute = false` para `current_user_can_manage_establishment(uuid)`;
- testes tenant A/B para leitura e escrita;
- usuário inativo negado;
- roles sem permissão negadas;
- fluxos legítimos de pedidos e fichas técnicas preservados;
- gates do repositório: lint, typecheck, audit, tenant writes, readiness, deployment readiness e build.

## Performance

O Performance Advisor do staging novo também lista FKs sem índice, policies permissivas sobrepostas e dois pares de índices duplicados no módulo de Nutrição. Esses itens serão tratados separadamente após o fechamento do P0 de segurança. Avisos de `unused_index` em staging recém-criado não são evidência suficiente para remoção.

## Rollout

1. gerar migration via CLI;
2. validar em replay descartável;
3. aplicar primeiro no staging persistente;
4. reexecutar Security/Performance Advisors;
5. executar suíte adversarial multiempresa;
6. abrir PR com evidências;
7. somente após aprovação específica considerar Production.

## Rollback

Antes de qualquer promoção para Production, a migration final deve documentar rollback compatível com o estado live. Durante a fase atual, as alterações são exclusivas do staging e podem ser reconstruídas pelo workflow de bootstrap.