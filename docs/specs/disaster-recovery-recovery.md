# Disaster Recovery recovery

Status: released (foundation only)
Priority: P2
Issue: #18

## Contexto

A fundação de Disaster Recovery foi recuperada pela PR #63 e está presente na `main`. O workflow executa um drill com fixture fictícia em pull requests e mantém o job real de backup off-site protegido por `main`, `GESTIFY_DR_ENABLED=true`, GitHub Environment `disaster-recovery` e runner self-hosted `gestify-dr`.

A existência do workflow não fecha o gate comercial. Em 2026-08-27 o run #95 confirmou novamente o fixture criptografado + restore descartável, enquanto o job `Encrypted off-site backup and optional restore` permaneceu `skipped`. Portanto, não há ainda evidência executada de backup real off-site, round-trip real, Storage restaurado ou RPO/RTO comercial.

## Objetivo da fundação entregue

Manter versionado o bloco de backup lógico criptografado, restore descartável, verificação de RLS/grants/contagens e workflow protegido, sem habilitar automaticamente acesso a Production.

## Invariantes

- nenhuma escrita em Production durante CI/Preview;
- backup real exige `GESTIFY_DR_ENABLED=true`, GitHub Environment `disaster-recovery`, runner dedicado e secrets próprios;
- restore externo exige confirmação explícita `RESTORE_TO_DISPOSABLE_TARGET` e destino vazio/diferente da origem;
- bundle criptografado usa AES-256/OpenPGP e checksum SHA-256;
- fixture CI usa apenas dados artificiais e destino descartável;
- cópia lógica não substitui PITR/WAL;
- GitHub artifacts recebem somente relatórios, nunca dumps ou bundles criptografados.

## Validação da fundação

1. CI normal verde;
2. job `Fixture backup and restore` verde em PRs recentes;
3. backup fixture criptografado é criado, origem é parada e restore ocorre em stack descartável;
4. restore verifica RLS, grants anônimos, contagens críticas e isolamento de tenants;
5. relatório JSON é publicado como artifact sem incluir dump/secret;
6. job live permanece bloqueado quando a configuração operacional não está habilitada.

## Próxima etapa

A spec `docs/specs/dr-operational-preflight-20260827.md` separa um preflight operacional sintético para comprovar runner, ferramentas, criptografia e round-trip S3 sem fornecer qualquer credencial de banco Production. Depois desse preflight e de revisão humana, o primeiro backup real/restore descartável deve ter autorização específica própria.

## RPO/RTO

O fixture mede duração de um restore artificial, mas RPO/RTO comercial só podem ser fechados após primeiro backup real off-site e restore real em destino separado, incluindo os componentes operacionais acordados para Storage/Auth/Vercel.

## Rollback

Reverter a PR #63 removeria o workflow e scripts. A fundação por si só não altera banco nem dados de Production.
