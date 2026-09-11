# Arquitetura Geral — fechamento técnico 100%

Estado: implementing
Data: 2026-09-11
Base auditada: main `2b4e92216f7bc5932cf2446d10d5eb1e1b2cc1e8`
Prioridade: P1/P2

## Contexto

O Gestify está em uso ativo. Esta frente suspende temporariamente o avanço de LGPD para concentrar a manutenção no fechamento objetivo da Arquitetura Geral, sem alterar Production nem interromper usuários.

## Objetivo

Só classificar Arquitetura Geral como 100% quando todos os critérios abaixo estiverem implementados e sustentados por evidência reproduzível. Percentual não será elevado por documentação sem validação.

## Invariantes

- Production permanece somente leitura durante esta frente, salvo aprovação humana específica.
- Toda alteração passa por branch, gates, staging, evidência e PR.
- Nenhuma correção pode enfraquecer RLS, isolamento de tenant, autenticação, idempotência ou rollback.
- `establishment_id` e autorização server/database continuam sendo fronteiras de segurança.
- Staging deve representar o código/migrations versionados antes de promoção.

## Critérios de 100%

1. **Topologia e runtime** — versões/runtime/configuração coerentes e imports incompatíveis bloqueados por CI.
2. **Camadas e fronteiras** — browser não recebe service role; operações privilegiadas ficam no servidor; contratos de módulos críticos são explícitos.
3. **Multi-tenancy** — writes e RPCs críticos tenant-scoped; ausência de caminho conhecido de tenant escape.
4. **Banco e migrations** — migrations reproduzíveis; staging sem drift estrutural não documentado; RLS/grants coerentes.
5. **Integridade/transações** — fluxos críticos usam transação/idempotência onde a repetição ou falha parcial possa corromper estado.
6. **Assíncrono** — filas/leases/crons têm ownership, retry e falha observável.
7. **Erros e observabilidade** — falhas críticas possuem comportamento seguro e diagnóstico suficiente sem vazar dados sensíveis.
8. **Dependências e supply chain** — audit de produção sem vulnerabilidade high/critical não aceita; licenças e versões runtime verificadas.
9. **Deploy e rollback** — readiness e deployment gates reproduzíveis; rollback documentado.
10. **Evidência integrada** — lint, typecheck, audit, tenant writes, runtime imports, readiness, deployment readiness, build e testes específicos verdes.

## Evidência inicial observada

- `main` atual: `2b4e92216f7bc5932cf2446d10d5eb1e1b2cc1e8`, commit assinado.
- `package.json` fixa Node 22.x e contém gates de lint, typecheck, audit, licenças, tenant writes, runtime imports, readiness, deployment readiness e build.
- Existem workflows dedicados para CI, migration integrity, staging plan/apply, DR, readiness monitor e staging load test.
- Security Advisor de staging: nenhuma finding WARN/ERROR retornada; 11 INFO `rls_enabled_no_policy`, incluindo tabelas service-only. Essas ocorrências precisam permanecer justificadas por grants e modelo de acesso.
- Performance Advisor de staging encontrou 7 foreign keys sem índice de cobertura e 23 ocorrências de múltiplas policies permissivas. Isso é dívida técnica real e impede declarar 100% neste momento.
- O staging recebeu recentemente apenas uma fundação estrutural parcial da migration LGPD v2; antes de declarar coerência banco/migrations, o histórico/conteúdo aplicado deve ser reconciliado com a migration versionada.

## Lacunas confirmadas — primeira auditoria

### A1 — Integridade staging ↔ migrations (P1)
Confirmar versão registrada em staging para `legal_compliance_v2_foundation`, comparar com `supabase/migrations/20260909210000_legal_compliance_v2_foundation.sql` e eliminar divergência de maneira reproduzível, sem tocar Production.

### A2 — Foreign keys sem índice (P3)
Avaliar e, quando apropriado, criar índices para as 7 FKs apontadas pelo Performance Advisor. Não remover índices apenas por estarem marcados como unused em staging sem carga representativa.

### A3 — Policies permissivas redundantes (P2/P3)
Revisar as 23 ocorrências. Consolidar apenas quando equivalência de autorização puder ser demonstrada e testada; prioridade para tabelas tenant-sensitive.

### A4 — Boundaries do código (P2)
Auditar service-role imports, server/client boundaries, writes tenant-scoped, RPCs privilegiadas, cron/worker e rotas críticas. Converter achados reproduzíveis em checks de CI sempre que viável.

### A5 — Gates completos (P1)
Executar todos os gates obrigatórios e testes específicos após correções. PR só poderá sair de draft quando todos estiverem verdes e staging validado.

## Plano de execução

1. Reconciliar primeiro A1 porque migration inconsistente tem prioridade sobre refactor/performance.
2. Auditar A4 em paralelo somente por leitura.
3. Implementar A2/A3 em migrations pequenas, reversíveis e testadas em staging.
4. Reexecutar Security + Performance Advisor.
5. Executar gates completos.
6. Registrar matriz final de critérios e evidências.
7. Somente então alterar o score de Arquitetura Geral para 100%.

## Rollback

- Código: reverter commits desta branch antes de qualquer merge.
- Staging: cada DDL novo deverá ter rollback explícito e não destrutivo quando possível.
- Production: nenhuma alteração autorizada nesta etapa.

## Checklist

- [x] HEAD real da main identificado
- [x] branch isolada criada
- [x] Security Advisor de staging executado
- [x] Performance Advisor de staging executado
- [x] lacunas arquiteturais iniciais registradas
- [ ] staging/migration history reconciliado
- [ ] boundaries privilegiadas auditadas
- [ ] FKs sem índice avaliadas/corrigidas
- [ ] policies redundantes avaliadas/corrigidas
- [ ] Security Advisor sem regressão
- [ ] Performance Advisor sem dívida arquitetural impeditiva
- [ ] gates obrigatórios verdes
- [ ] staging validado
- [ ] PR com evidência e rollback
- [ ] critérios de Arquitetura Geral 100% integralmente satisfeitos
