# Gestify - Readiness de Produção

Este runbook separa o que pode ser validado pelo código do que depende de painel externo, credenciais ou governança. Ele existe para evitar mudanças arriscadas diretamente no banco de produção enquanto o sistema está em uso.

## API de Readiness

Rota protegida:

```text
GET /api/ops/readiness
POST /api/ops/readiness
```

Autenticação aceita:

```text
Authorization: Bearer <secret>
x-operational-readiness-secret: <secret>
x-job-worker-secret: <secret>
x-cron-secret: <secret>
```

Variáveis aceitas para validar a chamada:

```text
OPERATIONAL_READINESS_SECRET
JOB_WORKER_SECRET
CRON_SECRET
```

A resposta nunca retorna valores de secrets. Ela informa apenas presença, ausência e saúde operacional.

## O Que A Rota Verifica

- Supabase público: `NEXT_PUBLIC_SUPABASE_URL` e publishable/anon key.
- Service role server-side: `SUPABASE_SERVICE_ROLE_KEY`.
- Secrets de cron/worker.
- Secrets fiscais.
- Configuração de e-mail transacional.
- URLs públicas da aplicação.
- Runtime Node.js esperado.
- Acesso administrativo a tabelas centrais.
- Jobs pendentes/processando.
- Jobs em dead-letter.

## Checklist Do Painel Vercel

Configurar em `Production`, `Preview` e `Development`, com valores diferentes quando aplicável:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
JOB_WORKER_SECRET
NUTRITION_CRON_SECRET
OPERATIONAL_READINESS_SECRET
FISCAL_SYNC_SECRET
RESEND_API_KEY
RESEND_FROM_EMAIL
ALERTS_FROM_EMAIL
NEXT_PUBLIC_APP_URL
APP_URL
```

Regras:

- `SUPABASE_SERVICE_ROLE_KEY` nunca pode usar prefixo `NEXT_PUBLIC_`.
- Secrets de produção não devem ser reutilizados em preview ou desenvolvimento.
- Após rotação de qualquer secret, validar `/api/ops/readiness`.
- Crons no plano Hobby precisam ser diários; frequências menores exigem plano superior ou outro worker/agendador.

## Checklist Do Painel Supabase

Ativar no painel Auth:

- Leaked Password Protection.
- Tamanho mínimo de senha.
- Política de senha forte.
- MFA para administradores e usuários sensíveis.
- Revisão de duração de sessão e refresh token.

Banco e RLS:

- Consolidar RLS de `orders` e `order_status_events` somente após matriz de permissões.
- Testar usuário de outro estabelecimento em staging.
- Testar usuário sem membership ativa.
- Testar usuário inativo.
- Testar chamada direta das RPCs de pedidos.
- Verificar que funções `SECURITY DEFINER` têm `search_path` fixo e validação de `auth.uid()`.

Storage:

- Buckets de evidências e biometria devem ser privados.
- URLs assinadas devem ter validade curta.
- Uploads devem passar pelo backend.

## Staging Obrigatório Antes De RLS Pesada

Não consolidar policies antigas diretamente em produção sem:

- projeto Supabase de staging;
- dados fictícios ou mascarados;
- usuários de dois estabelecimentos;
- matriz de papéis;
- smoke test de pedidos;
- smoke test de notificações;
- smoke test de estoque;
- rollback SQL revisado.

## Notificações Multiempresa

Regras esperadas:

- Notificações globais devem evitar `user_id` sem `establishment_id`, exceto mensagens realmente sistêmicas.
- Notificações de restaurante sempre precisam de `establishment_id`.
- Admin com múltiplos restaurantes deve ver apenas notificações do restaurante ativo.
- Fallback por `payload.establishment_id` existe apenas para compatibilidade com registros antigos.

## Nutrição

Coberturas já encaminhadas:

- Evidências e relatórios privados.
- Notificações operacionais automáticas.
- Entregas por fila.
- Jobs com retry, dead state e lease.
- Readiness operacional.

Ainda depende de decisão externa:

- WhatsApp oficial, provedor e credenciais.
- LGPD e política de retenção para dados sensíveis.
- Modo offline completo com armazenamento local e sincronização.
- PDF/DOCX juridicamente revisado para operação oficial.

## Backup E Recuperação

Obrigatório antes de novos clientes pagantes:

- definir RPO;
- definir RTO;
- testar restore de banco;
- testar restore de Storage;
- documentar rollback de migration;
- documentar rollback de deploy;
- registrar responsável operacional.

## Comando De Validação

Exemplo:

```bash
curl -H "Authorization: Bearer $OPERATIONAL_READINESS_SECRET" \
  https://gestify.app/api/ops/readiness
```

Resultado esperado:

```text
200 ok quando tudo crítico está configurado
503 quando existir item crítico pendente
401 quando secret ausente ou inválido na chamada
```
