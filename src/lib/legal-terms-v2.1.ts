import type { LegalDocument } from "@/lib/legal-content";
import {
  CURRENT_TERMS_DOCUMENT_TITLE,
  CURRENT_TERMS_DOCUMENT_VERSION,
  CURRENT_TERMS_UPDATED_AT,
} from "@/lib/auth/terms-config";

export const termsOfUseDocumentV21: LegalDocument = {
  slug: "/termos-de-uso",
  title: CURRENT_TERMS_DOCUMENT_TITLE,
  updatedAt: CURRENT_TERMS_UPDATED_AT,
  description: "Termos do Serviço Gestify v2.1: contratação SaaS, uso, dados, conteúdo, comunicações, segurança, suporte, encerramento e responsabilidades.",
  intro: [
    `Este ${CURRENT_TERMS_DOCUMENT_TITLE} regula a contratação e o uso do Gestify em modelo SaaS. Versão vigente: ${CURRENT_TERMS_DOCUMENT_VERSION}. Data: ${CURRENT_TERMS_UPDATED_AT}.`,
    "A contratação pode ocorrer por pessoa física ou jurídica. Condições comerciais específicas, proposta, pedido ou aditivo prevalecem apenas nos pontos em que expressamente complementarem estes Termos.",
    "A Política de Privacidade, a Política de Cookies e, quando aplicável, o DPA e o Anexo de Suboperadores complementam estes Termos.",
  ],
  sections: [
    { id: "partes", heading: "1. Partes e serviço", paragraphs: [
      "CONTRATADA: NT Solution, CNPJ 12.676.960/0001-55, responsável pela disponibilização e comercialização do Gestify.",
      "CONTRATANTE: pessoa física ou jurídica que contrata ou utiliza o Gestify, diretamente ou por representante autorizado.",
      "O Gestify é uma plataforma SaaS de gestão com estrutura multiempresa/multiestabelecimento. O ambiente do cliente é segregado logicamente por estabelecimento/tenant e utiliza usuários, papéis e permissões. Os módulos, limites e recursos disponíveis dependem do plano ou condição comercial contratada.",
    ]},
    { id: "escopo", heading: "2. Características específicas do Gestify", paragraphs: ["Conforme o plano contratado, o serviço poderá compreender módulos como Estoque, Engenharia/fichas técnicas e outros módulos disponibilizados comercialmente."], list: [
      "quantidade de estabelecimentos/tenants;",
      "quantidade de usuários e respectivas permissões;",
      "limites de produtos, fichas técnicas, armazenamento e demais recursos;",
      "integrações e funcionalidades adicionais;",
      "atualizações, manutenção, suporte, backups e mecanismos de exportação conforme disponibilidade técnica e condições contratadas."
    ], afterListParagraphs: ["A proposta, pedido ou anexo comercial deve identificar plano, módulos, limites, preço, ciclo de cobrança e condições adicionais aplicáveis ao CONTRATANTE."]},
    { id: "licenca", heading: "3. Licença e propriedade intelectual", paragraphs: [
      "A CONTRATADA concede licença limitada, não exclusiva, intransferível e não sublicenciável de acesso ao Gestify durante a vigência da contratação, sem transferência do código-fonte ou da titularidade do produto.",
      "Sugestões, solicitações, adaptações, melhorias e funcionalidades desenvolvidas pela CONTRATADA, ainda que originadas de solicitação ou financiamento de cliente, poderão integrar o Gestify e ser disponibilizadas a outros clientes, sem exclusividade para o solicitante, salvo instrumento escrito que disponha expressamente em sentido diverso.",
      "Essa regra não autoriza a CONTRATADA a reutilizar marca, segredo de negócio, dados pessoais, conteúdo confidencial ou propriedade intelectual do CONTRATANTE sem fundamento ou autorização aplicável."
    ]},
    { id: "uso", heading: "4. Uso permitido e deveres do cliente", list: [
      "manter usuários, credenciais e permissões sob controle adequado;",
      "fornecer informações corretas e manter os dados cadastrais atualizados;",
      "não praticar engenharia reversa, exploração abusiva, invasão, fraude ou uso ilícito;",
      "respeitar limites contratados e direitos de terceiros;",
      "adotar medidas razoáveis de segurança sobre dispositivos, contas e pessoas sob sua gestão."
    ]},
    { id: "conteudo-cliente", heading: "5. Conteúdo do Cliente, uploads e direitos de terceiros", paragraphs: [
      "Quando funcionalidades de upload, importação, anexos ou integrações permitirem o envio de planilhas, documentos, fotografias, vídeos, imagens, marcas, textos, bancos de dados ou outros materiais, o CONTRATANTE permanece responsável pelo conteúdo que inserir ou autorizar seus usuários a inserir no Gestify.",
      "O CONTRATANTE declara possuir os direitos, licenças, autorizações ou outra base jurídica necessária para utilizar e tratar o conteúdo enviado, inclusive quando envolver direitos autorais, imagem, voz, marca, segredo de negócio, confidencialidade, dados pessoais ou outros direitos de terceiros.",
      "É vedado utilizar o Gestify para armazenar, publicar, transmitir ou processar conscientemente conteúdo ilícito, fraudulento, abusivo ou que viole direitos de terceiros.",
      "O CONTRATANTE concede à CONTRATADA somente a licença técnica limitada e não exclusiva necessária para hospedar, copiar tecnicamente, processar, transmitir, converter, gerar backups e exibir o conteúdo na medida indispensável à prestação, segurança, suporte e continuidade do serviço. Essa licença não transfere a titularidade do conteúdo à CONTRATADA.",
      "A CONTRATADA poderá manter procedimento para recebimento de denúncias ou notificações sobre conteúdo potencialmente ilícito ou violador de direitos. A existência de denúncia não implica remoção automática: a CONTRATADA poderá analisar a solicitação, pedir elementos adicionais, preservar evidências e bloquear, restringir ou remover conteúdo quando houver fundamento jurídico, ordem válida, risco relevante ou violação destes Termos, observada a legislação aplicável.",
      "Quando juridicamente permitido e razoável, o CONTRATANTE será informado sobre medida de restrição ou remoção que afete seu conteúdo e poderá apresentar esclarecimentos pelos canais oficiais."
    ]},
    { id: "dados", heading: "6. Proteção de dados — Controlador e Operador", paragraphs: [
      "Os papéis de proteção de dados variam conforme o tratamento. A Gestify tende a atuar como Controladora quando define finalidades e meios para cadastro e administração de contas, segurança, prevenção de abuso/fraude, suporte, relacionamento, cobrança própria e cumprimento de suas obrigações.",
      "Quando o CONTRATANTE insere ou trata dados pessoais de funcionários, fornecedores, clientes ou outras pessoas para executar sua própria operação e determina as finalidades desse tratamento, o CONTRATANTE normalmente atua como Controlador e a Gestify como Operadora, observadas as instruções documentadas e a legislação aplicável.",
      "Quando aplicável, o DPA disciplina instruções, suboperadores, direitos dos titulares, incidentes, transferências, retenção, exportação e eliminação."
    ]},
    { id: "analytics", heading: "7. Analytics, pixels, publicidade, cookies e tecnologias de terceiros", paragraphs: [
      "A mera utilização de fornecedor de analytics, publicidade ou mensuração não será descrita como venda de dados pessoais sem que a natureza jurídica e o fluxo real de tratamento sustentem essa qualificação. A Gestify, porém, deverá informar de forma transparente os tratamentos e compartilhamentos efetivamente realizados.",
      "Antes de ativar Google Analytics, Meta Pixel, Google Ads, Microsoft Clarity ou tecnologia equivalente que trate dados pessoais, identificadores, cookies ou eventos de navegação para analytics, publicidade, atribuição, perfilamento ou mensuração, a Gestify deverá avaliar e documentar o fluxo aplicável e atualizar, quando necessário, seu inventário de tratamento, Política de Privacidade, Política de Cookies e registro de fornecedores/suboperadores.",
      "A documentação aplicável deverá identificar, conforme o caso, fornecedor, finalidade, categorias de dados ou identificadores, compartilhamentos, retenção, eventual transferência internacional e fundamento jurídico pertinente.",
      "Cookies e tecnologias não estritamente necessários, especialmente os destinados a publicidade ou marketing, deverão respeitar as escolhas e controles aplicáveis ao usuário. Quando a legislação ou o fundamento adotado exigir consentimento, a tecnologia correspondente não deverá ser ativada antes da manifestação válida do usuário e deverá existir mecanismo acessível de gerenciamento ou revogação."
    ]},
    { id: "suboperadores", heading: "8. Fornecedores, suboperadores e transferências", paragraphs: [
      "A CONTRATADA poderá utilizar fornecedores de infraestrutura, banco de dados, hospedagem, comunicação, analytics, monitoramento e outros serviços apenas na medida necessária às respectivas finalidades. A participação de um fornecedor na arquitetura não significa que ele receba todas as categorias de dados.",
      "Transferências internacionais de dados, quando existentes, deverão observar mecanismo juridicamente aplicável e as informações pertinentes serão mantidas na documentação de privacidade/suboperadores. Não se presume país, cláusula-padrão ou outro mecanismo sem evidência correspondente."
    ]},
    { id: "marketing", heading: "9. Comunicações comerciais e e-mail marketing", paragraphs: [
      "A Gestify poderá enviar comunicações técnicas, transacionais, de segurança, contratuais e de suporte necessárias à prestação do serviço. Comunicações comerciais ou promocionais serão tratadas separadamente quando a legislação ou o contexto assim exigir.",
      "Se a Gestify implementar e-mail marketing ou funcionalidade de campanhas, as mensagens comerciais deverão identificar adequadamente o remetente e sua natureza, utilizar conteúdo e assunto compatíveis com a mensagem, observar fundamento jurídico aplicável e disponibilizar mecanismo simples e funcional de oposição ou descadastramento quando cabível.",
      "A preferência de descadastramento deverá ser registrada e respeitada para comunicações promocionais abrangidas pelo pedido, sem impedir mensagens estritamente necessárias à segurança, execução do contrato ou cumprimento de obrigação legal.",
      "Campanhas destinadas a pessoas em outras jurisdições deverão observar os requisitos obrigatórios aplicáveis ao público e território alcançados, inclusive requisitos adicionais de identificação, endereço, consentimento ou opt-out quando exigidos pela legislação correspondente."
    ]},
    { id: "pagamentos", heading: "10. Planos, checkout, cobrança e pagamentos", paragraphs: [
      "Antes da conclusão de contratação eletrônica, o fluxo comercial aplicável deverá apresentar de forma clara, conforme pertinente: identificação do plano; módulos e limites; preço total e tributos destacados quando exigíveis; periodicidade; forma de pagamento; existência ou não de renovação automática; data ou critério da próxima cobrança; período gratuito ou promocional, se houver; condições para seu término; política de cancelamento; e regra que determina quando o acesso ao serviço termina após cancelamento, inadimplência ou encerramento.",
      "O CONTRATANTE deverá poder revisar informações essenciais e corrigir erros antes da confirmação final. Após a contratação, deverá receber ou poder acessar confirmação e versão conservável/reproduzível das condições aplicáveis.",
      "Enquanto não houver processador de pagamento tecnicamente definido e documentado, estes Termos não identificam gateway específico nem afirmam quais dados de cartão o Gestify recebe ou armazena. O fluxo publicado deverá refletir a implementação real antes de cobrança eletrônica por cartão.",
      "Alterações de preço para ciclos futuros serão comunicadas conforme contrato, oferta e legislação aplicável."
    ]},
    { id: "consumerista", heading: "11. Renovação, cancelamento, reembolso e consumidor", paragraphs: [
      "Quando a relação estiver sujeita ao Código de Defesa do Consumidor, prevalecem as normas consumeristas obrigatórias. Nas hipóteses legalmente aplicáveis de contratação fora do estabelecimento comercial, será respeitado o direito de arrependimento previsto em lei.",
      "Quando houver renovação automática, essa característica deverá ser informada antes da contratação juntamente com a periodicidade e o critério ou data da próxima cobrança. A Gestify não deverá ocultar renovação automática em texto secundário incompatível com a relevância econômica da informação.",
      "O CONTRATANTE deverá dispor de caminho simples e identificável para solicitar cancelamento pelos meios disponibilizados para sua modalidade de contratação, sem prejuízo de canal obrigatório previsto em lei.",
      "Ao concluir um cancelamento, o Gestify ou o canal responsável deverá informar confirmação e, sempre que tecnicamente aplicável, a data exata até a qual o acesso permanecerá disponível. O prazo de acesso não será presumido por estes Termos: seguirá o ciclo já pago, a oferta, o contrato específico, eventual período de tolerância e as normas obrigatórias aplicáveis.",
      "Cancelamento, estorno e reembolso observarão a oferta, o ciclo contratado, a legislação obrigatória e eventual condição comercial específica; nenhuma disposição destes Termos exclui direito que não possa ser afastado por contrato."
    ]},
    { id: "sla", heading: "12. Disponibilidade, manutenção e suporte", paragraphs: [
      "A CONTRATADA buscará manter o serviço disponível e seguro, mas não publica nesta versão percentual mínimo de disponibilidade sem baseline operacional medido e aprovado.",
      "SLA numérico, tempos de resposta, créditos de serviço e exclusões somente serão vinculantes quando previstos em plano, proposta, anexo ou SLA vigente. O método deverá distinguir indisponibilidade atribuível ao serviço de manutenção programada, evento fora do controle razoável, falha causada pelo cliente e indisponibilidade de terceiro quando juridicamente cabível."
    ]},
    { id: "seguranca", heading: "13. Segurança e incidentes", paragraphs: [
      "A CONTRATADA mantém medidas técnicas e administrativas proporcionais ao serviço. Nenhum sistema é absolutamente invulnerável.",
      "Em incidente de segurança, as partes cooperarão conforme seus papéis legais. A responsabilidade será analisada segundo causa, contribuição, obrigações contratuais e regime jurídico aplicável. A CONTRATADA não transfere automaticamente ao titular a obrigação de buscar reparação diretamente de fornecedor ou suboperador.",
      "Quando a Gestify atuar como Operadora, comunicará o Controlador sem demora indevida conforme DPA e informações disponíveis. Quando atuar como Controladora, realizará a avaliação e as comunicações regulatórias exigíveis dentro dos prazos legais aplicáveis."
    ]},
    { id: "retencao", heading: "14. Retenção, exclusão e exportação", paragraphs: [
      "Cancelamento ou pedido de eliminação não implica destruição indiscriminada de todos os registros. A CONTRATADA revogará acessos/sessões conforme o encerramento e eliminará ou anonimizará dados que não possuam finalidade ou fundamento residual, respeitado o ciclo técnico.",
      "Categorias sujeitas a obrigação legal, regulatória, auditoria, segurança ou exercício regular de direitos poderão ser preservadas apenas pelo prazo e finalidade compatíveis, com acesso restrito e sem continuidade do uso operacional incompatível.",
      "Dados operacionais do cliente seguirão o processo de offboarding, incluindo janela de exportação quando aplicável, retenção técnica limitada, tratamento de backups e eliminação/anonimização posterior conforme capacidade técnica, contrato e lei."
    ]},
    { id: "responsabilidade", heading: "15. Responsabilidade", paragraphs: [
      "Nenhuma cláusula destes Termos exclui responsabilidade que não possa ser legalmente afastada. A responsabilidade deverá considerar nexo causal, conduta das partes, obrigações assumidas e regime jurídico aplicável.",
      "O CONTRATANTE responde, na medida de sua contribuição, por atos de seus usuários, credenciais compartilhadas, configurações sob sua responsabilidade, conteúdo inserido e uso contrário à lei ou a estes Termos.",
      "Limitações específicas de indenização, exclusão de danos indiretos ou teto contratual somente se aplicam quando juridicamente válidas e expressamente previstas na contratação aplicável, sem prejuízo das normas obrigatórias de proteção do consumidor e de dados pessoais."
    ]},
    { id: "descontinuidade", heading: "16. Descontinuidade, insolvência ou encerramento", paragraphs: [
      "Se houver descontinuidade do Gestify, a CONTRATADA adotará, na medida jurídica e materialmente possível, comunicação aos clientes, interrupção de novas cobranças afetadas, tratamento de valores antecipados, janela razoável de exportação, encerramento de acessos e sessões e aplicação das regras de retenção e eliminação.",
      "Não há promessa de continuidade por prazo fixo em cenário de insolvência ou impossibilidade material. Backups e dados residuais serão tratados conforme ciclo técnico, segurança e fundamentos legais aplicáveis."
    ]},
    { id: "release-gate", heading: "17. Governança de novas tecnologias e tratamentos", paragraphs: [
      "A ativação de nova tecnologia que altere materialmente o tratamento de dados, publicidade, rastreamento, pagamentos, uploads, comunicações de marketing ou categorias de conteúdo deverá ser precedida de avaliação técnica e de privacidade/compliance proporcional ao risco.",
      "Quando a mudança afetar informações fornecidas ao usuário, a Gestify deverá atualizar os documentos, avisos, controles de preferência ou fluxo de contratação pertinentes antes ou no momento exigido pela legislação aplicável."
    ]},
    { id: "vigencia", heading: "18. Vigência, alterações e aceite", paragraphs: [
      "Estes Termos vigoram a partir da data indicada na versão. Alterações materiais poderão exigir novo aceite eletrônico. O sistema poderá registrar versão, usuário, data/hora, contexto de aceite e evidências técnicas necessárias à comprovação da contratação.",
      "A versão publicada na página oficial é a referência pública, sem prejuízo de condições específicas validamente celebradas com determinado cliente."
    ]},
    { id: "contato", heading: "19. Contato e foro", paragraphs: [
      "Dúvidas contratuais ou de privacidade podem ser encaminhadas aos canais oficiais informados no site Gestify.",
      "Eventual eleição de foro contratual será interpretada sem afastar competência obrigatória prevista na legislação aplicável, inclusive normas de proteção do consumidor quando incidentes."
    ]}
  ]
};
