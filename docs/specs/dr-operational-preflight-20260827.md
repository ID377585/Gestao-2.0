# DR operational preflight

Status: implementing
Priority: P2
Issue: #18
Date: 2026-08-27

## Contexto e evidência

A fundação de Disaster Recovery da PR #63 está na `main` e o job `Fixture backup and restore` continua verde. Em 2026-08-27 o run #95 restaurou uma fixture criptografada e publicou somente o relatório JSON. No mesmo run, o job `Encrypted off-site backup and optional restore` foi `skipped`.

Portanto, existe evidência de que o mecanismo lógico funciona com dados artificiais, mas ainda não existe evidência executada de que o runner `gestify-dr`, o GitHub Environment `disaster-recovery` e o destino S3/S3-compatible off-site estejam prontos para uso operacional.

O conector disponível também não expõe inventário de runners, Environments ou nomes de secrets. A ausência dessa leitura não deve ser confundida com ausência de configuração.

## Problema

O preflight atual está dentro do job live. Para alcançá-lo é necessário habilitar o fluxo real, e depois do preflight o job segue para o backup da origem. Isso não oferece uma forma segura de provar runner + ferramentas + criptografia + round-trip off-site sem fornecer a credencial do banco de Production.

## Comportamento esperado

Adicionar um preflight operacional independente que:

1. rode somente por `workflow_dispatch` na `main`;
2. use o mesmo runner self-hosted `linux/x64/gestify-dr` e Environment `disaster-recovery`;
3. não receba `GESTIFY_DR_SOURCE_DB_URL`, `SUPABASE_DB_URL` ou credenciais de Storage Production;
4. valide Docker, Node.js, GPG, AWS CLI e acesso ao bucket off-site;
5. crie somente um pequeno payload sintético;
6. criptografe com AES-256, envie ao prefixo `preflight/`, baixe novamente, valide SHA-256, descriptografe e compare o conteúdo;
7. publique somente um relatório JSON sem bucket, chave de acesso, endpoint, passphrase ou payload;
8. mantenha `GESTIFY_DR_ENABLED=false` durante este estágio;
9. não execute dump, query ou restore contra Production.

## Invariantes de segurança

- `run-operational-preflight.sh` não pode referenciar `SUPABASE_DB_URL` nem `GESTIFY_DR_SOURCE_DB_URL`.
- O preflight não pode chamar `create-encrypted-backup.sh` nem `restore-encrypted-backup.sh`.
- O GitHub artifact recebe apenas o relatório JSON.
- Nenhum segredo é escrito em stdout; shell tracing permanece desligado.
- O objeto sintético off-site não contém dados pessoais, tenant data ou credenciais e deve ser removido posteriormente por lifecycle do bucket, não por permissões destrutivas do principal de backup.
- O principal de preflight deve precisar somente de acesso restrito ao prefixo do Gestify.

## Fora de escopo

- backup real do banco Production;
- restore de dados reais;
- alteração de `GESTIFY_DR_ENABLED`;
- criação/alteração de secrets, runner, bucket ou políticas de retenção;
- validação de Auth/Storage/Vercel pós-restore real;
- medição comercial final de RPO/RTO.

## Critérios de aceitação

- auditor estático de DR exige o novo preflight e proíbe acesso ao banco;
- fixture DR continua verde;
- CI normal permanece verde;
- workflow live existente permanece com os mesmos gates de Production;
- após merge humano separado, uma execução manual do preflight pode comprovar runner e off-site sem acessar Production.

## Rollout

1. branch isolada;
2. CI + fixture em PR;
3. revisão humana;
4. merge separado e autorizado;
5. manter `GESTIFY_DR_ENABLED=false`;
6. configurar/validar Environment, runner e credenciais off-site fora do código;
7. executar somente `run_operational_preflight=true`;
8. revisar relatório;
9. apenas depois planejar, em janela e autorização específicas, o primeiro backup real e restore descartável.

## Rollback

Reverter o workflow, script, auditoria e documentação do preflight. Nenhuma alteração de banco ou dado de Production é necessária para o rollback.
