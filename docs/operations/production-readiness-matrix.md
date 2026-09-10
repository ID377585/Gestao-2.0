# Production Readiness Matrix

Status operacional atualizado em 2026-08-17. Esta matriz é um gate de release, não uma declaração de segurança absoluta.

## Automated checks

Production deve executar:

```bash
npm run audit
npm run excel:smoke
npm run tenant:writes:ci
npm run runtime:imports:check
npm run readiness:check
npm run readiness:deployment
npm run build
```

No Vercel Production, `readiness:deployment` executa `readiness:strict`. GitHub CI também executa contrato Supabase e auditoria RLS/RPC quando os secrets de CI estão presentes.

## Current gate status

| Gate | Estado atual | Evidência / próximo passo |
| --- | --- | --- |
| Secrets/Auth/MFA | Verde | Credenciais modernas, rotação concluída, leaked-password protection e MFA/AAL2 administrativo habilitados |
| Production strict readiness | Verde | Production validada com `failed=0`; warnings não bloqueantes permanecem explícitos |
| Dependency production audit | Verde | Audit de dependências de produção no nível `high` passa; ExcelJS/uuid coberto por smoke |
| Monitoring básico | Verde/Amarelo | Watch contínuo cobre disponibilidade pública, Vercel e Supabase; continuar evoluindo SLA/alertas nativos |
| Sensitive-history purge | Amarelo | Histórico das branches reescrito; concluir GitHub Support para PR refs/cache/GC e verificação final do scanner |
| Branch protection | Vermelho externo | `main` continua sem proteção formal; habilitar plano/configuração GitHub compatível sem tornar repo público |
| Persistent staging | Vermelho externo | Criar branch/projeto Supabase persistente isolado após confirmação de custo |
| Tenant isolation | Amarelo forte | Testes adversariais passaram no Preview da Core; repetir matriz completa no staging persistente |
| Order RLS consolidation | Amarelo | Cutover aplicado e testado no Preview; não promover até staging persistente + regressão + janela controlada |
| Backup/restore | Vermelho | Executar restore real de DB + Storage, medir RPO/RTO e rollback |
| Load/performance | Vermelho | Rodar somente no staging; usar Supabase Advisors e workload real para decidir índices/pool/policies |
| Fiscal | Pausado por escopo | Sem cron até certificado/homologação; vira gate se o recurso for vendido |
| Biometria/LGPD | Pausado por escopo | Não liberar comercialmente sem revisão jurídica e controles de dado sensível |
| Billing | Amarelo por escopo | Entitlements/planos existem; cobrança manual precisa processo; automação de pagamento vira gate se ofertada |
| Documentation/runtime alignment | Amarelo | Contrato de secrets atualizado; alinhar Node 22 também nas Project Settings da Vercel quando houver acesso à configuração |

## Cron matrix atual

| Rota | Schedule | Credencial | Estado |
| --- | --- | --- | --- |
| `/api/jobs/process?limit=20` | `30 5 * * *` | `JOB_WORKER_SECRET` ou `CRON_SECRET` | ativo |
| `/api/nutricao/notifications/sweep` | `45 5 * * *` | `NUTRITION_CRON_SECRET`, `JOB_WORKER_SECRET` ou `CRON_SECRET` | ativo |
| `/api/fiscal/sync` | sem schedule | `FISCAL_SYNC_SECRET` ou `CRON_SECRET` | pausado até homologação fiscal |

Frequência dos workers deve ser revista contra o SLA comercial antes de volume relevante.

## Multi-tenant acceptance matrix

No staging persistente, exercitar no mínimo:

- `operacao`: leitura/escrita/RPC apenas no tenant permitido;
- `cliente`: apenas recursos próprios/permitidos;
- membership inativa: sem acesso;
- tenant A nunca lê/altera tenant B;
- criação com `establishment_id` estrangeiro é negada;
- RPCs rejeitam tenant ou papel indevido;
- `admin`, `producao`, `estoque`, `fiscal` e `entrega`: matriz de permissões específica do produto.

## RPO / RTO

Metas iniciais, ainda não comprovadas por exercício real:

- RPO: 15 minutos para banco;
- RTO: 4 horas para app + banco;
- Storage não crítico: mesmo dia útil.

Substituir por valores medidos antes de compromisso contratual.

## Release gate

Não liberar cadastros/comercialização ampla até todos os gates aplicáveis abaixo estarem verdes:

1. sensitive-data removal do incidente concluído no GitHub;
2. branch protection de `main` ativa;
3. staging persistente isolado;
4. matriz multiempresa completa aprovada;
5. order RLS homologado no staging e promovido de forma controlada;
6. restore de DB/Storage medido;
7. monitoring/alertas ativos;
8. Production `readiness:strict` verde;
9. produção sem vulnerabilidade `high` conhecida no `npm audit --omit=dev` ou com exceção formal e mitigação explícita;
10. teste de carga aprovado;
11. fiscal/biometria/billing concluídos somente quando fizerem parte do escopo comercial vendido.

## Dependency policy

A exceção histórica de `uuid <11.1.1` via `exceljs` foi removida. O Gestify força `uuid 11.1.1` nessa cadeia e valida round-trip XLSX/base64 no `excel:smoke`. Dependabot acompanha atualizações futuras. Não usar `npm audit fix --force` como procedimento automático.

## Runtime import gate

`npm run runtime:imports:check` deve manter OCR, PDF, Excel, SOAP e criptografia fiscal fora de bundles client/middleware por import estático. Warnings do Next/Edge devem ser tratados de forma controlada, sem substituir testes reais.
