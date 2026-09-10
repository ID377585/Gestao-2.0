# Gestify — Requisitos do Contrato SaaS v2.1

Status: especificação jurídica/técnica para revisão humana antes de publicação.

O contrato final não deve ser um modelo SaaS genérico. Cada promessa deve corresponder a uma capacidade, plano, limite ou processo comprovável do Gestify.

## 1. Objeto e produto

Descrever Gestify como plataforma SaaS multiempresa/multiestabelecimento, com isolamento lógico por tenant, usuários e permissões, módulos e limites definidos pelo plano/entitlement. O quadro comercial deve registrar versão, módulos habilitados, estabelecimentos, usuários, produtos/fichas técnicas e demais limites efetivamente contratados.

## 2. Ordem de contratação / quadro-resumo

Antes do aceite, apresentar de forma conservável e destacada:

- fornecedor contratante e contato;
- plano e módulos;
- preço total e periodicidade;
- existência de recorrência e data/ciclo de cobrança;
- limites relevantes;
- prazo, renovação e cancelamento;
- suporte/SLA contratado, se houver;
- cláusulas limitativas relevantes;
- link/versão de Termos, Privacidade e DPA aplicáveis.

Registrar evidência do aceite com versão, data/hora, usuário, estabelecimento/empresa, origem técnica e autoridade do aceitante quando aplicável.

## 3. Consumidor e contratação eletrônica

Quando a relação estiver sujeita ao CDC, o fluxo e contrato devem preservar direitos obrigatórios, inclusive informação clara, correção de erro antes da contratação, confirmação do aceite, disponibilização de cópia conservável e direito de arrependimento nas hipóteses legais. Não utilizar cláusula de renúncia genérica ao CDC nem presumir que todo CNPJ está fora de sua incidência.

## 4. Cobrança, cancelamento e reembolso

O contrato e checkout devem definir, de forma coerente com a implementação:

- início da cobrança e periodicidade;
- meio/processador somente após comprovação técnica;
- alteração de preço/plano com aviso e efeitos prospectivos;
- cancelamento e momento de perda de acesso;
- tratamento de período já pago;
- arrependimento/reembolso obrigatório quando aplicável;
- cobrança duplicada/incorreta;
- inadimplência, suspensão e reativação;
- exportação/offboarding após término.

## 5. SLA

Não prometer percentual sem medição. Quando aprovado, o SLA deve definir:

- disponibilidade mensal e fórmula de cálculo;
- fonte de medição;
- manutenção programada;
- eventos excluídos de forma razoável;
- indisponibilidade causada pelo cliente ou integração sob seu controle;
- dependências de terceiros sem excluir responsabilidade legal inderrogável;
- severidades e tempos de resposta de suporte;
- remédio/crédito de serviço quando adotado;
- procedimento e prazo de reclamação;
- eventual limite de responsabilidade juridicamente válido.

RPO/RTO só entram no contrato se houver evidência operacional compatível.

## 6. Segurança e incidente

Criar matriz causal:

- falha imputável ao Gestify;
- falha de suboperador/fornecedor;
- falha imputável ao cliente (credencial compartilhada, configuração indevida, exportação/uso não autorizado etc.);
- culpa/contribuição concorrente.

A alocação contratual não substitui responsabilidade obrigatória prevista em lei. Prever cooperação, preservação de evidências, comunicação e direito de regresso quando juridicamente cabível.

## 7. Dados e LGPD

Incorporar DPA por referência quando aplicável. Distinguir Gestify Controlador de tratamentos próprios e Gestify Operador dos dados inseridos pelo cliente. Prever instruções, suboperadores, direitos, exportação, retenção, exclusão e transferências internacionais conforme documentos vigentes.

## 8. Customizações e feedback

Regra padrão recomendada: funcionalidades, adaptações e melhorias desenvolvidas pelo Gestify, ainda que sugeridas ou financiadas por cliente, integram a evolução do produto e permanecem de titularidade da empresa exploradora do Gestify, podendo ser disponibilizadas a outros clientes ou planos, salvo instrumento escrito em contrário.

Essa regra não autoriza incorporar ao produto global segredo, conteúdo, marca, dado ou propriedade intelectual do cliente sem base/autorização apropriada.

## 9. Propriedade intelectual

O contrato com cliente deve afirmar apenas titularidade que possa ser comprovada pela cadeia documental. O Data Room deve sustentar contribuições de fundador, sócios, empregados, freelancers, designers, agências e consultores, além do inventário de componentes Open Source e respectivas licenças.

## 10. Limitação de responsabilidade

Não usar exoneração absoluta. A redação deve distinguir B2B/B2C e preservar responsabilidade que não possa ser limitada por lei. Limites, exclusões de danos indiretos e caps devem ser revisados para razoabilidade, causalidade, culpa, natureza da relação e normas cogentes.

## 11. Descontinuidade / insolvência

Prever, na medida técnica e juridicamente possível:

- aviso de descontinuidade;
- interrupção de novas cobranças;
- tratamento de valores antecipados;
- janela de exportação;
- revogação de acessos;
- retenção residual legal;
- ciclo de backups;
- eliminação/anonymização posterior.

Não garantir continuidade por prazo que a empresa não consiga assegurar em insolvência.

## 12. Critério de publicação

O contrato v2.1 somente pode ser marcado como pronto quando checkout, billing, entitlements, suporte, SLA, DPA, Política de Privacidade e offboarding não contradisserem suas cláusulas. Revisão jurídica brasileira final é obrigatória antes de classificá-lo como versão definitiva.