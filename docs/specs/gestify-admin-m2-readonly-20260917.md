# Gestify Admin M2 — fronteira administrativa read-only

Status: implementing — staging drift reconciliation in progress
Data: 2026-09-17

## Contexto

O Kratelis Company OS já opera a Helena por ChatGPT + OAuth/MFA + MCP, com políticas, auditoria, kill switches e risco máximo controlado. O próximo estágio é permitir que a Helena consulte o Gestify sem misturar bancos, credenciais ou fronteiras de confiança.

O Gestify permanece o system of record de tenants, memberships, assinaturas, entitlements e dados operacionais. O Kratelis Company OS permanece o system of record de agentes, delegações, approvals e auditoria da orquestração.

## Problema

Não existe ainda uma interface administrativa estreita e auditável para a Helena consultar dados executivos do Gestify. Dar acesso direto ao Supabase ou expor `service_role` ao ChatGPT/MCP violaria a separação de segurança existente.

## Objetivo

Criar a fundação para:

`Founder -> ChatGPT -> Helena/Kratelis MCP -> Gestify Admin MCP -> Gestify Internal Admin API -> serviços internos -> Supabase`

A primeira fase é estritamente read-only.

## Invariantes obrigatórios

1. O ChatGPT nunca recebe `service_role`, secret key, connection string, SQL arbitrário ou acesso genérico ao banco.
2. O Gestify Admin MCP não acessa tabelas diretamente; chama somente endpoints internos allowlisted.
3. A Gestify Internal Admin API é server-only, fail-closed e independente das APIs tenant normais.
4. Nenhum endpoint administrativo aceita SQL, nome de tabela, URL arbitrária ou expressão de filtro livre.
5. Todos os recursos retornados têm schema estável, paginação e limites máximos.
6. Dados retornados devem ser minimizados ao necessário para a pergunta administrativa.
7. Nenhuma senha, token, secret, credential hash ou conteúdo sensível de autenticação pode ser retornado.
8. Toda chamada recebe `correlation_id` e produz auditoria no Kratelis e no Gestify.
9. A identidade chamadora deve ser uma integração machine-to-machine específica, revogável e de menor privilégio.
10. Staging deve ser hard-pinned durante a homologação; Production exige promoção separada e aprovação humana.
11. A primeira versão não possui escrita.
12. Tenant isolation continua válido mesmo para ferramentas administrativas: acesso cross-tenant só existe por endpoint explicitamente administrativo, nunca por bypass genérico de RLS no MCP.

## Kill switches propostos

No lado Gestify:

- `GESTIFY_ADMIN_ENABLED=false` por padrão;
- `GESTIFY_ADMIN_READS_ENABLED=false` por padrão;
- `GESTIFY_ADMIN_WRITES_ENABLED=false` permanentemente durante M2 read-only.

No lado Kratelis continuam válidos:

- `agents_enabled`;
- `automations_enabled`;
- `emergency_read_only`;
- `SEC-HELENA.enabled`;
- `SEC-HELENA.max_risk_level`.

A autorização efetiva é a interseção das duas fronteiras.

## Dados já disponíveis no Gestify

Fontes canônicas iniciais:

- `establishments` — empresas/estabelecimentos;
- `memberships` e `establishment_memberships` — usuários e vínculos;
- `subscription_plans` — catálogo de planos;
- `company_subscriptions` — estado contratual da assinatura;
- `establishment_entitlements` — limites, módulos e condições negociadas;
- Auth server-side — somente para métricas autorizadas como último acesso, sem expor credenciais.

## Ferramentas M2 read-only v1

### 1. `gestify_platform_overview`

Retorna somente métricas agregadas:

- estabelecimentos total/ativos/inativos;
- usuários/vínculos ativos;
- contas em trial quando determinável pela assinatura;
- distribuição por plano/status contratual;
- novos estabelecimentos em janela limitada;
- timestamp da coleta.

Não retorna MRR financeiro real nesta fase.

### 2. `gestify_list_companies`

Filtros tipados e limitados:

- `status`: active | inactive | all;
- `plan_code` opcional;
- `limit` máximo 100;
- cursor opaco.

Campos:

- id;
- name;
- active;
- created_at;
- plan_code;
- billing_status;
- contract_type.

### 3. `gestify_company_details`

Retorna:

- identificação básica;
- plano/assinatura;
- entitlement efetivo;
- módulos habilitados;
- limites contratuais;
- contagens agregadas de uso aprovadas.

Não retorna dados operacionais brutos por padrão.

### 4. `gestify_company_users`

Retorna somente usuários vinculados à empresa solicitada:

- user_id;
- papel/vínculo;
- ativo;
- último acesso quando autorizado;
- data de criação do vínculo.

E-mail e nome devem ser incluídos somente se forem necessários ao caso de uso e explicitamente permitidos pelo contrato de dados.

### 5. `gestify_subscription_status`

Retorna:

- plan_slug/plan_code;
- status;
- current_period_start/end;
- trial_ends_at;
- canceled_at;
- billing_policy;
- automatic_billing_allowed;
- effective_monthly_price_brl como valor contratual, identificado como contratual e não como valor recebido.

### 6. `gestify_trial_accounts`

Lista somente contas com condição de trial derivável de fonte canônica.

### 7. `gestify_plan_usage`

Retorna consumo versus entitlement para métricas que já possuem contagem canônica, inicialmente:

- usuários;
- estabelecimentos quando aplicável;
- produtos;
- fichas técnicas;
- pedidos apenas se o contrato estiver ativo e a semântica estiver definida.

### 8. `gestify_recent_signups`

Lista cadastros recentes com janela máxima definida e paginação.

### 9. `gestify_user_activity`

Somente metadados mínimos de atividade, sem logs brutos de autenticação.

### 10. `gestify_platform_health`

Retorna estado operacional agregado autorizado, nunca secrets ou logs completos.

## Fora da v1

Não declarar como fonte financeira canônica:

- collected MRR;
- billed MRR;
- inadimplência conciliada;
- churn financeiro;
- receita efetivamente recebida.

Esses indicadores dependem do fechamento do billing/webhooks/conciliação.

Também fica fora da v1:

- escrita em tenants;
- criação de empresas;
- alteração de plano;
- bloqueio de usuário;
- suspensão de assinatura;
- alteração de módulos;
- exclusão de dados;
- automações sobre clientes.

## Autenticação machine-to-machine

Requisitos:

- credencial exclusiva da integração Kratelis -> Gestify Admin;
- armazenada somente no runtime do servidor;
- rotação independente;
- audience/issuer explícitos ou assinatura equivalente verificável;
- escopos allowlisted, começando por `gestify.admin.read`;
- expiração curta;
- sem reutilização de credenciais de usuário;
- sem reutilização de credenciais do Supabase.

Não usar um segredo estático simples como solução final se um token assinado de curta duração puder ser empregado.

## Auditoria ponta a ponta

Cada chamada deve transportar:

- `correlation_id` UUID;
- identidade da integração;
- ferramenta/ação;
- timestamp;
- alvo administrativo quando houver;
- resultado success/denied/error;
- duração;
- quantidade de registros retornada;
- classificação de risco.

O Kratelis registra a delegação do Founder para Helena. O Gestify registra a consulta administrativa executada. O mesmo `correlation_id` liga as duas evidências.

## Rate limiting e antiabuso

Mesmo read-only:

- limite por integração;
- limite por ferramenta;
- limite por empresa consultada;
- paginação obrigatória;
- tamanho máximo de resposta;
- rejeitar enumeração em massa sem ferramenta específica;
- timeout explícito;
- sem retries ilimitados.

## Resposta a prompt injection

Conteúdo vindo de clientes, nomes de empresa, observações ou campos textuais é dado não confiável. Nunca pode modificar política, escolher ferramenta, ampliar escopo ou virar instrução de sistema.

O Gestify Admin MCP deve tratar todos os campos retornados pelo Gestify como dados.

## Testes obrigatórios

### Auth

- sem token -> 401;
- token inválido -> 401;
- token expirado -> 401;
- audience errada -> 403/401;
- escopo ausente -> 403;
- integração revogada -> negado.

### Tenant/admin boundary

- ferramenta de company A não retorna dados de B;
- ID inexistente -> 404 estável sem vazamento;
- paginação não atravessa filtros;
- tentativa de injetar filtros arbitrários -> validação rejeita;
- endpoint não aceita nome de tabela/SQL/URL.

### Dados

- entitlements negociados vencem catálogo quando essa é a regra vigente;
- Santino deve refletir condição contratual efetiva, não apenas preço nominal do catálogo;
- contagens respeitam registros ativos/inativos conforme definição documentada.

### Auditoria

- `correlation_id` aparece nos dois sistemas;
- sucesso e negação são auditados;
- logs não contêm token ou secret;
- falha de auditoria em operação que exigir auditabilidade deve falhar fechado.

## Rollout

1. documentar contrato de dados;
2. implementar Internal Admin API somente em staging;
3. adicionar identidade M2M e kill switches;
4. criar Gestify Admin MCP staging separado;
5. implementar ferramentas uma a uma;
6. executar suíte tenant A x B + adversarial;
7. validar auditoria ponta a ponta;
8. homologar com Helena/ChatGPT;
9. somente depois preparar promoção read-only para Production;
10. escrita fica para fase posterior com spec própria.

## Critérios de aceite da primeira entrega

- nenhuma credencial privilegiada do Gestify chega ao ChatGPT/Kratelis MCP;
- nenhuma ferramenta aceita consulta arbitrária;
- ferramentas read-only retornam apenas campos contratados;
- kill switch funciona fail-closed;
- cross-tenant adversarial passa;
- logs e auditoria possuem correlation ID sem secrets;
- CI/readiness/build permanecem verdes;
- staging Security Advisor sem regressão criada pelo M2;
- Production e Santino permanecem inalterados.

## Rollback

A primeira implementação deve ser aditiva e desligada por padrão. Rollback consiste em:

1. `GESTIFY_ADMIN_ENABLED=false`;
2. revogar a identidade M2M;
3. remover/deativar o projeto MCP staging;
4. reverter a branch/PR;
5. nenhum dado tenant precisa ser transformado para retornar ao estado anterior.


## Reconciliação de drift do staging — 2026-09-18

O staging aplicou cinco migrations operacionais durante a homologação M2 que ainda não estavam versionadas no GitHub. Esta branch reconcilia exatamente essas versões sem reaproveitar a branch histórica divergente:

- `20260917215331_add_gestify_admin_staging_bridge`;
- `20260917220332_fix_gestify_admin_staging_audit_restrictive_policy`;
- `20260917220935_add_company_subscriptions_establishment_fk_for_m2_staging`;
- `20260917221114_harden_gestify_admin_staging_bridge_advisor`;
- `20260917221535_allow_unknown_targets_in_gestify_admin_audit`.

Também incorpora somente o runtime necessário do scoped staging database bridge ao código atual da `main`.

### Invariantes adicionais

- o bridge só pode ser ativado quando `GESTIFY_ADMIN_STAGING_DB_SECRET` existe;
- o runtime recusa esse bridge se `NEXT_PUBLIC_SUPABASE_URL` não apontar exatamente para `tuncavkhjazruijujatb.supabase.co`;
- o banco também valida o hostname do projeto staging antes de aceitar o segredo;
- Production não recebe habilitação do bridge e não depende desse caminho;
- a credencial de staging nunca é registrada em Git, logs ou respostas;
- as cinco versões históricas permanecem idênticas às versões já registradas no staging;
- a migration `20260918041902_harden_gestify_admin_staging_host_scope` é um hardening novo e explícito, aplicado primeiro em staging.

### Critérios de fechamento do drift

1. as cinco versões ausentes existem em `supabase/migrations`;
2. fresh replay passa;
3. `gestify:admin:check`, lint, typecheck, audit, tenant writes, readiness e build passam;
4. a migration de host-scope é aplicada em staging;
5. Security Advisor não ganha regressão;
6. o histórico remoto do staging coincide com o histórico versionado;
7. Production/Santino permanecem sem DDL/DML.
