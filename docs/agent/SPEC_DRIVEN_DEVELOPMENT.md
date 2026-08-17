# Gestify Spec-Driven Development

## Regra

Toda mudança não trivial deve começar por uma spec versionada em `docs/specs/` antes da implementação.

## Template de spec

```markdown
# SPEC-<id> — <título>

Status: proposed | implementing | validated | released
Priority: P0 | P1 | P2 | P3 | P4 | P5
Owner: <agent/humano>
Related PR: <link ou número>

## Contexto e evidência

## Problema

## Impacto

## Comportamento atual

## Comportamento esperado

## Invariantes
- tenant isolation
- auth/authorization
- integridade de dados
- compatibilidade com usuários ativos
- reversibilidade

## Escopo

## Fora de escopo

## Design técnico

## Banco / migrations / RLS

## API / server actions

## UI / UX

## Observabilidade

## Testes

## Critérios de aceitação

## Rollout em staging

## Plano de produção

## Rollback

## Evidências de validação
```

## Regras de implementação

1. A spec deve descrever o problema antes de descrever a solução.
2. Não inventar requisitos sem evidência; registrar incertezas.
3. Mudanças de banco devem declarar compatibilidade forward/backward quando houver deploy separado de app e migration.
4. Mudanças em tenant/RLS devem declarar explicitamente quem pode SELECT/INSERT/UPDATE/DELETE e por quê.
5. Mudanças destrutivas devem ser divididas em expand -> migrate/backfill -> validate -> contract.
6. Preferir mudanças pequenas, reversíveis e observáveis.
7. Uma spec pode gerar mais de um PR, mas cada PR deve apontar para a spec e ter escopo claro.

## Definition of Ready

Uma spec está pronta para implementação quando:

- há evidência suficiente do problema;
- prioridade está justificada;
- invariantes e critérios de aceitação estão claros;
- staging consegue validar a mudança;
- riscos e rollback são conhecidos.

## Definition of Done

Uma spec está `validated` quando:

- implementação está em branch/PR;
- CI e testes aplicáveis passam;
- staging foi validado;
- advisors/audits não regrediram;
- rollback foi verificado conceitualmente ou testado quando necessário;
- observabilidade necessária existe.

Uma spec só vira `released` após promoção humana aprovada para produção e verificação pós-release.

## Catálogo inicial de specs recomendadas

Criar specs separadas, em ordem de prioridade conforme evidência atual:

- RPCs `SECURITY DEFINER` ainda executáveis por `authenticated`.
- Consolidação segura de políticas de `orders` e `order_status_events` em staging.
- Política/isolamento de `api_idempotency_keys` e `app_job_queue` (confirmar se ausência de policies é intencional por service-only).
- Índices ausentes em FKs do módulo Nutrição, priorizados por queries reais.
- Estratégia de timeout/fallback para `/api/weather/current`.
- Tratamento de sessão ausente em `/dashboard/admin/usuarios` sem ruído indevido de erro.
- Teste automatizado de backup/restore e evidência de recuperação.
- MFA operacional para administradores e governança de biometria.

O catálogo é backlog, não autorização automática para alterar produção.
