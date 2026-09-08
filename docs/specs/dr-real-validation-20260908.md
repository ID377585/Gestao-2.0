# DR real validation — 2026-09-08

Status: implementing
Priority: P2 critical operational
Date: 2026-09-08

## Contexto e evidência

O Disaster Recovery do Gestify possui workflow real em `main`, runner self-hosted `gestify-dr-hostgator`, criptografia AES-256, checksum SHA-256, destino off-site S3-compatible e restore em stack Supabase descartável.

A execução real observada em 2026-09-08 chegou corretamente ao runner, instalou dependências e passou o preflight de Docker, GPG, AWS CLI e secrets básicos. A falha ocorreu no primeiro `supabase db dump`, antes da criação do bundle:

- host observado: shared Supavisor `aws-1-sa-east-1.pooler.supabase.com`;
- porta observada: `6543` (transaction pooler);
- usuário observado pelo erro: `postgres`;
- resultado: `password authentication failed for user "postgres"` e `ESSLREQUIRED`.

A documentação oficial do Supabase para backup/restore recomenda conexão direta quando disponível ou **Session pooler** (`5432`) para operações de `pg_dump`; no Shared Pooler o usuário deve ter o formato `postgres.<PROJECT_REF>`. O projeto Production do Gestify é `ubwbnpckbwtllitonpjj`.

Além disso, a execução atual recebeu `GESTIFY_DR_INCLUDE_STORAGE=false`; portanto, mesmo que o dump de banco passe, o DR atual não comprova cópia dos objetos do Storage.

## Problema

O Gestify ainda não possui evidência de ponta a ponta para:

1. dump real do banco Production;
2. criptografia local;
3. upload da cópia real para o destino off-site;
4. download e verificação de checksum;
5. restore em banco separado e descartável;
6. recuperação e validação dos objetos do Supabase Storage;
7. RPO e RTO medidos em uma execução real.

Enquanto esses itens não estiverem comprovados, o DR deve permanecer classificado como parcial.

## Impacto

Em um incidente grave, a ausência de um restore real comprovado pode ampliar indisponibilidade e perda de dados. Este item não altera o funcionamento normal da aplicação, mas é requisito de prontidão comercial e continuidade de negócio.

## Invariantes de segurança

- Production é somente origem de leitura durante o backup.
- Nenhum DDL/DML destrutivo será executado em Production.
- O restore nunca deve apontar para Production.
- O workflow deve recusar origem e destino iguais.
- Dumps em texto claro só podem existir em diretório temporário do runner e devem ser apagados ao final.
- O bundle deve sair do runner somente após criptografia AES-256.
- Segredos, connection strings e passphrases nunca devem aparecer em logs ou artifacts.
- Evidências publicadas no GitHub devem conter apenas métricas e resultados, nunca dados de clientes.
- Storage Production será somente leitura durante exportação.

## Comportamento esperado

### Banco

A origem de backup deve usar uma conexão apropriada para `pg_dump`:

- preferencialmente Direct connection `db.ubwbnpckbwtllitonpjj.supabase.co:5432`, se o runner tiver conectividade IPv6/IPv4 compatível; ou
- Shared Session pooler em `:5432` com usuário `postgres.ubwbnpckbwtllitonpjj`.

A conexão deve exigir SSL (`sslmode=require` no mínimo; `verify-full` é o alvo posterior quando o CA estiver instalado no runner).

### Off-site

O bundle criptografado, `.sha256` e metadata devem ser gravados no bucket externo configurado. O mesmo bundle precisa ser baixado novamente do off-site antes do restore, evitando validar apenas o arquivo local recém-criado.

### Restore de banco

O restore deve ocorrer em destino descartável e separado de Production. O processo deve validar:

- checksum;
- schema e dados;
- histórico `supabase_migrations`;
- contagens críticas;
- RLS em todas as tabelas públicas;
- ausência de grants indevidos para `anon`/`PUBLIC`;
- contrato `gestify_core_security_audit()`;
- inexistência de divergência entre origem e destino nas contagens monitoradas.

### Storage

O backup real deve incluir Storage. O teste deve comprovar, no mínimo:

- inventário de buckets;
- quantidade de objetos;
- bytes totais;
- download dos objetos para o bundle criptografado;
- recuperação dos objetos após decrypt;
- comparação de quantidade e bytes com o manifesto.

A republicação dos objetos em um projeto Supabase alvo permanece etapa controlada até existir importação automática segura. Para encerrar o DR comercialmente, deve existir uma restauração de Storage em destino separado ou um procedimento manual executado e evidenciado.

## RPO e RTO

### RPO

O backup lógico diário roda às 04:17 UTC. Sem PITR/WAL comprovado, o RPO máximo teórico dessa camada é aproximadamente 24 horas.

Em cada drill real deve ser registrado:

- `backupCreatedAt`;
- momento do incidente/drill;
- idade do ponto restaurado;
- `observedRpoSeconds`.

Meta comercial atual: 15 minutos. Essa meta não deve ser declarada como atingida somente com o backup lógico diário.

### RTO

O RTO observado deve medir do início da recuperação até a conclusão das validações mínimas de banco e Storage. Registrar separadamente:

- download off-site;
- checksum + decrypt;
- restore do banco;
- validações do banco;
- recuperação/validação do Storage;
- duração total.

Meta comercial atual: 4 horas.

## Plano de execução

1. Corrigir `GESTIFY_DR_SOURCE_DB_URL` no Environment `disaster-recovery` para conexão de backup suportada pelo Supabase e SSL obrigatório.
2. Reexecutar backup real com `run_live_backup=true` e confirmar criação + upload off-site.
3. Reexecutar com `run_restore_drill=true` e confirmar download do mesmo objeto, checksum e restore descartável.
4. Habilitar `GESTIFY_DR_INCLUDE_STORAGE=true` somente após configurar credenciais S3 de leitura do Supabase Storage no Environment.
5. Executar backup incluindo Storage e validar manifesto/objetos.
6. Restaurar Storage em projeto separado por procedimento controlado, sem sobrescrever Production.
7. Registrar RPO/RTO observados e anexar somente evidências não sensíveis.
8. Atualizar `docs/operations/disaster-recovery.md` com resultados reais e declarar o estado como `validated` somente após todas as etapas.

## Critérios de aceitação

- [ ] conexão de backup usa Direct ou Session pooler, não Shared Transaction pooler `:6543` para `pg_dump`;
- [ ] SSL obrigatório na conexão;
- [ ] dump real Production concluído sem escrita na origem;
- [ ] bundle AES-256 criado;
- [ ] checksum SHA-256 validado;
- [ ] bundle real armazenado off-site;
- [ ] bundle baixado novamente do off-site;
- [ ] restore de banco concluído em destino descartável separado;
- [ ] validações de RLS, grants, migrations e contagens aprovadas;
- [ ] Storage incluído no backup;
- [ ] objetos de Storage recuperados e comparados com o manifesto;
- [ ] restore de Storage em destino separado executado ou procedimento manual comprovado;
- [ ] RPO observado documentado;
- [ ] RTO observado documentado;
- [ ] nenhum secret ou dado de cliente publicado como evidence;
- [ ] material temporário apagado do runner.

## Evidência atual

### Execução real 2026-09-08

- runner: `gestify-dr-hostgator`;
- preflight: PASS;
- banco: FAIL na autenticação/SSL do primeiro dump;
- bundle criptografado: não criado;
- upload off-site: não executado;
- restore: não executado;
- Storage: desabilitado (`GESTIFY_DR_INCLUDE_STORAGE=false`);
- RPO observado: não mensurável ainda;
- RTO observado: não mensurável ainda.

## Rollback

Esta spec não altera Production. Qualquer mudança futura no workflow deve ser reversível por revert da branch/PR. Secrets de DR não devem ser reutilizados pela aplicação; caso uma credencial de backup seja rotacionada, atualizar exclusivamente o Environment `disaster-recovery` e validar novamente o preflight antes do próximo backup.
