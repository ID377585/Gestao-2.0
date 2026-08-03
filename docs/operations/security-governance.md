# Governança de Segurança e Operação

Este runbook separa o que pode ser automatizado por código do que exige painel,
staging, decisão administrativa ou validação jurídica. Não execute mudanças em
produção sem registrar evidência e plano de retorno.

## 1. Segredos Vercel e Supabase

Rotacione em janela controlada, nesta ordem:

1. Criar novos segredos no provedor de origem.
2. Configurar os novos valores em Vercel Production, Preview e Development.
3. Fazer um deploy de preview e validar rotas protegidas.
4. Promover para produção.
5. Revogar os segredos antigos.
6. Confirmar que nenhum segredo possui prefixo `NEXT_PUBLIC_`, exceto chaves
   publicáveis.

Segredos obrigatórios:

- `SUPABASE_SERVICE_ROLE_KEY`, somente servidor.
- `CRON_SECRET`.
- `FISCAL_SYNC_SECRET`.
- `JOB_WORKER_SECRET`.
- `RESEND_API_KEY`.
- `RESEND_FROM_EMAIL` ou `ALERTS_FROM_EMAIL`.
- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 2. Supabase Auth

No painel Supabase, habilitar antes de ampliar clientes:

- leaked-password protection;
- tamanho mínimo de senha;
- política de senha forte;
- MFA para administradores;
- revisão da duração de sessão e refresh tokens.

Essa etapa é manual porque altera configuração de Auth do projeto, não schema.

## 3. RLS e RPCs de Pedido

O CI executa `npm run orders:rls:ci` quando as secrets do Supabase existem.

Essa auditoria bloqueia:

- policies novas acima do baseline atual;
- policies em `orders` ou `order_status_events` expostas a `anon/public`;
- RPCs sensíveis sem validações internas esperadas;
- funções sensíveis executáveis por `anon/public`.

Para consolidar RLS de verdade:

1. Criar staging com dados fictícios.
2. Mapear matriz por papel: `cliente`, `operacao`, `producao`, `estoque`,
   `fiscal`, `admin`, `entrega`.
3. Substituir policies por tabela em pequenos lotes.
4. Validar leitura, criação, atualização e timeline por papel.
5. Testar usuário de outro estabelecimento e usuário inativo.
6. Publicar em janela de baixo uso.

## 4. Testes entre Tenants

Nunca criar usuários fictícios permanentes direto em produção para teste
automatizado.

Fluxo recomendado:

1. Projeto Supabase staging.
2. Dois estabelecimentos fictícios.
3. Usuário A vinculado apenas ao estabelecimento A.
4. Usuário B vinculado apenas ao estabelecimento B.
5. Um administrador global ou service role somente para setup.
6. Casos mínimos:
   - A não lê pedido de B;
   - A não atualiza pedido de B;
   - A não cria registro com `establishment_id` de B;
   - A não chama RPC de pedido de B;
   - usuário inativo perde acesso;
   - cliente não avança status operacional.

## 5. Branch Protection

Configuração recomendada para `main`:

- exigir pull request;
- exigir CI verde;
- bloquear force push;
- bloquear deletion;
- exigir branch atualizada antes do merge;
- exigir pelo menos uma aprovação quando houver time;
- manter administradores sujeitos às regras quando o fluxo comercial permitir.

Observação: bloquear push direto muda o fluxo atual de publicação. Antes de
ativar, confirme que deploy via PR/merge está funcionando.

## 6. Backup e Restauração

Checklist trimestral:

- confirmar PITR conforme plano Supabase;
- exportar backup de Storage;
- testar restauração em projeto separado;
- medir RPO e RTO reais;
- documentar responsável e contatos;
- testar rollback de migration;
- testar rollback de deploy Vercel.

Metas iniciais para piloto controlado:

- RPO: perda máxima de 15 minutos de dados.
- RTO: recuperação do app e banco em até 4 horas.

Substitua esses números por métricas reais depois do primeiro teste de restore.

## 7. LGPD e Biometria

Biometria facial é dado pessoal sensível. Antes de ativar comercialmente:

- finalidade documentada;
- consentimento/base legal;
- alternativa sem biometria;
- política de retenção;
- descarte seguro;
- bucket privado e URL assinada curta;
- auditoria de acesso;
- procedimento de contestação;
- plano de incidente;
- revisão jurídica.

## 8. Auditoria Final

Antes de liberar clientes externos em escala:

- smoke test completo;
- teste de carga;
- teste de caos controlado;
- pentest;
- revisão RLS;
- revisão fiscal;
- revisão LGPD;
- restauração de backup comprovada.

## 9. Comandos de Prontidão

Execute antes de qualquer promoção relevante:

```bash
npm run readiness:check
npm run lint
npm run typecheck
npm run tenant:writes:ci
npm run orders:rls:ci
npm run build
```

Quando as secrets reais estiverem disponíveis no ambiente, rode:

```bash
npm run readiness:strict
```
