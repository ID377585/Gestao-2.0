# Auth compliance ledger hardening

Status: implementing

## Contexto e evidência

O fluxo atual de compliance grava telemetria e aceite contratual em `auth.users.app_metadata` por meio de `auth.admin.updateUserById()`. O guard de acesso também registra aceite quando não encontra a versão vigente. Em paralelo, o runtime tenta inserir em `public.user_terms_acceptances` e `public.user_access_logs`, mas essas tabelas não existem em staging nem Production.

## Problema

1. Navegação autenticada comum pode causar mutação administrativa em Supabase Auth.
2. Aceite jurídico pode ser criado implicitamente pelo guard, sem ação inequívoca do usuário.
3. O runtime depende de tabelas inexistentes.
4. Estado de compliance, telemetria e identidade estão acoplados.

## Impacto e prioridade

P1. O comportamento atual aumenta risco operacional no Auth, enfraquece a evidência de consentimento explícito e pode gerar falhas silenciosas/500 em fluxos que tentam persistir auditoria.

## Comportamento esperado

- `auth.users` permanece responsável por identidade/autenticação; acesso comum e aceite não alteram `app_metadata`.
- O aceite da versão vigente é persistido em ledger append-only próprio.
- Acesso autenticado é persistido em log append-only próprio.
- O guard apenas verifica o ledger e redireciona para `/login?terms=required&redirect=...` quando não há aceite.
- A API `POST /api/auth/compliance` só registra aceite quando recebe `acceptTerms: true` de usuário autenticado.
- A API e o login consultam o ledger como fonte de verdade, não claims antigas de metadata.

## Invariantes de segurança e tenant

- Nenhum `establishment_id` é aceito do frontend.
- O estabelecimento é derivado server-side de membership ativa.
- `anon` e `authenticated` não recebem acesso direto às tabelas de ledger/log; escrita e leitura do contrato ocorrem no servidor com credencial administrativa já existente.
- RLS fica habilitado e forçado em ambas as tabelas como defesa em profundidade.
- Nenhuma policy permissiva é criada para `anon` ou `authenticated`.
- Aceites são append-only; não há UPDATE/DELETE no runtime.
- Uma versão de termos só pode ser aceita uma vez por usuário, tornando reenvios idempotentes.
- IP, user-agent, path e session id são dados de auditoria e não são usados para autorização.

## Design técnico

### `public.user_terms_acceptances`

Ledger de aceite explícito por usuário/versão, com `user_id`, `establishment_id`, versão/slug/título, timestamp, source/path e metadados de request. Restrição única `(user_id, terms_version_id)`.

### `public.user_access_logs`

Log append-only de acesso autenticado com `user_id`, `establishment_id`, path, request metadata e timestamp do banco.

### Aplicação

`getUserTermsComplianceState()` passa a compor o estado a partir do ledger e dos logs. `recordTermsAcceptance()` grava somente no ledger. `touchUserAccess()` grava somente no access log. `ensureCurrentTermsAcceptedOrRedirect()` passa a consultar o ledger e redirecionar, sem registrar aceite.

O login remove atalhos baseados em `user.app_metadata` e consulta `/api/auth/compliance` antes de decidir se a versão vigente já foi aceita.

## Escopo

Inclui schema, RLS/grants, fluxo server-side, API de compliance, login e testes/contratos estáticos necessários.

## Fora de escopo

- alteração de credenciais, email, senha, MFA ou providers de Auth;
- migração/remoção de metadata histórica de usuários existentes;
- qualquer DDL/DML em Production nesta etapa;
- cópia de dados reais da Santino para staging.

## Testes e critérios de aceitação

1. Fresh migration replay e `db lint` verdes.
2. Staging contém as duas tabelas com RLS habilitado/forçado e sem privilégios diretos de `anon`/`authenticated`.
3. POST explícito cria um único aceite por usuário/versão; repetição é idempotente.
4. GET retorna aceite vigente a partir do ledger.
5. Guard sem aceite redireciona e não insere aceite.
6. `touchUserAccess()` não chama `auth.admin.updateUserById()`.
7. Não existe chamada de `auth.admin.updateUserById()` no módulo de compliance.
8. Gates obrigatórios do repositório permanecem verdes.
9. Supabase Security Advisor não apresenta regressão após DDL em staging.

## Rollout

1. Aplicar migration somente em staging.
2. Validar estrutura, grants/RLS e comportamento com dados fictícios/temporários controlados.
3. Abrir PR draft com evidências.
4. Merge e Production somente após revisão e aprovação humana específica.

## Observabilidade

Falhas de persistência de aceite continuam sendo erro bloqueante. Falhas de log de acesso devem permanecer visíveis em logs server-side e não podem ser convertidas em mutação de Auth como fallback.

## Rollback

Antes de Production: rollback é Git + descarte/reset do ambiente de staging quando apropriado. Após eventual promoção futura, qualquer rollback de schema deve ser forward-only e preservar o ledger de aceite; nunca apagar registros jurídicos para reverter código.
