# Gestify Core Infrastructure v1 — baseline executável

Data: 2026-08-10

## Objetivo

Evoluir o Gestify existente sem reescrever o produto, sem migrar prematuramente para microserviços e sem colocar autorização ou regras críticas no navegador.

A fonte de verdade do banco é o histórico de migrations do Supabase. Arquivos de schema legados servem apenas como referência histórica.

## Decisão arquitetural

O Core v1 será construído sobre a aplicação atual:

```text
Next.js Web / Server Actions / Route Handlers
                    │
                    ▼
       autenticação + tenant + permissão
                    │
                    ▼
        Supabase Auth / PostgreSQL / RLS
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
    fila de jobs         storage privado
```

Nesta fase, `apps/web`, `apps/api` e `apps/worker` não serão criados apenas para reorganizar pastas. A separação física ocorrerá quando as fronteiras atuais estiverem consolidadas e houver benefício operacional comprovado.

## Matriz atual × Core v1

| Área | Estado | Decisão |
|---|---|---|
| Next.js 16 / React 19 / TypeScript | existente | reaproveitar |
| Supabase Auth e sessão SSR | existente | endurecer incrementalmente |
| PostgreSQL e migrations | existente | usar como fonte de verdade |
| `establishments`, memberships e tenant | existente | consolidar |
| RLS e RPCs críticas | existente | auditar e endurecer |
| Permissões por módulo | existente | consolidar como RBAC inicial |
| Idempotência | existente | manter server-side |
| Fila e worker por cron | existente | manter e monitorar |
| Readiness e health checks | existente | ampliar |
| Storage | existente | manter privado por padrão |
| CI/CD GitHub + Vercel | existente | bloquear regressões de segurança |
| Monorepo e API dedicada | não necessário agora | adiar |
| Supabase self-hosted / VPS | não necessário agora | adiar até teste operacional e financeiro |

## Alterações desta branch

1. Criada a branch isolada `agent/gestify-core-v1`; a `main` permanece sem alterações diretas.
2. Removido o script versionado que continha credencial administrativa e senha em texto puro.
3. Removidos arquivos rastreados de `supabase/.temp/`.
4. Registrado um runbook específico para o incidente de credenciais.
5. A rota legada `/entradas`, que acessava tabelas diretamente pelo cliente, agora redireciona para `/dashboard/entradas`.
6. A RPC `enqueue_nutrition_notification` passou a validar autenticação, tenant, permissão do módulo, destinatário, tamanho dos inputs e payload.
7. A migration aplicada no Supabase foi versionada para eliminar drift entre banco e repositório.
8. Adicionada auditoria automática contra:
   - JWTs ou senhas hardcoded;
   - segredos em `NEXT_PUBLIC_*`;
   - service role em módulos client-side;
   - retorno da rota legada insegura;
   - arquivos temporários do Supabase rastreados;
   - ausência da migration crítica.
9. O contrato de variáveis de ambiente passou a documentar todos os endpoints operacionais protegidos.
10. O CI passou a executar a auditoria do Core antes do build.

## Estado do Supabase

### Confirmado

- `api_idempotency_keys` e `app_job_queue` têm RLS habilitada e não possuem policies para usuários finais.
- Essas duas tabelas são internas do backend; criar policy para `authenticated` apenas para remover um aviso reduziria a segurança.
- A RPC de notificações nutricionais está endurecida e versionada.

### Pendente no painel

- Ativar proteção contra senhas vazadas no Supabase Auth.
- Rotacionar a credencial administrativa que apareceu no histórico Git.
- Invalidar a senha exposta e revogar as sessões do usuário afetado.
- Revisar logs de Auth, API, Storage e banco no período anterior à contenção.
- Planejar a migração da chave legada e do JWT para chaves independentes/assinatura assimétrica.

## Estado da Vercel

### Confirmado

- Projeto `gestao-2-0` conectado ao GitHub.
- Preview deployments são criados para branches.
- O repositório e o CI exigem Node.js 22.

### Pendente no painel

- O projeto Vercel ainda está configurado com Node.js 24; alinhar para Node.js 22 antes da promoção.
- Atualizar `SUPABASE_SERVICE_ROLE_KEY` em Production, Preview e Development após a rotação.
- Confirmar os secrets de cron, worker, nutrição, readiness e e-mail em cada ambiente.

## Variáveis server-side mínimas

Nunca armazenar valores reais no Git.

```text
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
FISCAL_SYNC_SECRET
ALERTS_CRON_SECRET
JOB_WORKER_SECRET
NUTRITION_CRON_SECRET
OPERATIONAL_READINESS_SECRET
RESEND_API_KEY
RESEND_FROM_EMAIL
ALERTS_FROM_EMAIL
LEAD_IP_HASH_SALT
```

Somente URL e chave publicável do Supabase podem usar `NEXT_PUBLIC_*`.

## Gates para promoção à main

- lint aprovado;
- typecheck aprovado;
- dependency audit aprovado;
- tenant write audit aprovado;
- runtime import audit aprovado;
- Gestify Core security audit aprovado;
- contrato Supabase aprovado;
- auditoria RLS/RPC aprovada;
- build e Preview Vercel aprovados;
- teste de login, logout, troca de tenant e acesso negado;
- teste de `/dashboard/entradas` em pelo menos dois tenants;
- credencial administrativa rotacionada;
- senha exposta invalidada e sessões revogadas;
- Node da Vercel alinhado para 22;
- nenhum segredo presente no diff ou nos logs.

## Próxima etapa após a promoção

Consolidar clientes Supabase browser/server/admin, reduzir acesso direto do frontend ao banco, ampliar auditoria imutável, formalizar backup externo e teste automatizado de restore. Somente depois avaliar API dedicada, Redis/BullMQ ou self-hosting.
