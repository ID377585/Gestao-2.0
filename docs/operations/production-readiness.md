# Gestify - Readiness de Produção

Este runbook separa validação automatizada, controles de provedor e gates de governança. A meta não é declarar segurança absoluta; é impedir liberação comercial com bloqueadores críticos conhecidos.

## Readiness automatizado

O build da Vercel executa `npm run ci`. Em `VERCEL_ENV=production`, o script `readiness:deployment` executa automaticamente `readiness:strict`; qualquer `FAIL` crítico encerra o build. Em Preview/CI o modo estrito não é exigido, pois secrets de Production não devem ser copiados para ambientes de teste.

Comandos principais:

```bash
npm run readiness:check
npm run readiness:strict
npm run audit
npm run excel:smoke
npm run tenant:writes:ci
npm run runtime:imports:check
npm run supabase:contract
npm run orders:rls:ci
npm run build
```

## API operacional

Rota protegida:

```text
GET /api/ops/readiness
POST /api/ops/readiness
```

Autenticação aceita pela rota conforme o ambiente:

```text
Authorization: Bearer <secret>
x-operational-readiness-secret: <secret>
x-job-worker-secret: <secret>
x-cron-secret: <secret>
```

A resposta nunca deve retornar valores de secrets; apenas presença e estado operacional.

## Contrato atual de ambiente

### Production

Obrigatórios:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
CRON_SECRET
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_APP_URL
```

Recomendados quando o recurso correspondente é usado:

```text
JOB_WORKER_SECRET
NUTRITION_CRON_SECRET
ALERTS_CRON_SECRET
ALERTS_FROM_EMAIL
GESTIFY_ALLOWED_CORS_ORIGINS
LEAD_IP_HASH_SALT
OPERATIONAL_READINESS_SECRET
```

`SUPABASE_SECRET_KEY` é server-side e nunca pode usar prefixo `NEXT_PUBLIC_`. Chaves JWT legadas `service_role`/`anon` não fazem parte do contrato de runtime do Gestify.

### Preview e Development

- usar credenciais separadas de Production;
- não copiar `SUPABASE_SECRET_KEY` de Production para Development;
- Preview de homologação deve apontar para staging, não para o banco de Production;
- secrets desnecessários ao fluxo testado devem permanecer ausentes.

## Supabase Auth

Antes de ampliar clientes, manter:

- leaked-password protection habilitada;
- tamanho mínimo e política de senha forte;
- MFA/AAL2 para administradores em fluxos privilegiados;
- revisão de duração de sessão e refresh tokens;
- logs de Auth incluídos no monitoramento de incidentes.

## Multiempresa / RLS

Nunca promover uma consolidação grande de RLS diretamente para Production. O gate exige staging persistente com dados fictícios e pelo menos dois tenants. Casos mínimos:

- tenant A não lê nem altera tenant B;
- escrita direta em tabelas protegidas não contorna RPCs;
- RPCs rejeitam tenant/papel indevido;
- cliente vê apenas recursos autorizados;
- membership inativa perde acesso;
- papéis `admin`, `operacao`, `producao`, `estoque`, `fiscal`, `entrega` e `cliente` são exercitados conforme a matriz do produto.

A branch Preview da Core pode ser usada como evidência técnica, mas não substitui o staging persistente oficial.

## Crons e filas

Produção agenda atualmente:

```text
/api/jobs/process?limit=20             30 5 * * *
/api/nutricao/notifications/sweep      45 5 * * *
```

A integração fiscal permanece sem cron enquanto certificado/configuração fiscal não estiverem homologados. Não habilitar `/api/fiscal/sync` apenas para satisfazer readiness.

## Backup e recuperação

Obrigatório antes de comercialização ampla:

- restaurar banco em ambiente separado;
- restaurar/validar Storage;
- medir RPO e RTO reais;
- testar rollback de migration;
- testar rollback de deploy Vercel;
- registrar responsável operacional e evidências do exercício.

Metas iniciais continuam sendo apenas objetivos até o primeiro exercício medido:

- RPO: até 15 minutos;
- RTO: até 4 horas para app + banco;
- Storage não crítico: mesmo dia útil.

## Monitoramento

A operação comercial deve detectar sem inspeção manual recorrente:

- indisponibilidade pública e 5xx sustentado;
- falhas de deploy;
- erros relevantes de Auth, API, Postgres e Storage;
- jobs `dead`/falhas repetidas;
- falhas de autenticação de cron/worker.

Toda notificação deve indicar impacto e próxima ação sem incluir valores secretos.

## Gates condicionais

### Fiscal

Não bloqueia o SaaS base enquanto não for vendido/ativado. Passa a ser gate antes de qualquer cliente usar o módulo fiscal: certificado, ambiente, idempotência, homologação e revisão operacional.

### Biometria

Ponto facial não deve ser liberado comercialmente sem base legal/revisão jurídica, alternativa não biométrica, retenção/descarte, Storage privado, auditoria de acesso, contestação e plano de incidente.

### Billing

O Gestify possui status/limites de assinatura e criação administrativa de empresas. Cobrança self-service não deve ser presumida. Para lançamento com cobrança manual, documentar responsável por faturamento, ativação/bloqueio e conciliação. Se checkout/cobrança automática for ofertado, o provedor de pagamento e webhooks passam a integrar o gate do release.

## Gate final de comercialização

Não ativar `GESTIFY_NEW_SIGNUPS_ENABLED=true` nem `GESTIFY_SECURITY_HARDENING_CONFIRMED=true` até que:

1. saneamento do incidente esteja concluído também no lado GitHub;
2. `main` esteja protegida;
3. staging persistente esteja isolado de Production;
4. matriz multiempresa passe no staging;
5. restore real esteja medido;
6. monitoramento esteja ativo;
7. Production passe `readiness:strict`;
8. dependências de produção passem audit no nível `high`;
9. teste de carga do cenário comercial esteja aprovado;
10. gates fiscal/biometria/billing aplicáveis ao escopo vendido estejam concluídos.
