# Production schema drift reconciliation

Status: implementing
Priority: P1
Issue: #68

## Contexto e evidência

A migration `20260825140647_core_fk_indexes_phase_one` foi homologada no staging, mas sua tentativa de aplicação em Production foi abortada transacionalmente porque o schema live não contém todos os pré-requisitos esperados pelo replay atual.

A comparação read-only de `supabase_migrations.schema_migrations` e do catálogo PostgreSQL confirmou que staging/replay e Production seguiram históricos diferentes no módulo de player/RH a partir de 28/07/2026:

- staging/repo usa a migration canônica `20260728020943_add_music_player_and_hr_time_clock`;
- Production preserva a cadeia histórica `create_music_player_settings`, `create_hr_time_clock_internal_control`, `add_hr_time_clock_shift_guard` e `fix_music_player_hr_clock_schema_compat` com timestamps próprios;
- por isso, não é seguro simplesmente marcar a migration canônica como aplicada nem executá-la retroativamente sobre Production.

Diferenças objetivas relevantes:

- `public.hr_employee_schedules` existe no staging e não existe em Production;
- `public.hr_bank_hours` existe no staging e não existe em Production;
- `public.hr_holidays` existe no staging e não existe em Production;
- `public.hr_time_clock_adjustments` existe nos dois ambientes, porém Production mantém o contrato legado (`user_id`, `shift_id`, `work_date`, `adjustment_minutes`, `created_by`) enquanto staging possui o contrato canônico (`event_id`, `target_user_id`, `actor_user_id`, `action`, `before_data`, `after_data`);
- `public.hr_time_clock_events` mantém uma linha em Production e não pode sofrer reconstrução destrutiva;
- `public.hr_time_clock_adjustments` e `public.hr_time_clock_settings` estão vazias em Production na auditoria de 26/08/2026;
- a aplicação da #66 não deixou efeitos parciais.

## Problema

O replay atual representa o contrato desejado, mas Production possui uma linhagem histórica compatível com o runtime e parcialmente diferente. Reexecutar migrations antigas, editar migrations históricas ou criar objetos isolados manualmente pode destruir compatibilidade, alterar autorização ou tornar o histórico irrecuperável.

## Comportamento esperado

Uma nova migration de reconciliação deve convergir Production para os pré-requisitos necessários sem apagar dados ou substituir tabelas existentes. O resultado deve permitir aplicar/confirmar os oito índices da migration #66 e preservar o runtime atual.

## Invariantes de segurança e tenant

- nenhuma tabela existente com dados será recriada ou truncada;
- nenhuma coluna será removida;
- RLS deve permanecer habilitada em todas as tabelas públicas envolvidas;
- novas tabelas usam as mesmas policies tenant-aware do replay canônico;
- `anon` não recebe privilégios novos;
- `authenticated` recebe somente os grants já previstos pelo contrato canônico;
- a reconciliação do contrato legado de `hr_time_clock_adjustments` deve abortar se existirem linhas no momento da execução, para impedir transformação implícita ou perda semântica;
- a migration deve ser idempotente quanto à existência dos objetos esperados;
- Production não será alterada sem aprovação humana específica.

## Design técnico

1. Criar, somente se ausentes, `hr_employee_schedules`, `hr_bank_hours` e `hr_holidays` com constraints, RLS, grants e policies equivalentes ao replay canônico.
2. Em `hr_time_clock_events`, adicionar somente campos canônicos ausentes que não exigem reescrita de dados e relaxar `NOT NULL` de `shift_id`/`created_by` apenas se necessário para compatibilidade futura; a linha existente deve permanecer intacta.
3. Em `hr_time_clock_adjustments`:
   - detectar o contrato legado pela presença de `user_id`/`adjustment_minutes` e ausência de `event_id`;
   - abortar se a tabela possuir qualquer linha;
   - adicionar os campos canônicos e respectivas FKs/constraints;
   - manter as colunas legadas como compatibilidade, tornando-as nullable quando necessário para que inserts canônicos não sejam bloqueados;
   - substituir a policy de leitura legado-dependente por policies canônicas de seleção/inserção;
   - nunca apagar as colunas legadas nesta fase.
4. Preservar o PK legado de `hr_time_clock_settings`; o runtime já faz fallback explícito entre campos canônicos e legados. Não haverá reconstrução da tabela nesta correção.
5. Criar/confirmar os oito índices da #66 com `CREATE INDEX IF NOT EXISTS` somente depois dos pré-requisitos existirem.

## Fora de escopo

- apagar colunas legadas de RH;
- reescrever o histórico de migrations de Production;
- remover índices sinalizados como `unused_index`;
- alterar dados de ponto, biometria, usuários ou tenants;
- promover qualquer DDL diretamente para Production nesta etapa.

## Validação

- aplicar a migration primeiro no staging persistente;
- confirmar objetos, RLS, policies, grants e os oito índices;
- executar Security e Performance Advisors sem regressão de segurança;
- executar replay/fresh migration integrity e `db lint` pelo CI;
- executar `npm run lint`, `npm run typecheck`, `npm run audit`, `npm run tenant:writes:ci`, `npm run readiness:check`, `npm run readiness:deployment` e `npm run build`;
- validar Preview Vercel;
- antes de Production, repetir a pré-condição read-only de contagem de `hr_time_clock_adjustments`; se não for zero, abortar rollout e replanejar.

## Rollout

1. homologar em staging;
2. abrir PR com evidências e rollback;
3. obter aprovação humana específica para DDL em Supabase Production;
4. executar pré-flight read-only em Production;
5. aplicar a migration de reconciliação;
6. reexecutar Advisors e confirmar os oito índices;
7. somente depois considerar a issue #68 resolvida e a #66 concluída.

## Rollback

A migration é deliberadamente aditiva e preserva as estruturas legadas. Se houver regressão antes de uso dos novos objetos, o rollback revisado pode remover somente índices/policies/tabelas novas comprovadamente vazias. Não remover automaticamente colunas adicionadas nem reconstruir tabelas em Production. Qualquer rollback de Production exige revisão e aprovação específica.
