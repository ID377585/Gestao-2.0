# LGPD Operational Evidence Closure

Status: **proposed**  
Priority: **P2 — compliance / commercial readiness**  
Owner: Kratelis / Gestify

## Contexto e evidência

A fundação técnica de compliance já existe no Gestify: Termos v2.1 e reaceite obrigatório, Privacy Center, DPA/políticas, ledger de aceite, fluxo de solicitações de titulares, registro de subprocessadores, incidentes, offboarding/exportação e política inicial de retenção. A lacuna restante é transformar controles documentados e implementados em evidência operacional verificável antes da comercialização ampla.

## Problema

Código e documentação não provam, isoladamente, que um pedido LGPD completo foi executado dentro do prazo, que retenção/exclusão foi validada ponta a ponta, que todos os subprocessadores reais possuem evidência contratual atualizada ou que biometria possui avaliação jurídica e de risco suficiente para ativação comercial ampla.

## Comportamento esperado

O Gestify deve manter uma trilha auditável que permita demonstrar:

1. recebimento, validação de identidade, classificação, prazo, execução e encerramento de uma solicitação de titular (DSAR);
2. exportação, correção, anonimização ou eliminação conforme o tipo de solicitação e a base legal;
3. aplicação da matriz de retenção e exceções legais, sem exclusão destrutiva não autorizada;
4. inventário real de subprocessadores, finalidade, localização, mecanismo de transferência, DPA/contrato e estado de revisão;
5. procedimento de incidente e comunicação;
6. bloqueio comercial da biometria enquanto os requisitos jurídicos e operacionais não estiverem satisfeitos.

## Invariantes de segurança e tenant

- Nenhum operador pode acessar ou executar solicitação de outro `establishment_id`.
- Toda ação material deve registrar ator, tenant, horário, motivo e resultado.
- Exclusão destrutiva exige pedido formal, validação de autoridade, análise de obrigação de retenção e backup/rollback quando aplicável.
- Nenhum dump, documento pessoal, segredo ou evidência sensível deve ser versionado no GitHub.
- Evidências confidenciais devem permanecer em armazenamento privado controlado e ser referenciadas somente por identificador/caminho.
- Produção não deve receber DDL/DML para este fechamento sem aprovação humana específica.

## Plano de evidência DSAR

Executar primeiro em staging com dados sintéticos:

1. criar titular e tenant sintéticos;
2. abrir solicitação de acesso/exportação;
3. validar identidade e autoridade;
4. registrar `due_at` e responsável;
5. gerar/exportar os dados permitidos;
6. concluir a solicitação e registrar `completed_at`;
7. repetir para correção;
8. repetir para anonimização/eliminação, comprovando bloqueio quando houver retenção legal;
9. testar tentativa tenant A -> tenant B e exigir negação;
10. arquivar evidência não sensível do teste e referência para evidência privada.

Critério: nenhuma etapa pode depender de edição manual direta no banco.

## Retenção e exclusão

A política de retenção deve ser revisada juridicamente e convertida em matriz aprovada contendo, no mínimo: categoria de dado, finalidade, base legal, controlador/operador, prazo, evento inicial do prazo, exceção legal, destino após expiração, rotina responsável e evidência de execução.

Antes de automatizar exclusão em produção, validar em staging:

- seleção correta por tenant;
- preservação de dados sujeitos a obrigação legal;
- anonimização quando suficiente;
- remoção de Storage relacionado quando juridicamente permitida;
- auditoria do resultado;
- idempotência/reexecução segura;
- rollback/recuperação para falha operacional dentro da janela definida.

## Subprocessadores reais

O registro deve refletir os fornecedores efetivamente usados em produção. Para cada um, registrar e comprovar externamente:

- razão/nome do fornecedor e serviço;
- finalidade e categorias de dados;
- país/região de processamento;
- mecanismo de transferência internacional quando aplicável;
- URL/política de privacidade;
- DPA/contrato e data de revisão;
- contato de segurança/privacidade quando disponível;
- subprocessadores relevantes do próprio fornecedor;
- decisão de aprovação e próxima revisão.

Não marcar `approved` sem evidência contratual real.

## Biometria — gate comercial

Biometria/foto facial permanece **bloqueada para ativação comercial ampla** até existir evidência aprovada de:

- finalidade específica e necessidade/proporcionalidade;
- base legal brasileira definida por profissional jurídico/DPO responsável;
- transparência ao titular;
- consentimento quando juridicamente aplicável, sem presumir que consentimento seja sempre a base correta;
- alternativa funcional não biométrica;
- minimização e prazo de descarte;
- bucket privado e URLs assinadas curtas;
- controle e auditoria de acesso;
- processo de contestação/correção;
- resposta específica a incidente;
- avaliação documentada sobre necessidade de RIPD e, quando indicada, RIPD concluído e aprovado.

## Revisão jurídica brasileira

Antes de declarar compliance 100%, profissional jurídico/DPO responsável deve revisar ao menos:

- Termos e Política de Privacidade vigentes;
- DPA e papéis controlador/operador;
- bases legais por finalidade;
- transferências internacionais e subprocessadores;
- retenção e eliminação;
- direitos dos titulares e prazos operacionais;
- incidentes e comunicação;
- biometria e eventual RIPD;
- contratação B2B/B2C, quando aplicável.

A revisão deve produzir data, versão, responsável e pendências; não armazenar parecer confidencial integral no repositório público.

## Critérios de aceitação

- [ ] DSAR de acesso/exportação executado ponta a ponta em staging e evidenciado.
- [ ] DSAR de correção executado em staging.
- [ ] DSAR de eliminação/anonimização testado, inclusive exceção por retenção legal.
- [ ] Teste adversarial tenant A x tenant B aprovado.
- [ ] Matriz de retenção revisada e aprovada juridicamente.
- [ ] Rotina de retenção/exclusão validada em staging antes de qualquer produção.
- [ ] Registro de subprocessadores reconciliado com fornecedores reais e evidências externas.
- [ ] Runbook de incidente exercitado em tabletop.
- [ ] Biometria continua bloqueada comercialmente até fechamento do gate.
- [ ] Decisão formal sobre RIPD de biometria registrada.
- [ ] Revisão jurídica brasileira final registrada por versão/data/responsável.
- [ ] Nenhuma evidência sensível ou segredo foi commitado.

## Gates técnicos

Antes de considerar qualquer implementação associada pronta para revisão:

- `npm run lint`
- `npm run typecheck`
- `npm run audit`
- `npm run tenant:writes:ci`
- `npm run readiness:check`
- `npm run readiness:deployment`
- `npm run build`
- testes específicos de compliance/DSAR
- Security Advisor quando houver alteração de banco/RLS

## Rollout

1. documentação/spec;
2. testes sintéticos e evidência em staging;
3. revisão jurídica/operacional;
4. PR com evidências e rollback;
5. aprovação humana;
6. somente então avaliar promoção de mudanças necessárias para produção.

## Rollback

Este documento não altera runtime, banco ou produção. Mudanças futuras devem possuir rollback específico e preservar a continuidade da Santino.

## Definição de 100%

`LGPD / Compliance = 100%` significa que os controles definidos possuem evidência técnica e operacional atual, revisão jurídica registrada e gates sensíveis fechados. Não significa garantia absoluta de conformidade futura; o programa exige revisão periódica quando produto, fornecedores, legislação ou tratamento de dados mudarem.
