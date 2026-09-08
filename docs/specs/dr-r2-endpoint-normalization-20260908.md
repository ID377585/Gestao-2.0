# DR R2 endpoint normalization

Status: implementing
Priority: P2
Date: 2026-09-08

## Contexto e evidência

O preflight operacional do Disaster Recovery chega ao runner self-hosted, valida Docker/Node/GPG/AWS CLI e falha no primeiro acesso ao Cloudflare R2 com `HeadBucket 400 Bad Request`.

O endpoint S3 do provider pode ser cadastrado tanto na forma de endpoint da conta quanto, por erro operacional, com o nome do bucket anexado ao caminho. Como o bucket já é informado separadamente por `GESTIFY_DR_S3_BUCKET`, o contrato do Gestify deve normalizar essa duplicidade antes de chamar a AWS CLI.

## Problema

`run-operational-preflight.sh` repassa `GESTIFY_DR_S3_ENDPOINT` diretamente para `aws --endpoint-url`. Se o valor terminar em `/<bucket>`, o endpoint fica incompatível com o uso separado de `--bucket`, resultando em falha de `HeadBucket`.

## Invariantes de segurança

- não acessar banco Production;
- não exigir `GESTIFY_DR_SOURCE_DB_URL` no preflight sintético;
- não imprimir secrets, access keys ou passphrase;
- não ativar `GESTIFY_DR_ENABLED`;
- não executar backup real nesta mudança;
- manter payload sintético sem dados de usuários;
- preservar criptografia AES256 e verificação de checksum/decrypt.

## Design

Normalizar localmente `GESTIFY_DR_S3_ENDPOINT` no preflight:

1. remover barra final;
2. se o endpoint terminar exatamente em `/$GESTIFY_DR_S3_BUCKET`, remover esse sufixo;
3. usar o endpoint normalizado apenas em memória, sem registrar seu valor em logs;
4. preservar comportamento atual para endpoints já corretos.

A mesma regra deve ser aplicada ao job de backup real antes de sua ativação.

## Testes e critérios de aceitação

1. CI e auditorias DR verdes;
2. preflight sintético em `main` chega ao R2 sem `HeadBucket 400`;
3. upload/download sintético, checksum e decrypt passam;
4. relatório confirma `productionDatabaseAccessed=false`;
5. nenhum secret aparece nos logs.

## Rollout

Branch isolada -> CI -> PR -> revisão humana -> merge -> executar manualmente o preflight sintético em `main`.

## Rollback

Reverter a alteração de normalização. Nenhum dado de banco ou tenant é transformado.
