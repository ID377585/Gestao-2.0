# Evidência do drill de disaster recovery do Gestify Core v1

Data: 2026-08-10

## Escopo

Esta evidência registra um round-trip automatizado com dados exclusivamente fictícios. Ela comprova o funcionamento da cadeia de dump lógico, criptografia, checksum, restauração em uma segunda instância descartável e verificações de segurança do banco.

Ela não comprova backup off-site de produção, recuperação de objetos do Storage, recuperação de Auth/Vercel ou RPO/RTO reais do Gestify.

## Execução aprovada

```text
Branch: agent/gestify-core-v1
Commit validado pelo drill: bfa1109d6d58afe3f481d1f7854707d836ba8c9f
Workflow: Disaster recovery drill
Run: 31428625196
Conclusão: success
Artifact: gestify-dr-fixture-report-31428625196-1
Artifact digest: sha256:3d20262ec2794708cffc48e3a58eed16bb54603206d243ec5bc7728d10d2c0a1
```

O job real de backup off-site permaneceu `skipped`, conforme esperado, porque `GESTIFY_DR_ENABLED` não foi habilitado e nenhum secret de produção foi utilizado.

## Resultado do relatório

```json
{
  "format": "gestify-restore-report-v1",
  "ok": true,
  "targetMode": "local-supabase",
  "durationSeconds": 20,
  "publicTablesWithoutRls": 0,
  "anonymousPublicTableGrants": 0,
  "securityContractOk": true,
  "storageIncluded": false
}
```

Contagens críticas preservadas entre origem e destino:

```text
establishments: 2 -> 2
memberships:    2 -> 2
profiles:       2 -> 2
products:       2 -> 2
orders:         2 -> 2
audit_logs:     1 -> 1
```

Também foram aprovados:

- histórico `supabase_migrations` incluído no backup e restaurado;
- criptografia simétrica AES-256 antes de qualquer cópia externa;
- checksum SHA-256 do pacote;
- zero tabelas públicas sem RLS na origem e no destino;
- zero grants de tabela para `anon` ou `PUBLIC` na origem e no destino;
- reconciliação segura dos default privileges do destino;
- contrato `gestify_core_security_audit()` com `ok=true`;
- isolamento entre Tenant A e Tenant B;
- tentativa de alteração cross-tenant bloqueada;
- trigger append-only do log de auditoria preservado;
- publicação no GitHub apenas do relatório JSON, nunca do bundle criptografado.

## Falhas encontradas e corrigidas pelo próprio drill

Antes da aprovação, o teste encontrou quatro problemas reais na automação:

1. a fixture era inserida depois da inicialização e não possuía histórico de migrations;
2. a migration fictícia continha um meta-comando do `psql` incompatível com o runner de migrations;
3. o destino Supabase aplicava default privileges mais amplos durante a recriação das tabelas;
4. revogar privilégios apenas na origem não garantia a mesma ACL no destino.

As correções passaram a:

- aplicar a fixture como migration versionada;
- aceitar somente SQL compatível com migrations;
- registrar RLS e grants anônimos da origem no manifesto;
- recusar restore validado quando a origem já estiver insegura;
- reconciliar os privilégios do destino somente quando a origem comprovar zero grants anônimos.

## Limites e próximos gates

Continuam necessários antes de declarar disaster recovery comercialmente pronto:

- runner self-hosted endurecido e fora do domínio de falha principal;
- GitHub Environment `disaster-recovery` e secrets separados;
- bucket off-site com versionamento, lifecycle e imutabilidade;
- primeira cópia real criptografada fora do provedor principal;
- download dessa cópia e restore em projeto Supabase separado;
- backup e republicação validada dos objetos do Storage;
- inventário de Auth, SMTP, domains, secrets e Edge Functions;
- smoke tests de login, tenant, pedidos, estoque, financeiro e fiscal;
- RPO e RTO reais medidos;
- conclusão dos bloqueios de credenciais da issue #15.

A configuração operacional e o primeiro restore real são acompanhados pela issue #18.
