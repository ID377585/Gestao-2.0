# Runbooks de Incidente

Use estes roteiros para reduzir improviso durante incidentes. Registre horario,
autor, versao do deploy, estabelecimento afetado e evidencias coletadas.

## Vazamento de `service_role`

1. Revogar imediatamente a chave no Supabase.
2. Criar nova chave e atualizar Vercel Production, Preview e Development.
3. Forcar novo deploy.
4. Procurar uso indevido em logs de API, auditoria e PostgREST.
5. Revogar sessoes administrativas suspeitas.
6. Registrar incidente, impacto e comunicacao necessaria.

## Acesso Entre Estabelecimentos

1. Desabilitar temporariamente a rota ou modulo afetado por feature flag quando
   existir.
2. Coletar usuario, `establishment_id`, rota, payload e horario.
3. Preservar logs antes de rotacionar dados.
4. Revisar RLS, RPC e server action envolvidas.
5. Criar teste de regressao em staging com dois tenants.
6. Notificar titulares/clientes se houver confirmacao de exposicao de dados.

## Migration Defeituosa

1. Pausar novos deploys.
2. Identificar migration, horario e objetos afetados.
3. Avaliar rollback forward-only, sem `DROP` destrutivo em dados reais.
4. Restaurar em staging/copia antes de aplicar correcao em producao.
5. Rodar `npm run supabase:contract` e smoke test do modulo afetado.
6. Documentar causa e ajustar processo de revisao.

## Indisponibilidade Supabase

1. Confirmar status do provedor.
2. Ativar mensagem amigavel no app quando possivel.
3. Pausar crons que possam gerar retries agressivos.
4. Monitorar autenticacao, PostgREST, Storage e Realtime.
5. Retomar jobs pendentes apenas depois de estabilizar.

## Fila Duplicando Acoes

1. Pausar `/api/jobs/process` removendo temporariamente o cron ou segredo.
2. Consultar jobs `processing`, `dead` e `pending` por `dedupe_key`.
3. Conferir `lock_token`, `locked_until` e tentativas.
4. Reprocessar manualmente somente jobs idempotentes.
5. Corrigir consumidor antes de religar o worker.

## Falha Fiscal

1. Validar `FISCAL_SYNC_SECRET`/`CRON_SECRET`.
2. Confirmar ambiente fiscal, certificado e expiracao.
3. Reprocessar por chave/NSU, nunca em lote aberto sem idempotencia.
4. Remover dados sensiveis de logs compartilhados.
5. Registrar divergencias para revisao contábil/fiscal.

## Comprometimento de Conta Administrativa

1. Revogar sessao e resetar senha.
2. Revisar membership, permissoes e auditoria do usuario.
3. Rotacionar segredos acessados pela conta, se aplicavel.
4. Exigir MFA para administradores antes de reativar acesso.
5. Auditar alteracoes feitas pela conta comprometida.

## Incidente com Biometria

1. Desabilitar captura facial e usar metodo alternativo de ponto.
2. Restringir acesso aos buckets/perfis faciais.
3. Preservar trilha de auditoria.
4. Avaliar exposicao de imagem/template biometricos.
5. Acionar revisao LGPD e comunicacao de incidente quando exigido.

## Restore de Backup

1. Abrir sala de incidente e definir responsavel unico pela execucao.
2. Congelar deploys e migrations.
3. Restaurar em projeto separado antes de promover.
4. Medir RPO e RTO reais.
5. Validar login, pedidos, estoque, financeiro, fiscal e Storage.
6. Comunicar janela e status aos clientes afetados.
