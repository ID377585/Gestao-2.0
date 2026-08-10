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
7. As migrations aplicadas no Supabase foram versionadas para eliminar drift entre banco e repositório.
8. Todos os privilégios SQL de `anon` sobre tabelas `nutrition_*` foram removidos; o módulo continua disponível para usuários autenticados pelas policies existentes.
9. O bucket legado `technical-sheets`, que contém PDFs de empresas, passou de público para privado.
10. Adicionada auditoria automática contra:
    - JWTs ou senhas hardcoded;
    - segredos em `NEXT_PUBLIC_*`;
    - service role em módulos client-side;
    - retorno da rota legada insegura;
    - arquivos temporários do Supabase rastreados;
    - ausência das migrations críticas;
    - reabertura pública do bucket de fichas técnicas;
    - retorno do pacote descontinuado `@supabase/auth-helpers-nextjs`.
11. O contrato de variáveis de ambiente passou a documentar todos os endpoints operacionais protegidos.
12. O CI passou a executar a auditoria do Core antes do build.
13. O pacote `@supabase/auth-helpers-nextjs` foi removido; o projeto permanece em `@supabase/ssr`.
14. O lockfile foi regenerado sem `--force`, com `npm ci` reproduzível e correções não destrutivas de dependências.
15. A RPC `gestify_core_security_audit` foi criada como contrato vivo, executável apenas por `service_role`, e ligada ao `supabase:contract`.

## Estado do Supabase

### Confirmado

- Todas as tabelas do schema `public` estão com RLS habilitada.
- Nenhuma tabela do schema `public` mantém grants SQL para `anon`.
- `api_idempotency_keys` e `app_job_queue` têm RLS habilitada e não possuem policies para usuários finais.
- Essas duas tabelas são internas do backend; criar policy para `authenticated` apenas para remover um aviso reduziria a segurança.
- A RPC de notificações nutricionais está endurecida e versionada.
- O bucket `technical-sheets` está privado.
- O bucket `avatars` permanece público como exceção explícita, pois a UI atual usa URL pública. A migração para URL assinada fica para uma etapa própria.
- O contrato vivo `gestify_core_security_audit` retorna `ok=true` e verifica:
  - tabelas públicas sem RLS;
  - grants de tabela para `anon`;
  - exposição de `api_idempotency_keys` e `app_job_queue` a usuários finais;
  - buckets públicos fora da exceção documentada de avatares;
  - execução anônima de RPCs críticas.
- A função de auditoria é `SECURITY DEFINER`, possui `search_path` fixo e só concede `EXECUTE` a `service_role`.

### Pendente no painel

- Ativar proteção contra senhas vazadas no Supabase Auth.
- Rotacionar a credencial administrativa que apareceu no histórico Git.
- Invalidar a senha exposta e revogar as sessões do usuário afetado.
- Revisar logs de Auth, API, Storage e banco no período anterior à contenção.
- Planejar a migração da chave legada e do JWT para chaves independentes/assinatura assimétrica.

## Estado das dependências

### Confirmado

- `@supabase/auth-helpers-nextjs` foi removido do `package.json` e do `package-lock.json`.
- Não havia importações do pacote legado no código da aplicação.
- O lockfile atualizado passou em `npm ci`.
- As correções sem breaking change removeram os achados de produção de severidade alta associados ao estado anterior do lockfile.

### Pendente controlado

- Permanecem dois achados moderados de `uuid` transitivo via `exceljs`.
- O `npm audit` só propõe uma alteração potencialmente incompatível do ExcelJS para resolver esse caminho.
- Não foi usado `npm audit fix --force`; a substituição ou atualização do mecanismo de planilhas será validada separadamente antes de elevar o gate do CI para `high`.

## Estado da Vercel

### Confirmado

- Projeto `gestao-2-0` conectado ao GitHub.
- Preview deployments são criados para branches e PRs.
- O repositório e o CI exigem Node.js 22.
- Os logs de build confirmam que a Vercel usa Node.js 22 por causa de `engines.node`, mesmo que o painel ainda mostre 24.x.

### Pendente no painel

- Alinhar a configuração visual do projeto para Node.js 22 e eliminar o aviso de divergência.
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
- dependency audit aprovado no nível definido, com exceções moderadas documentadas;
- tenant write audit aprovado;
- runtime import audit aprovado;
- Gestify Core security audit aprovado;
- sintaxe do executor do contrato Supabase aprovada em todo build;
- contrato funcional Supabase aprovado;
- contrato vivo de segurança Supabase aprovado;
- auditoria RLS/RPC aprovada;
- build e Preview Vercel aprovados;
- teste de login, logout, troca de tenant e acesso negado;
- teste de `/dashboard/entradas` em pelo menos dois tenants;
- credencial administrativa rotacionada;
- senha exposta invalidada e sessões revogadas;
- nenhum segredo presente no diff ou nos logs.

## Próxima etapa após a promoção

Consolidar clientes Supabase browser/server/admin, reduzir acesso direto do frontend ao banco, migrar avatares para URL assinada, ampliar auditoria imutável, formalizar backup externo e teste automatizado de restore. Somente depois avaliar API dedicada, Redis/BullMQ ou self-hosting.
