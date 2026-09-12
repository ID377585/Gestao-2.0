# Gestify Agent Contract

Este arquivo define o contrato operacional para agentes que atuem no Gestify.

## Missão

Melhorar continuamente segurança, estabilidade, correção, performance e prontidão comercial do SaaS Gestify sem interromper usuários ativos.

## Fontes de verdade

1. `main` atual do repositório `ID377585/Gestao-2.0`.
2. Migrations atuais do Supabase e estado real dos projetos.
3. Vercel deployments/logs atuais.
4. `docs/security/GESTIFY_SECURITY_HARDENING_RUNBOOK.md`.
5. `docs/agent/GESTIFY_AGENT_HARNESS.md`.
6. Specs em `docs/specs/`.

Documentação histórica nunca deve substituir o estado real do código, migrations e serviços.

## Regra de ouro

Nunca experimentar diretamente em produção. O caminho padrão é:

`observar -> especificar -> branch -> implementar -> testar -> staging -> evidência -> PR -> revisão humana -> produção`

## Prioridade

- **P0**: vazamento de dados, auth bypass, tenant escape, RLS insegura, segredo exposto, perda/corrupção de dados, indisponibilidade crítica.
- **P1**: erros de produção, regressões, falhas de fluxo principal, pagamentos/estoque/pedidos incorretos, migration inconsistente.
- **P2**: idempotência, filas, auditoria, observabilidade, backup/restore, CI/CD e confiabilidade.
- **P3**: performance, índices, cache, custos e eficiência.
- **P4**: UX, acessibilidade e fluidez.
- **P5**: refactors e melhorias cosméticas sem impacto direto.

## Autonomia permitida

O agente pode ler todo o repositório, issues, PRs, Actions, Supabase e Vercel; criar branches; editar código; criar migrations; executar testes; aplicar mudanças em staging; e abrir PRs.

## Ações que exigem aprovação humana específica

- merge em `main`;
- deploy/promoção para produção;
- DDL/DML em Supabase produção;
- exclusão de dados, tabelas, buckets, projetos ou backups;
- rotação/alteração de secrets de produção;
- mudanças de domínio, billing ou infraestrutura que possam impactar usuários ativos.

## Limites de loop

- no máximo 3 tentativas para a mesma hipótese sem nova evidência;
- no máximo 8 ciclos de implementação/teste por tarefa em uma execução;
- após 2 ciclos sem progresso mensurável, replanejar;
- interromper imediatamente ao detectar risco de impacto em produção, perda de dados ou isolamento de tenant.

## Gates obrigatórios

Antes de marcar um PR como pronto para revisão, executar os gates aplicáveis do projeto, incluindo lint, typecheck, dependency audit, tenant audit, readiness, build, testes específicos e Supabase Advisors para mudanças de banco.

Nunca reduzir um gate apenas para fazer o CI passar. Corrigir a causa ou documentar a exceção para revisão humana.
