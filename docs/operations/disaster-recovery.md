# Disaster Recovery do Gestify

Data inicial: 2026-08-10

## Objetivo

Transformar backup e restauração em uma capacidade executável, verificável e
reversível. O objetivo não é apenas gerar arquivos: o Gestify precisa provar que
uma cópia pode ser descriptografada, restaurada em ambiente descartável e
validada sem acessar ou alterar produção.

A rotina mantém a decisão arquitetural do Core v1: segurança e regras críticas
ficam no servidor e no banco. Nenhum segredo, dump ou autorização de restore é
entregue ao frontend.

## Escopo desta entrega

Foram criados dois níveis independentes:

1. **Drill com fixture fictícia**
   - executa em GitHub-hosted runner;
   - inicia um Supabase local isolado;
   - cria dois tenants fictícios;
   - gera dump lógico, criptografa, restaura em outro Supabase local;
   - valida contagens, RLS, isolamento entre tenants, grants de função e log
     append-only;
   - publica somente um relatório JSON sem dados de negócio.
2. **Backup real off-site e drill de restore**
   - só pode rodar na `main`;
   - exige `GESTIFY_DR_ENABLED=true`;
   - exige o GitHub Environment `disaster-recovery`;
   - exige runner self-hosted Linux com label `gestify-dr`;
   - criptografa antes de enviar ao armazenamento externo;
   - nunca publica o bundle como GitHub artifact;
   - faz cópia lógica diária e round-trip de restore trimestral, quando
     configurado.

O workflow fica inativo para dados reais até que runner, secrets e destino
off-site sejam configurados. A fixture continua segura para pull requests.

## O que o backup contém

O banco é exportado em partes separadas:

```text
roles.sql
schema.sql
data.sql
history-schema.sql
history-data.sql
manifest.json
critical-counts.tsv
```

O manifesto registra versão do PostgreSQL, tamanho do banco, quantidade de
tabelas públicas sem RLS, contagens de tabelas críticas, commit e presença ou
não dos objetos do Storage. Ele fica dentro do pacote criptografado.

A cópia de banco inclui schema, dados, policies, funções, triggers e histórico de
migrations conforme o dump. Os objetos do Storage são opcionais e precisam de
credenciais S3 próprias do Supabase.

## Criptografia e integridade

Antes de sair do runner, o bundle é:

1. empacotado em `tar.gz`;
2. criptografado localmente com OpenPGP simétrico e AES-256;
3. validado por SHA-256;
4. enviado ao destino S3 ou S3-compatible junto do checksum e de metadados não
   sensíveis.

A frase secreta precisa ter pelo menos 32 caracteres e deve existir em um
cofre externo ao GitHub para que a restauração não dependa de uma única conta.
Não reutilizar senha de banco, JWT secret, service role ou senha de usuário.

Os scripts executam com `set +x` e `umask 077`, removem material em texto claro
e recusam passphrase curta. O runner também deve usar disco criptografado e ser
ephemeral sempre que possível.

## Agendamento

O workflow `disaster-recovery.yml` possui:

- cópia lógica criptografada diária às `04:17 UTC`;
- round-trip trimestral às `04:47 UTC` no primeiro dia de janeiro, abril, julho
  e outubro;
- execução manual separando “criar backup” e “testar restore”.

A cópia lógica diária **não substitui PITR** nem arquivamento contínuo de WAL.
Sem PITR comprovado, o RPO prático dessa cópia pode chegar a 24 horas. A meta de
RPO de 15 minutos só pode ser declarada depois de habilitar e testar uma solução
compatível com essa janela.

## Configuração no GitHub

### Environment

Criar o Environment:

```text
disaster-recovery
```

Usar secrets exclusivos desse ambiente. Não copiar esses valores para Vercel,
para variáveis `NEXT_PUBLIC_*` ou para o repositório.

### Variáveis do repositório

```text
GESTIFY_DR_ENABLED=false
GESTIFY_DR_INCLUDE_STORAGE=false
GESTIFY_DR_S3_PREFIX=gestify/daily
```

Alterar `GESTIFY_DR_ENABLED` para `true` somente depois do preflight do runner e
de um teste com banco fictício.

### Secrets obrigatórios

```text
GESTIFY_DR_SOURCE_DB_URL
GESTIFY_DR_BACKUP_PASSPHRASE
GESTIFY_DR_S3_BUCKET
GESTIFY_DR_S3_ACCESS_KEY_ID
GESTIFY_DR_S3_SECRET_ACCESS_KEY
```

Secrets opcionais ou dependentes do provedor:

```text
GESTIFY_DR_S3_ENDPOINT
GESTIFY_DR_S3_REGION
SUPABASE_STORAGE_S3_ENDPOINT
SUPABASE_STORAGE_S3_ACCESS_KEY_ID
SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY
SUPABASE_STORAGE_S3_REGION
```

A credencial off-site deve ter privilégio mínimo no prefixo do Gestify. Para a
rotina normal, permitir `PutObject`, `GetObject` e listagem restrita. Preferir
retenção imutável/Object Lock e impedir exclusão pelo mesmo principal que grava
o backup.

## Runner self-hosted

O job real não roda em GitHub-hosted runner para evitar levar dados reais a uma
máquina compartilhada de terceiros. O runner `gestify-dr` deve:

- ficar fora do servidor e, idealmente, fora da mesma região/falha do banco;
- aceitar somente conexão de saída;
- não expor Docker, PostgreSQL ou SSH publicamente sem controle;
- usar Linux x64, Docker, Node.js 22, GPG e AWS CLI;
- ter disco criptografado;
- não hospedar a aplicação de produção;
- ser atualizado e reconstruído regularmente;
- apagar workspace e volumes depois de cada execução;
- enviar logs para monitoramento sem registrar URLs com senha ou secrets.

## Comandos locais

### Drill seguro com dados fictícios

```bash
npm ci
npm run dr:fixture
```

O resultado esperado é um arquivo semelhante a:

```text
.artifacts/dr-fixture/restore-report-YYYYMMDDTHHMMSSZ.json
```

O drill falha quando o restore perde tabelas, desabilita RLS, altera contagens,
remove o trigger append-only, amplia grants ou permite acesso cross-tenant.

### Criar backup real

Use injeção de secrets ou um cofre; não coloque valores na linha de comando ou
no histórico do shell.

```bash
npm run dr:backup
```

O script exige internamente:

```text
SUPABASE_DB_URL
BACKUP_PASSPHRASE
```

### Restaurar em Supabase local descartável

```bash
npm run dr:restore
```

O script exige `BACKUP_FILE`, `BACKUP_PASSPHRASE` e, quando disponível,
`BACKUP_CHECKSUM_FILE`. Sem destino informado, ele cria um Supabase local
isolado, restaura e o remove ao terminar.

### Restaurar em destino externo descartável

Só usar em projeto vazio criado para o teste:

```text
DR_TARGET_DB_URL
DR_TARGET_CONFIRMATION=RESTORE_TO_DISPOSABLE_TARGET
```

O script recusa origem e destino iguais e recusa destino que já contenha as
tabelas críticas. Nunca apontar `DR_TARGET_DB_URL` para produção.

## Validação executada após o restore

O restore real verifica automaticamente:

- existência de tabelas críticas;
- RLS em todas as tabelas do schema `public`;
- ausência de grants de tabela para `anon` e `PUBLIC`;
- existência e resultado do contrato `gestify_core_security_audit()`;
- contagens de tabelas críticas iguais às do manifesto;
- checksum do bundle;
- quantidade e bytes dos objetos incluídos no pacote de Storage;
- tempo total do restore para medir RTO.

A fixture adiciona testes com dois tenants, tentativa de alteração cross-tenant
e proteção append-only.

## Storage: limite atual

Quando `GESTIFY_DR_INCLUDE_STORAGE=true`, os arquivos dos buckets são baixados e
incluídos dentro do bundle criptografado. O restore atual recupera e valida esses
arquivos no diretório temporário, mas **ainda não os republica automaticamente
em um projeto Supabase alvo**.

Essa limitação é intencional: publicar objetos requer mapear buckets, políticas,
MIME, cache e credenciais do destino sem sobrescrever arquivos existentes. Até
a automação de importação ser validada, o restore de Storage é um passo manual
controlado e deve ser testado em projeto separado.

Também ficam fora do dump lógico e precisam de inventário próprio:

- API keys e JWT secrets;
- configuração de provedores Auth e URLs de redirect;
- SMTP;
- domains e DNS;
- secrets da Vercel;
- Edge Functions e seus secrets;
- configuração de Realtime/publications;
- configuração S3 e políticas de retenção do destino off-site.

## Retenção recomendada

Política inicial para a cópia lógica externa:

```text
7 cópias diárias
5 cópias semanais
12 cópias mensais
4 evidências trimestrais de restore
```

A retenção deve ser aplicada no próprio bucket off-site por lifecycle e, quando
possível, com versionamento e imutabilidade. A conta que executa o backup não
deve conseguir reduzir a retenção.

## RPO e RTO

Metas de piloto:

```text
RPO desejado: 15 minutos
RTO desejado: 4 horas
```

Estado honesto:

- o drill com fixture mede se o processo funciona, não o RPO de produção;
- o backup lógico diário fornece defesa adicional, mas sozinho não atende RPO de
  15 minutos;
- o RTO só será comprovado depois do primeiro restore real, incluindo Storage,
  Auth, Vercel e smoke tests de negócio;
- cada relatório deve registrar duração e ser revisado por uma pessoa responsável.

## Procedimento de incidente

1. declarar um responsável único pelo restore;
2. congelar deploys, crons e migrations;
3. preservar logs e registrar o ponto de recuperação escolhido;
4. baixar a cópia off-site e validar SHA-256;
5. restaurar primeiro em destino descartável;
6. validar login, tenant, pedidos, estoque, financeiro, fiscal e Storage;
7. medir RPO e RTO reais;
8. promover somente depois da aprovação técnica e operacional;
9. comunicar clientes e titulares quando o incidente exigir;
10. registrar causa, evidência, rollback e ações preventivas.

## Gates antes de habilitar o job real

- [ ] runner self-hosted `gestify-dr` criado e endurecido;
- [ ] Environment `disaster-recovery` criado;
- [ ] secrets configurados e separados dos secrets da aplicação;
- [ ] bucket off-site fora do mesmo domínio de falha;
- [ ] lifecycle, versionamento e imutabilidade revisados;
- [ ] `npm run dr:fixture` aprovado;
- [ ] backup fictício enviado e baixado do destino off-site;
- [ ] restore fictício aprovado no runner real;
- [ ] responsável e contatos definidos;
- [ ] proteção contra senhas vazadas e rotação do incidente anterior concluídas;
- [ ] primeiro restore real executado em projeto Supabase separado;
- [ ] RPO/RTO medidos e registrados;
- [ ] automação de republicação do Storage validada ou procedimento manual aceito.
