# LGPD Incident Response Runbook

Status: operational baseline — hardened 2026-09-09
Owner: Security + Encarregado + Legal

## Objetivo

Padronizar a resposta a incidentes de segurança envolvendo dados pessoais no Gestify, preservando evidências, reduzindo impacto, respeitando papéis de Controlador/Operador e suportando os prazos regulamentares aplicáveis.

## Gatilhos

Acionar este runbook quando houver suspeita ou confirmação de:

- acesso não autorizado a dados pessoais;
- exposição entre tenants;
- vazamento, exfiltração ou compartilhamento indevido;
- perda, destruição ou alteração não autorizada;
- credencial ou segredo comprometido com potencial acesso a dados pessoais;
- falha de RLS/autorização;
- backup, exportação ou log contendo dados expostos indevidamente;
- incidente de suboperador que possa afetar dados tratados pelo Gestify;
- ransomware, indisponibilidade ou corrupção que afete confidencialidade, integridade ou disponibilidade de dados pessoais;
- envio de dados ao destinatário errado;
- exposição acidental por suporte, observabilidade, e-mail ou ferramenta de terceiros.

## Relógios obrigatórios

Registrar separadamente:

1. `detected_at`: quando o evento/suspeita foi detectado;
2. `personal_data_impact_known_at`: quando houve conhecimento confiável de que dados pessoais foram afetados;
3. `controller_notified_at`: quando cada Controlador cliente afetado foi informado;
4. `anpd_notified_at`: quando aplicável;
5. `subjects_notified_at`: quando aplicável;
6. `contained_at`;
7. `closed_at`.

Nunca substituir esses timestamps por uma única data genérica de 'incidente'.

## Janela interna Operadora -> Controlador

Quando a Gestify atuar como Operadora, o alvo operacional é informar o Controlador afetado assim que houver fato minimamente confiável e, ordinariamente, em até 24 horas após a confirmação de incidente material sob sua esfera que afete dados daquele Controlador.

Essa janela interna:
- não altera a responsabilidade legal do Controlador;
- não autoriza aguardar 24 horas quando a informação puder ser enviada antes;
- permite atualização posterior caso o escopo ainda esteja em investigação;
- deve ser contratualmente compatível com o DPA.

## Prazo externo quando Gestify for Controladora

Quando o incidente puder acarretar risco ou dano relevante aos titulares, o fluxo deve suportar a comunicação à ANPD e aos titulares no prazo regulamentar aplicável. Pela Resolução CD/ANPD nº 15/2024, a referência operacional é de 3 dias úteis, observadas as regras vigentes, exceções e eventual comunicação complementar.

O prazo deve ser contado a partir do conhecimento juridicamente relevante do incidente com dados pessoais, não da conclusão da investigação completa. A ausência de todas as informações não deve ser usada para atrasar indevidamente a comunicação quando a norma permitir complementação posterior.

## Primeiros passos

1. Abrir ID único do incidente.
2. Registrar os relógios conhecidos.
3. Identificar quem reportou e qual ambiente foi afetado.
4. Preservar logs/evidências antes de rotações ou mudanças destrutivas.
5. Conter o vetor sem destruir evidências.
6. Identificar tenants, sistemas, tabelas, buckets, APIs e suboperadores envolvidos.
7. Revogar/rotacionar credenciais comprometidas quando necessário.
8. Impedir novas exposições antes de restaurar fluxo normal.
9. Nomear incident commander e responsável jurídico/privacidade.
10. Abrir cronologia de decisões e comunicações.

## Classificação mínima

Registrar:

- natureza do incidente;
- origem provável;
- período de exposição;
- categorias e volume aproximado de dados;
- existência de dados pessoais sensíveis;
- quantidade estimada de titulares;
- categorias de titulares;
- tenants afetados;
- medidas de segurança existentes, como criptografia/pseudonimização;
- possibilidade de identificação, fraude, dano financeiro, discriminação, dano reputacional, roubo de identidade ou outros impactos;
- probabilidade e gravidade do dano;
- se dados estavam inteligíveis ao agente não autorizado;
- se houve exfiltração confirmada ou apenas possibilidade de acesso;
- países/suboperadores envolvidos;
- risco de recorrência.

## Matriz de severidade operacional

- **SEV-1 crítico:** tenant escape, credencial administrativa/service-role comprometida, grande volume, dados sensíveis/biométricos, exfiltração confirmada, ransomware grave ou risco relevante provável. Escalação imediata.
- **SEV-2 alto:** exposição limitada mas confirmada, múltiplos titulares, acesso indevido com potencial significativo. Escalação em caráter urgente.
- **SEV-3 moderado:** evento contido, baixo volume/impacto, sem evidência de dano relevante, mas ainda requer registro e avaliação.
- **SEV-4 baixo:** quase-incidente/controle preventivo acionado sem exposição confirmada; registrar para aprendizado quando útil.

Classificação operacional não substitui a avaliação jurídica de risco/dano relevante.

## Papéis

### Gestify como Operadora

Quando o dado afetado tiver sido inserido e tratado em nome de empresa cliente:

- informar o Controlador afetado sem demora indevida e dentro da janela interna definida acima;
- fornecer fatos conhecidos, cronologia, escopo, categorias de dados/titulares, medidas adotadas e atualizações;
- informar explicitamente o que ainda não foi confirmado;
- não comunicar titulares em nome do cliente sem instrução ou obrigação legal própria;
- cooperar tecnicamente para investigação, contenção e atendimento regulatório;
- preservar evidência suficiente para o Controlador avaliar suas obrigações.

### Gestify como Controladora

Quando a NT Solution/Gestify definir as finalidades e meios do tratamento afetado:

- avaliar formalmente se o incidente pode acarretar risco ou dano relevante;
- documentar a decisão de comunicar ou não comunicar;
- quando aplicável, preparar e enviar comunicação à ANPD e aos titulares no prazo regulamentar;
- manter o encarregado informado e disponível como canal;
- considerar comunicação complementar quando fatos relevantes surgirem depois.

## Conteúdo da comunicação

Quando aplicável, reunir conforme a regulamentação vigente:

- natureza do incidente;
- categorias de dados pessoais afetados;
- categorias e número estimado de titulares e registros, quando possível;
- medidas técnicas/de segurança relevantes;
- riscos relacionados ao incidente;
- medidas adotadas ou planejadas para reverter/mitigar efeitos;
- data do conhecimento e cronologia essencial;
- justificativa quando informação ainda não estiver disponível;
- contato do encarregado/responsável;
- medidas recomendadas aos titulares quando úteis.

A comunicação deve ser clara e não minimizar fatos conhecidos nem afirmar ausência de impacto sem base.

## Suboperadores

Quando o incidente ocorrer em fornecedor/suboperador:

1. preservar ticket/ID/evidência do fornecedor;
2. obter cronologia e escopo formal;
3. identificar dados/tenants afetados;
4. exigir atualizações dentro da obrigação contratual;
5. avaliar se a informação do fornecedor é suficiente ou exige investigação própria;
6. acionar mecanismo de transferência internacional/contrato quando relevante;
7. registrar falhas contratuais e ação corretiva do fornecedor.

## Evidências

Manter, conforme aplicável:

- logs de autenticação/autorização;
- logs de banco e aplicação;
- registros de deploy e alterações;
- eventos de firewall/CDN/provedor;
- IDs de incidentes de fornecedores;
- cópias de notificações enviadas e comprovantes;
- cronologia das decisões;
- responsáveis/approvers;
- análise de causa raiz;
- plano de prevenção de recorrência;
- decisão formal sobre risco/dano relevante;
- escopo de dados/tenants afetados;
- evidência de contenção e validação pós-correção.

## Relação com legal hold

Não excluir evidências relacionadas ao incidente enquanto houver investigação, obrigação regulatória, disputa ou legal hold aplicável. O hold deve ser específico e não justificar retenção indiscriminada de todo o banco.

## Encerramento

Um incidente só deve ser encerrado após:

- contenção confirmada;
- risco residual avaliado;
- comunicações obrigatórias concluídas ou decisão documentada de não comunicar;
- causa raiz registrada;
- correções preventivas atribuídas;
- evidências preservadas;
- revisão pós-incidente realizada;
- itens P0/P1 decorrentes criados e acompanhados;
- revisão de fornecedor/DPA quando o incidente revelar falha de terceiro.

## Restrições

- Não testar correções destrutivas em Production.
- Não usar dados reais sensíveis para reproduções desnecessárias.
- Não comunicar publicamente antes de validar fatos mínimos.
- Não atrasar comunicação exigida apenas para aguardar uma investigação perfeita.
- Não prometer ausência de impacto antes de concluir investigação suficiente.
- Não apagar logs/registros de aceite/incidente para reduzir exposição jurídica.
- Não usar canais pessoais não controlados para compartilhar dumps ou evidências contendo dados pessoais.
