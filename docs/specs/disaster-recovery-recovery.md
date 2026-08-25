# Disaster Recovery recovery

Status: implementing
Priority: P2
Issue: #18

## Contexto

A fundação de DR existia na PR #14 e teve fixture verde, mas nunca entrou na `main`. A `main` atual não possui workflow de disaster recovery.

## Objetivo

Recuperar somente o bloco de backup lógico criptografado, restore descartável, verificação de RLS/grants/contagens e workflow protegido, sem trazer o restante da antiga PR #14.

## Invariantes

- nenhuma escrita em Production durante CI/Preview;
- backup real exige `GESTIFY_DR_ENABLED=true`, GitHub Environment `disaster-recovery`, runner dedicado e secrets próprios;
- restore externo exige confirmação explícita `RESTORE_TO_DISPOSABLE_TARGET` e destino vazio/diferente da origem;
- bundle criptografado usa AES-256/OpenPGP e checksum SHA-256;
- fixture CI usa apenas dados artificiais e destino descartável;
- cópia lógica não substitui PITR/WAL.

## Escopo

- workflow `.github/workflows/disaster-recovery.yml`;
- scripts `scripts/dr/*` necessários para fixture, backup e restore;
- auditor de DR;
- documentação operacional;
- scripts npm `dr:fixture`, `dr:backup`, `dr:restore`.

## Validação

1. CI normal verde;
2. job `Fixture backup and restore` verde no PR;
3. backup fixture criptografado é criado, origem é parada e restore ocorre em stack descartável;
4. restore verifica RLS, grants anônimos, contagens críticas e isolamento de tenants;
5. relatório JSON é publicado como artifact sem incluir dump/secret;
6. nenhum job live roda sem os gates operacionais.

## Rollout

A PR pode ser mergeada somente após gates verdes e revisão humana. O workflow live permanece desabilitado até configuração externa da issue #18.

## RPO/RTO

O fixture mede duração do restore, mas RPO/RTO comercial só podem ser fechados após primeiro backup real off-site e restore real em destino separado.

## Rollback

Reverter a PR remove o workflow e scripts. Nenhuma alteração de banco é feita por este PR por si só.
