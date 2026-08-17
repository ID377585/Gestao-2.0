# Governança de Segurança e Operação

Este runbook define controles que permanecem válidos após o hardening inicial. Mudanças de segurança devem passar por branch, CI, Preview, PR, merge e validação de Production; alterações destrutivas ou de RLS ampla exigem staging e plano de retorno.

## 1. Secrets e credenciais

Ordem para rotação:

1. criar a nova credencial no provedor de origem;
2. configurar valor novo apenas nos ambientes necessários;
3. validar Preview quando aplicável;
4. promover e validar Production;
5. revogar a credencial antiga;
6. revisar logs e confirmar que nenhum valor sensível foi publicado em issue, commit, screenshot ou log compartilhado.

Contrato moderno:

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: públicos;
- `SUPABASE_SECRET_KEY`: somente servidor;
- `CRON_SECRET` e, quando desejado, secrets dedicados de worker/nutrição/alertas;
- `RESEND_API_KEY` e remetentes de e-mail;
- secrets fiscais somente quando o módulo fiscal for homologado.

Não reintroduzir chaves JWT legadas de `service_role`/`anon` como requisito de runtime. Não reutilizar o secret administrativo de Production em Development.

## 2. Auth e contas administrativas

Manter:

- leaked-password protection;
- senha mínima/política forte;
- MFA/AAL2 em operações administrativas privilegiadas;
- revisão periódica de administradores ativos;
- revogação de sessões em incidente de conta;
- monitoramento de falhas anormais de refresh/session.

## 3. Multiempresa, RLS e RPCs

Toda tabela/RPC nova que carregue dados de empresa deve ter escopo por `establishment_id` ou outra fronteira explicitamente documentada. O CI não substitui teste dinâmico.

Antes de promover mudanças de RLS:

1. aplicar em staging persistente;
2. criar dois tenants fictícios e usuários por papel;
3. testar leitura, criação, atualização e RPCs contra tenant próprio e estrangeiro;
4. testar membership inativa;
5. validar `SECURITY DEFINER` com `search_path` controlado, `auth.uid()` e autorização interna;
6. revisar grants a `authenticated`, `anon` e `public`;
7. publicar em janela controlada e monitorar erros após o deploy.

## 4. Branch e release governance

`main` deve permanecer privada e protegida. Política alvo:

- pull request obrigatório;
- CI obrigatório;
- Vercel Preview obrigatório;
- branch atualizada antes do merge quando viável;
- bloquear push direto, force-push e deletion;
- resolver conversas antes do merge;
- administradores sujeitos às mesmas regras quando o plano permitir.

Nunca tornar o repositório público como atalho para obter branch protection.

## 5. Histórico sensível

Remover um secret do estado atual não remove cópias históricas. Em incidente com segredo commitado:

- revogar primeiro a credencial;
- reescrever o histórico em clone coordenado;
- verificar com scanner de secrets;
- force-push somente refs controladas;
- tratar refs internas/cache do provedor com o processo oficial de sensitive-data removal;
- manter backup pré-saneamento isolado, sem compartilhar, apenas durante a janela de rollback/forense necessária.

## 6. Backup e disaster recovery

Exercício obrigatório antes de escala comercial e depois periodicamente:

- confirmar política de backup/PITR conforme plano contratado;
- restaurar banco em ambiente separado;
- restaurar ou reconstruir Storage e validar objetos críticos;
- medir RPO/RTO reais;
- testar rollback de migration e deploy;
- validar login, pedidos, estoque, financeiro e módulos vendidos;
- registrar responsável, horário e evidência.

Metas iniciais são RPO de 15 minutos e RTO de 4 horas; só podem ser tratadas como compromisso após medição real.

## 7. Observabilidade e incidentes

Monitorar continuamente:

- disponibilidade pública/5xx;
- estado do deployment Production;
- Auth, API, Postgres e Storage;
- filas/jobs e dead-letter;
- crons e erros de autenticação dos workers.

Runbook de incidente: [incident-response-runbooks.md](./incident-response-runbooks.md).

## 8. Dependências e supply chain

- `npm audit --omit=dev --audit-level=high` deve passar antes de Production;
- manter smoke test de Excel/exportação porque `exceljs` possui cadeia transitive relevante;
- Dependabot deve propor updates regularmente;
- não executar `npm audit fix --force` sem branch, revisão e testes de regressão;
- upgrades major de GitHub Actions ou runtime devem passar pelo mesmo gate de PR/CI/Preview.

## 9. Fiscal, biometria e LGPD

### Fiscal

O módulo fiscal só entra no escopo comercial quando certificado, ambiente, credenciais, idempotência e homologação estiverem concluídos. Até lá, manter o cron fiscal desabilitado.

### Biometria

Biometria facial é dado pessoal sensível. Antes de ativar comercialmente:

- finalidade e base legal documentadas;
- revisão jurídica;
- alternativa não biométrica;
- retenção e descarte seguro;
- bucket privado e URL assinada curta;
- auditoria de acesso;
- procedimento de contestação;
- resposta a incidente.

Política inicial: [data-retention-policy.md](./data-retention-policy.md).

## 10. Billing

O controle de acesso por assinatura pode coexistir com cobrança manual no início, desde que o processo seja documentado. Se houver cobrança automatizada, adicionar ao gate comercial:

- provedor homologado;
- webhooks autenticados e idempotentes;
- conciliação;
- tratamento de `past_due`, cancelamento e reativação;
- trilha de auditoria e suporte ao cliente.

## 11. Auditoria final antes de escala

Exigir evidência para:

- smoke/E2E dos fluxos críticos;
- matriz multiempresa completa;
- teste de carga com p95/p99 e taxa de erro;
- restore real;
- revisão dos Supabase Advisors após mudanças de DDL;
- revisão de dependências;
- revisão fiscal/LGPD conforme o escopo vendido;
- pentest antes de exposição ampla quando o risco/contratos justificarem.
