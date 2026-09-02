# LGPD Incident Response Runbook

Status: operational baseline
Updated: 2026-09-02

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
- incidente de suboperador que possa afetar dados tratados pelo Gestify.

## Primeiros passos

1. Registrar data/hora da detecção e da ciência.
2. Identificar quem reportou e qual ambiente foi afetado.
3. Preservar logs e evidências; não apagar rastros.
4. Conter o vetor sem destruir evidências.
5. Identificar tenants, sistemas, tabelas, buckets, APIs e suboperadores envolvidos.
6. Revogar ou rotacionar credenciais comprometidas quando necessário.
7. Impedir novas exposições antes de restaurar fluxo normal.

## Classificação mínima

Registrar:

- natureza do incidente;
- origem provável;
- período de exposição;
- categorias e volume aproximado de dados;
- existência de dados pessoais sensíveis;
- quantidade estimada de titulares;
- tenants afetados;
- medidas de segurança existentes, como criptografia ou pseudonimização;
- possibilidade de identificação, fraude, dano financeiro, discriminação, reputação ou outros impactos;
- probabilidade e gravidade do dano.

## Papéis

### Gestify como Operadora

Quando o dado afetado tiver sido inserido e tratado em nome de empresa cliente:

- informar o Controlador afetado sem demora indevida após reunir informação minimamente confiável;
- fornecer fatos conhecidos, escopo, medidas adotadas e atualizações relevantes;
- não comunicar titulares em nome do cliente sem instrução ou obrigação legal própria;
- cooperar tecnicamente para investigação, contenção e atendimento regulatório.

### Gestify como Controladora

Quando a NT Solution/Gestify definir as finalidades e meios do tratamento afetado:

- avaliar se o incidente pode acarretar risco ou dano relevante aos titulares;
- quando aplicável, preparar comunicação à ANPD e aos titulares dentro do prazo regulamentar vigente;
- atualmente, o fluxo operacional deve suportar comunicação em até 3 dias úteis contados do conhecimento de que o incidente afetou dados pessoais, ressalvadas regras específicas aplicáveis ao caso.

## Conteúdo mínimo da comunicação

Sempre que aplicável, reunir:

- descrição da natureza e categoria dos dados afetados;
- quantidade estimada de titulares e registros;
- medidas técnicas e de segurança utilizadas;
- riscos relacionados ao incidente;
- medidas adotadas ou planejadas para reverter ou mitigar efeitos;
- justificativa quando alguma informação ainda não estiver disponível;
- canal de contato do encarregado ou responsável.

## Evidências

Manter, conforme aplicável:

- logs de autenticação e autorização;
- logs de banco e aplicação;
- registros de deploy e alterações;
- eventos de firewall/CDN/provedor;
- IDs de incidentes de fornecedores;
- cópias de notificações enviadas;
- cronologia das decisões;
- responsáveis pelas ações;
- análise de causa raiz;
- plano de prevenção de recorrência.

## Encerramento

Um incidente só deve ser encerrado após:

- contenção confirmada;
- risco residual avaliado;
- comunicações obrigatórias concluídas ou decisão documentada de não comunicar;
- causa raiz registrada;
- correções preventivas atribuídas;
- evidências preservadas;
- revisão pós-incidente realizada.

## Restrições

- Não testar correções destrutivas em produção.
- Não usar dados reais sensíveis para reproduções desnecessárias.
- Não comunicar publicamente antes de validar fatos mínimos.
- Não prometer ausência de impacto antes de concluir investigação.
- Não apagar logs ou registros de aceite/incidente para reduzir exposição jurídica.
