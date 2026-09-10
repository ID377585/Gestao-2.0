# DR live backup connectivity recovery

Status: implementing
Priority: P2
Issue: #18
Date: 2026-09-08

## Contexto e evidência

O job agendado real de Disaster Recovery executou em `main` no run `34206747177` e chegou corretamente ao runner dedicado `gestify-dr-hostgator`, com Environment/secrets presentes e preflight operacional verde. O job falhou ao iniciar o dump lógico oficial do Supabase.

Falha observada, sem expor credenciais:

- conexão apontava para Shared Pooler na porta `6543`;
- autenticação foi tentada com usuário `postgres`;
- Supabase retornou `password authentication failed for user "postgres"` e exigência de SSL;
- o backup não chegou a ser enviado para o destino off-site.

A documentação atual do Supabase recomenda conexão direta para `pg_dump` ou, quando o runner é IPv4-only, Shared Pooler em **session mode** na porta `5432`, com usuário `postgres.<project_ref>`. SSL deve ser exigido.

## Problema

`GESTIFY_DR_SOURCE_DB_URL` pode ter sido cadastrado em formato adequado para tráfego transacional da aplicação, mas inadequado para `pg_dump`/DR. Um segredo válido em conteúdo pode portanto falhar operacionalmente por host/porta/usuário/mode.

## Comportamento esperado

Antes de qualquer dump, o job deve normalizar somente a estrutura da URL de conexão DR, sem imprimir password:

1. Shared Pooler `*.pooler.supabase.com` deve usar session mode `5432`;
2. usuário `postgres` deve ser transformado em `postgres.<GESTIFY_DR_SOURCE_PROJECT_REF>`;
3. `sslmode=require` deve existir;
4. outras URLs já válidas devem ser preservadas;
5. a senha nunca pode aparecer em log;
6. o job deve validar conectividade read-only antes do primeiro dump.

## Invariantes de segurança

- Production continua somente leitura para o processo de backup;
- nenhuma DDL/DML em Production;
- nenhum secret é alterado ou versionado;
- nenhum valor de password é impresso;
- restore nunca pode apontar para o mesmo banco de origem;
- bundles continuam criptografados AES-256 e checksum SHA-256;
- GitHub artifacts continuam recebendo somente relatórios.

## Escopo

- normalização segura da URL de banco usada no job live;
- preflight de conectividade read-only;
- documentação da causa e rollback.

## Fora de escopo desta correção

- habilitar `GESTIFY_DR_INCLUDE_STORAGE=true` sem credenciais S3 específicas de Supabase Storage;
- alterar/rotacionar senha do banco;
- criar projeto Supabase de restore pago;
- fechar RPO/RTO antes de um round-trip real concluído.

## Critérios de aceitação

- auditoria DR existente verde;
- CI verde;
- URL normalizada não expõe password em stdout;
- pooler `6543 + postgres` é convertido para `5432 + postgres.<ref>`;
- `sslmode=require` é aplicado;
- após merge autorizado, o próximo job live deve passar do preflight e do dump; se a senha em si estiver incorreta, a falha deve ficar explicitamente classificada como secret inválido e exigir rotação/aprovação humana.

## Rollout

1. implementar em branch;
2. executar gates no PR;
3. revisão humana;
4. merge autorizado;
5. rerun do job real ou aguardar próximo schedule;
6. confirmar upload off-site e, em execução de restore, download + restore descartável;
7. medir RPO/RTO usando timestamps do manifesto e relatório de restore.

## Rollback

Reverter a PR. Nenhuma alteração de schema/dados de Production é realizada por esta mudança.
