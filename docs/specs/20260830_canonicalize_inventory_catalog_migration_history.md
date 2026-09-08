# Canonicalização do histórico de migrations do Catálogo

Status: implementing
Priority: P2
Date: 2026-08-30

## Contexto e evidência

O `main` em `22ebcf3fef43439a981292b59e4d6c5f0e180c0a` possui as migrations canônicas do Catálogo:

- `20260828213344_create_inventory_catalog.sql`
- `20260828213615_index_inventory_catalog_audit_users.sql`
- `20260828214500_harden_inventory_catalog_module_access.sql`

O histórico remoto diverge nos timestamps:

- staging: `20260828213344`, `20260828213615`, `20260828214323`;
- production: `20260828215348`, `20260828215401`, `20260828215411`.

O check Supabase Preview do HEAD falha com `Remote migration versions not found in local migrations directory`.

## Problema

O schema funcional do Catálogo está versionado, porém versões já registradas remotamente não existem no diretório local. Isso quebra a reprodutibilidade do histórico e impede que o Preview trate o repositório como fonte completa de migrations.

## Invariantes de segurança

- não alterar dados da Santino;
- não executar DDL/DML em Production;
- não apagar nem editar registros internos de migration history;
- não renomear migrations já versionadas;
- não reaplicar manualmente schema em Production;
- manter RLS e grants atuais do Catálogo intactos;
- toda correção deve ser reversível apenas por Git enquanto não houver promoção.

## Design

Adicionar migrations de histórico sem DDL/DML para os timestamps remotos que representam alterações já cobertas pelas migrations canônicas. O workflow `Supabase migration integrity` já reconhece migrations vazias/marker como mecanismo válido de preservação de histórico.

Markers iniciais deste lote:

- `20260828214323_harden_inventory_catalog_module_access_remote_history_marker.sql` — staging;
- `20260828215348_create_inventory_catalog_remote_history_marker.sql` — production;
- `20260828215401_index_inventory_catalog_audit_users_remote_history_marker.sql` — production;
- `20260828215411_harden_inventory_catalog_module_access_remote_history_marker.sql` — production.

As migrations canônicas permanecem como fonte funcional. Em ambientes onde a versão canônica ainda não esteja registrada, sua execução é projetada para ser idempotente no lote do Catálogo (`CREATE ... IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE FUNCTION`, `ON CONFLICT`).

## Testes e critérios de aceitação

1. validação de nomes/timestamps sem duplicatas;
2. fresh replay completo em Postgres 17;
3. `supabase db lint --local --level error --fail-on error`;
4. Supabase Preview deixa de acusar versões remotas ausentes;
5. gates normais de lint/typecheck/audit/build continuam verdes;
6. nenhuma escrita em Production.

## Rollout

1. branch isolada;
2. PR sem merge automático;
3. observar Supabase Preview e migration-integrity;
4. se ainda houver versão remota ausente, adicionar somente o marker correspondente após evidência;
5. somente após Preview verde considerar reconciliação concluída.

## Rollback

Antes de merge: excluir/reverter os marker files. Não existe rollback de banco porque esta etapa não executa SQL remoto.
