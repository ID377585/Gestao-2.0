# Gestify Agent Harness v1

## Objetivo

Este harness organiza manutenção contínua e spec-driven do Gestify, preservando produção e usuários ativos.

## Ambientes conhecidos

- GitHub: `ID377585/Gestao-2.0`
- Supabase staging: `tuncavkhjazruijujatb` (`gestify-staging`)
- Supabase produção: `ubwbnpckbwtllitonpjj` (`ID377585's Project`)
- Vercel: `gestao-2-0`

## Estado inicial observado

O projeto já possui CI, auditoria de tenant, RLS/RPC, readiness, idempotência e job queue. O runbook de hardening exige staging-first e mantém itens sensíveis de `orders`/`order_status_events` para rollout controlado.

O agente deve evoluir o projeto incrementalmente e não reescrevê-lo do zero.

## Arquitetura de agentes

### 1. Orchestrator

Responsável por ler estado atual, consolidar evidências, atribuir prioridade e escolher uma única tarefa principal por ciclo.

Não implementa mudanças de produção. Mantém backlog e specs.

### 2. Security & Data Agent

Foco em RLS, RBAC, tenant isolation, RPCs, Auth, Storage, secrets, LGPD, rate limiting, audit logs, migrations, backups e restore.

Pode aplicar alterações em staging e produzir migrations. Produção é somente leitura sem aprovação específica.

### 3. Application Reliability Agent

Foco em bugs, APIs, server actions, idempotência, filas, transações, erros de runtime, contratos e testes.

### 4. Performance & UX Agent

Foco em queries, índices, caching, bundles, rendering, acessibilidade, UX e performance percebida.

### 5. Release Guardian

Revisa diff, CI, staging, advisors, rollback e critérios de liberação. Nunca aprova produção quando um gate obrigatório falhar.

## Coordenação

Agentes podem investigar em paralelo, mas alterações de código devem convergir para branches/PRs independentes e pequenos. Não permitir dois agentes editando simultaneamente o mesmo domínio crítico sem coordenação explícita do Orchestrator.

## Prioridade

1. P0 Segurança, isolamento, corrupção/perda de dados, indisponibilidade crítica.
2. P1 Erros de produção e fluxos centrais quebrados.
3. P2 Confiabilidade, observabilidade, backup, CI/CD, filas e idempotência.
4. P3 Performance e custos.
5. P4 UX/acessibilidade.
6. P5 Refactors e cosmética.

Dentro da mesma prioridade usar: impacto em usuários > risco de segurança > frequência > facilidade/reversibilidade.

## Ciclo de execução diário

1. Atualizar contexto a partir da `main` atual.
2. Ler PRs/issues abertas e commits recentes.
3. Ler Vercel errors/logs das últimas 24h.
4. Ler Supabase Security/Performance Advisors em staging e produção.
5. Verificar migrations e drift.
6. Comparar evidências com runbook e specs.
7. Selecionar um item principal de maior prioridade.
8. Criar/atualizar spec.
9. Criar branch isolada a partir da main atual.
10. Implementar a menor mudança segura.
11. Executar testes e gates.
12. Validar em staging.
13. Reexecutar advisors quando houver banco/RLS.
14. Abrir PR draft com evidências e rollback.
15. Registrar próximos itens.
16. Encerrar sem merge/deploy de produção.

## Convenção de branches

`agent/<dominio>/<slug>-YYYYMMDD`

Exemplos:

- `agent/security/revoke-order-rpc-execute-20260818`
- `agent/reliability/weather-timeout-fallback-20260818`
- `agent/performance/nutrition-fk-indexes-20260818`

## Loop e critérios de parada

- máximo de 3 tentativas para a mesma hipótese sem nova evidência;
- máximo de 8 ciclos de implementação/teste por tarefa;
- 2 ciclos sem progresso mensurável => parar e reformular hipótese;
- parar se houver risco de modificar dados reais indevidamente;
- parar se staging não reproduzir condição necessária;
- parar se testes contradisserem a hipótese;
- nunca contornar CI, RLS ou proteções para "resolver" mais rápido.

## Gates de segurança

Mudanças de banco devem ser aplicadas em staging antes de produção e ter migration versionada. Reexecutar Supabase Advisors após DDL/RLS.

Mudanças que envolvam `orders`, `order_status_events`, pagamentos, estoque, produção, fiscal ou auth exigem teste de regressão do fluxo afetado e rollback explícito.

Não remover índices apenas por aparecerem como não utilizados sem confirmar janela de observação, padrão de queries e impacto operacional.

## Gates de código

Executar, conforme aplicável:

```bash
npm run lint
npm run typecheck
npm run audit
npm run excel:smoke
npm run tenant:writes:ci
npm run runtime:imports:check
npm run readiness:check
npm run readiness:deployment
npm run build
```

Também executar testes específicos do módulo e os contratos Supabase quando os secrets de CI/staging estiverem disponíveis.

## Produção

Produção é um ambiente protegido. Por padrão o agente pode ler estado e diagnosticar, mas não:

- executar DDL/DML;
- aplicar migration;
- alterar secrets;
- excluir dados;
- fazer merge em main;
- promover deploy;
- alterar domínio/billing/configuração sensível.

Essas ações exigem aprovação humana explícita para a operação concreta.

## Evidência obrigatória no PR

Todo PR do agente deve conter:

- problema e prioridade;
- evidência observada;
- spec relacionada;
- arquivos/migrations alterados;
- riscos;
- testes executados e resultados;
- validação de staging;
- Advisors antes/depois quando aplicável;
- plano de rollback;
- impacto esperado em usuários;
- itens deliberadamente fora de escopo.

## Métricas de sucesso

Acompanhar ao longo do tempo:

- P0/P1 abertos;
- erros de runtime por rota;
- regressões de CI;
- findings dos Security Advisors;
- findings de tenant/RLS audits;
- tempo para restaurar backup testado;
- taxa de falha de jobs;
- latência p95 de APIs críticas;
- incidentes pós-release;
- módulos ainda bloqueando liberação comercial.

## Política comercial

Velocidade para vender não pode vir de remover gates. A forma de acelerar é reduzir escopo, atacar bloqueadores P0/P1 primeiro, manter PRs pequenos e reversíveis e usar staging como campo de validação.
