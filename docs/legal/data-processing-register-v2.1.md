# Gestify — Registro de Tratamentos e Retenção v2.1

Status: **controle interno para Due Diligence; não publicar como declaração jurídica final sem validação das evidências**.

## Papéis LGPD

O Gestify pode exercer papéis diferentes conforme a operação:

- **Controlador**: tratamentos próprios necessários à administração da conta Gestify, autenticação, segurança, prevenção de abuso/fraude, relação contratual, suporte, cobrança/faturamento quando implementados, cumprimento de obrigação legal/regulatória e exercício regular de direitos.
- **Operador**: tratamento de dados pessoais inseridos pelo cliente/estabelecimento para executar a operação desse cliente, conforme suas instruções e o DPA aplicável.

Não classificar todo dado hospedado no Gestify como tratamento controlado pelo fornecedor SaaS.

## Matriz mínima de tratamento

| Categoria | Finalidade | Hipótese/base a validar no caso concreto | Papel típico | Destinatários | Retenção/saída |
|---|---|---|---|---|---|
| Identificação e e-mail da conta | criar, autenticar e administrar conta; comunicações transacionais | execução contratual; segurança/legítimo interesse quando aplicável | Controlador | autenticação/infra comprovadas | durante relação + período residual justificável; revogar acesso no encerramento |
| Credenciais/sessões | autenticação e proteção da conta | execução contratual; segurança | Controlador | provedor de autenticação comprovado | sessões revogadas no encerramento; não preservar credenciais utilizáveis como evidência histórica |
| IP, data/hora e registros de acesso | segurança, auditoria e obrigações aplicáveis | obrigação legal quando aplicável; legítimo interesse/segurança conforme caso | Controlador | infraestrutura/logging comprovados | observar Marco Civil art. 15 quando aplicável; política deve documentar prazo e acesso restrito |
| Aceites legais | demonstrar versão aceita, autoridade, data e origem | execução contratual; exercício regular de direitos | Controlador | infraestrutura/banco | preservar pelo período necessário à defesa/exercício de direitos; acesso restrito |
| Suporte | atender solicitações e diagnosticar problemas | execução contratual; legítimo interesse conforme contexto | Controlador ou Operador conforme conteúdo | ferramentas de atendimento comprovadas | prazo proporcional à finalidade e defesa; eliminar/anonymizar quando cessar fundamento |
| Fiscal/financeiro | faturamento, contabilidade, tributos e prova de pagamentos | execução contratual e obrigação legal | Controlador | contador/fisco/processadores comprovados | conforme obrigação fiscal/contábil aplicável; não apagar por mero encerramento se houver dever de conservação |
| Pagamento | processar assinatura e conciliação | execução contratual | Controlador | **gateway ainda deve ser comprovado antes de nomear** | Gestify não deve declarar armazenamento de PAN/CVV sem auditoria do fluxo real; retenção conforme dado efetivamente recebido |
| Dados operacionais inseridos pelo cliente | executar funcionalidades contratadas | definida pelo cliente Controlador; Gestify segue DPA/instruções | Operador | suboperadores necessários e comprovados | contrato/DPA + política de offboarding; exportação e eliminação conforme instruções e exceções legais |
| Solicitações LGPD | receber, autenticar, processar e provar atendimento | obrigação legal/regulatória; exercício regular de direitos | Controlador | equipe/infra autorizada | manter evidência proporcional ao dever regulatório/defesa |
| Incidentes de segurança | investigação, contenção, comunicação e evidência | obrigação legal/regulatória; segurança; exercício regular de direitos | Controlador/Operador conforme evento | Controlador afetado, ANPD/titulares quando aplicável | registros de incidente por no mínimo 5 anos conforme regulamentação aplicável |
| Backups | continuidade, recuperação e DR | execução contratual; segurança/legítimo interesse conforme caso | acompanha papel do dado de origem | infraestrutura/backup comprovados | ciclo definido na matriz operacional; eliminação por expiração/rotação, sem reutilização para finalidade incompatível |

## Regra para pedidos de exclusão

Pedido de exclusão **não significa destruição indiscriminada e imediata de todo registro**. O fluxo deve:

1. autenticar o solicitante e identificar escopo/papel do Gestify;
2. encerrar ou restringir conta, sessões e acessos quando cabível;
3. eliminar ou anonimizar dados cuja finalidade/base tenha terminado;
4. separar dados cuja conservação permaneça necessária por obrigação legal/regulatória ou exercício regular de direitos;
5. restringir esses dados à finalidade residual, com controle de acesso e prazo documentado;
6. considerar cópias de backup conforme ciclo técnico, impedindo restauração para uso operacional incompatível;
7. registrar decisão, fundamento, prazo e execução para auditoria.

Não utilizar uma regra genérica de “cinco anos para todos os dados”. Cada categoria exige fundamento e prazo próprios.

## Fornecedores/suboperadores

Nenhum fornecedor deve aparecer na Política de Privacidade apenas por possibilidade. Para cada fornecedor efetivo, o Data Room deve conter, quando aplicável:

- razão social/serviço e função;
- categorias de dados acessadas;
- finalidade;
- local/país de processamento conhecido;
- DPA/termos de proteção de dados;
- medidas de segurança relevantes;
- mecanismo de transferência internacional quando houver;
- data da última revisão;
- processo para alteração material do suboperador.

## Evidências pendentes que bloqueiam declarações finais

- fornecedor/gateway de pagamento e fluxo real de dados de cartão;
- contratos/DPA e localização de tratamento de cada suboperador;
- política comercial final de cobrança, reembolso e cancelamento;
- métricas reais para compromisso de SLA;
- prazos fiscais/contábeis específicos validados para a entidade jurídica exploradora do Gestify.

Este registro deve ser reconciliado com código, banco, contratos e fornecedores antes da publicação da Política de Privacidade v2.1.