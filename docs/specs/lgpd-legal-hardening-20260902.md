# Spec — LGPD / jurídico / compliance operacional hardening

Status: implementing — controls implemented, legal/vendor verification pending
Priority: P1
Updated: 2026-09-09

## Contexto

O Gestify é SaaS multiempresa e trata dados de representantes, usuários, colaboradores, fornecedores e outros titulares. A NT Solution/Gestify atua como Controladora em tratamentos próprios e, em regra, como Operadora para dados inseridos pelo cliente em seu tenant.

O objetivo desta rodada não é produzir cláusulas genéricas, mas alinhar regra pública, contrato, processo operacional, evidência e controle técnico às normas brasileiras aplicáveis.

## Base normativa verificada

- LGPD — Lei 13.709/2018;
- Marco Civil da Internet — Lei 12.965/2014, inclusive retenção de registros de acesso quando a obrigação legal se aplicar;
- CDC — Lei 8.078/1990 quando houver relação de consumo no caso concreto;
- regulamentação vigente da ANPD, incluindo Res. 15/2024 (incidentes), Res. 18/2024 (Encarregado) e Res. 19/2024 (transferência internacional);
- obrigações civis, fiscais, trabalhistas e setoriais conforme o tratamento/cliente.

## Evidência e problemas observados

1. O DPA v1.3 é resumido e genérico para suboperadores, incidentes, direitos, transferências e encerramento.
2. O Termo v1.3 contém regra ampla de aceite por uso continuado para versões futuras; alterações materiais precisam de abordagem mais robusta/versionada.
3. Retenção precisava sair de 'pelo tempo necessário' para regra por categoria, evento, método, backup e legal hold.
4. O fluxo de incidente precisava de relógios separados e janela interna Operadora -> Controlador.
5. O inventário de suboperadores/países/mecanismos de transferência depende de validação dos contratos e configurações reais.
6. Direitos de titulares precisavam de runbook com identidade, Controller/Operator, legal hold, evidência e prazo.
7. Tratamentos de alto risco precisavam de padrão RIPD/DPIA.
8. Biometria facial existe no código de ponto digital e, portanto, não pode ficar coberta apenas por termos genéricos.

### Evidência Production sobre biometria — leitura em 09/09/2026

- `hr_employee_face_profiles`: 0 perfis cadastrados;
- eventos com `selfie_path`: 1;
- estabelecimentos com `require_face_detection = true`: 0;
- estabelecimentos com `require_selfie = true`: 0;
- Storage `employee-face-profiles`: nenhum objeto retornado;
- Storage `time-clock-selfies`: 1 objeto.

Nenhum dado foi excluído ou alterado durante a auditoria.

Conclusão operacional: reconhecimento facial não está configurado como requisito ativo em Production, mas o código suporta cadastro/comparação. A ativação comercial de biometria permanece bloqueada pela governança até existir RIPD, base legal, instrução contratual, retenção, controles e revisão jurídica específicos.

## Controles implementados nesta branch

- `docs/compliance/LGPD_CONTROL_FRAMEWORK.md`: 16 domínios de controle e release gate privacy-by-design;
- `docs/compliance/ROPA_PROCESSING_REGISTER.md`: inventário inicial de atividades;
- `docs/compliance/DSAR_RUNBOOK.md`: direitos dos titulares;
- `docs/compliance/RIPD_DPIA_STANDARD.md`: avaliação de impacto e risco;
- `docs/compliance/RETENTION_DELETION_LEGAL_HOLD.md`: retenção, eliminação, backup e legal hold;
- `docs/compliance/SUBPROCESSOR_TRANSFER_REGISTER.md`: fornecedores e transferências;
- `docs/compliance/CONSUMER_AND_SAAS_CONTRACT_GUARDRAILS.md`: B2B/B2C/PF/PJ e cláusulas de risco;
- `docs/security/LGPD_INCIDENT_RESPONSE_RUNBOOK.md`: 24h interno como alvo Operadora->Controlador e suporte ao prazo regulatório de 3 dias úteis quando Gestify for Controladora e houver risco/dano relevante;
- `src/lib/data-governance-content.ts`: política pública endurecida e versionada em 09/09/2026;
- `docs/legal/DPA_VNEXT_DRAFT.md`: minuta detalhada para revisão jurídica;
- `docs/legal/TERMS_VNEXT_CHANGESET.md`: mudanças necessárias antes de nova versão de Termos;
- `scripts/audit-lgpd-readiness.mjs` + workflow dedicado: gate estático de compliance.

## Invariantes

- nenhuma cláusula elimina responsabilidade inderrogável;
- consentimento não é base legal universal;
- dados sensíveis/biometria exigem tratamento específico;
- nenhum tenant pode acessar dados de outro;
- nenhuma solicitação de titular pode gerar cross-tenant disclosure;
- retenção deve ter finalidade/regra e legal hold específico;
- backup não é arquivo comercial permanente;
- transferência internacional exige base de tratamento + mecanismo válido;
- termos aceitos permanecem historicamente imutáveis no ledger;
- documentos públicos não podem prometer '100% seguro', invulnerabilidade ou risco jurídico zero;
- mudanças contratuais materiais não devem ser retroativas.

## Definição interna de 100% de readiness

100% significa que todo controle aplicável possui:
1. regra documentada;
2. responsável;
3. processo executável;
4. evidência verificável.

Não significa imunidade contra processos, autuações ou interpretação divergente de autoridade/tribunal.

## Bloqueadores antes de considerar 'released' jurídico

1. advogado brasileiro especializado revisar Termos vNext, DPA vNext, CDC/PF/PJ, responsabilidade, foro, cancelamento e biometria;
2. validar razão social/CNPJ/endereço/canal e papel formal do Encarregado;
3. preencher registro real de subprocessadores, países, DPAs e mecanismos de transferência a partir das contas/contratos ativos;
4. definir comercialmente janela de exportação/eliminação pós-término e SLA que possa ser medido;
5. decidir se/como biometria será ofertada; se sim, concluir RIPD e contrato específico antes de ativação;
6. implementar qualquer automação adicional de DSAR/deletion que seja necessária para os volumes reais;
7. versionar Termos/DPA futuros e testar reaceite afirmativo quando aplicável;
8. passar CI, audit de compliance, build e Preview;
9. revisão humana antes de merge/publicação.

## Rollback

Reverter a PR. Nenhuma alteração de banco, Storage ou dados de Production faz parte desta branch. Se uma futura versão contratual for publicada, rollback deve preservar os aceites históricos e nunca apagar o ledger de versões anteriores.
