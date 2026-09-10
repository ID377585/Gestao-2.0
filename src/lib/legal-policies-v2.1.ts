import type { LegalDocument } from "@/lib/legal-content";

const UPDATED_AT = "10/09/2026";

export const privacyPolicyDocumentV21: LegalDocument = {
  slug: "/politica-de-privacidade",
  title: "Política de Privacidade",
  updatedAt: UPDATED_AT,
  description: "Política de Privacidade Gestify v2.1: dados pessoais, terceiros, analytics, marketing, comunicações e direitos dos titulares.",
  intro: [
    "A Gestify trata dados pessoais com transparência, necessidade, segurança e respeito à legislação aplicável. Esta Política descreve tratamentos relacionados ao site, plataforma, contratação, suporte, segurança, analytics, marketing e fornecedores.",
    "A ativação futura de nova tecnologia que altere materialmente o tratamento de dados deverá passar por avaliação de privacidade e atualização da documentação aplicável antes de sua utilização em produção."
  ],
  institutionalData: [
    { label: "Controladora", value: "NT Solution" },
    { label: "Nome fantasia", value: "Gestify" },
    { label: "CNPJ", value: "12.676.960/0001-55" },
    { label: "Endereço", value: "AV. Anacé, 337 - AP 2505 - JD. Umarizal - São Paulo - SP - Brasil" },
    { label: "Privacidade", value: "atendimento@ntsolution.com.br" },
    { label: "Encarregado/DPO", value: "Ivan da Silva Fernandes Escobar" }
  ],
  sections: [
    { id: "papeis", heading: "1. Papéis e abrangência", paragraphs: [
      "A Gestify atua como Controladora quando define finalidades e meios para conta, segurança, relacionamento, contratação, cobrança própria, suporte, site e comunicações próprias. Quando processa dados operacionais inseridos pelo cliente segundo finalidades determinadas por ele, normalmente atua como Operadora, observados contrato, DPA e legislação aplicável."
    ]},
    { id: "categorias", heading: "2. Categorias de dados", list: [
      "identificação, contato, empresa, cargo e dados cadastrais;",
      "IP, dispositivo, navegador, sessão, autenticação, logs e eventos de segurança;",
      "uso, navegação, preferências, origem de tráfego e interações;",
      "dados necessários à contratação, cobrança, suporte e relacionamento;",
      "dados e conteúdos inseridos pelo cliente conforme as funcionalidades contratadas;",
      "cookies, identificadores online e sinais de mensuração, quando aplicáveis."
    ]},
    { id: "finalidades-bases", heading: "3. Finalidades e bases legais", paragraphs: [
      "Os dados poderão ser tratados para executar contrato e procedimentos preliminares, cumprir obrigações legais ou regulatórias, exercer direitos, proteger segurança e prevenir fraude, atender interesses legítimos após avaliação cabível e obter consentimento quando essa for a base adequada. A Gestify não tratará todo dado com base em consentimento indistintamente."
    ], list: [
      "autenticação, administração de contas e prestação do serviço;",
      "suporte, segurança, auditoria e prevenção de abuso;",
      "contratação, cobrança e relacionamento;",
      "medição de desempenho e melhoria do produto;",
      "comunicações operacionais, institucionais e comerciais quando juridicamente permitidas."
    ]},
    { id: "analytics-publicidade", heading: "4. Analytics, pixels, publicidade e tecnologias de terceiros", paragraphs: [
      "A simples utilização de fornecedor de analytics ou publicidade não será descrita pela Gestify como venda automática de dados. Quando houver compartilhamento ou tratamento por terceiro, a Gestify deverá descrevê-lo de forma compatível com o fluxo real e com a legislação aplicável.",
      "Antes de ativar em produção Google Analytics, Meta Pixel, Google Ads, Microsoft Clarity ou tecnologia equivalente que introduza tratamento relevante, a Gestify deverá atualizar seu inventário de tratamento e avaliar fornecedor, finalidade, categorias de dados, cookies ou identificadores, compartilhamento, retenção, fundamento jurídico e eventual transferência internacional.",
      "Tecnologias opcionais de publicidade, perfilamento ou marketing não deverão ser ativadas antes da escolha do usuário quando consentimento prévio for exigido. A interface deverá oferecer mecanismo compatível para aceitar, recusar e, quando aplicável, alterar ou revogar preferências."
    ]},
    { id: "terceiros-transferencias", heading: "5. Fornecedores, compartilhamento e transferências", paragraphs: [
      "A Gestify poderá utilizar fornecedores de infraestrutura, hospedagem, banco de dados, autenticação, comunicação, segurança, suporte, analytics e pagamento conforme a implementação real. A presença de um fornecedor na arquitetura não significa que ele receba todas as categorias de dados.",
      "Transferências internacionais, quando existentes, deverão possuir fundamento e mecanismo aplicáveis e ser refletidas na documentação de privacidade e suboperadores."
    ]},
    { id: "marketing", heading: "6. Comunicações comerciais e e-mail marketing", paragraphs: [
      "Se a Gestify realizar e-mail marketing ou comunicação comercial, deverá identificar adequadamente o remetente e a natureza da mensagem, utilizar assunto não enganoso, observar finalidade e base jurídica aplicáveis e disponibilizar mecanismo simples e funcional de oposição ou descadastro quando cabível.",
      "Preferências de marketing e pedidos de descadastro deverão ser registrados e respeitados em prazo operacional razoável, sem impedir comunicações estritamente necessárias à segurança, execução do contrato ou serviço solicitado.",
      "Campanhas dirigidas a pessoas em outras jurisdições deverão ser avaliadas também segundo as normas aplicáveis ao público e território alcançados, inclusive requisitos adicionais de identificação, endereço ou opt-out quando exigidos."
    ]},
    { id: "retencao-seguranca", heading: "7. Retenção e segurança", paragraphs: [
      "Os dados serão mantidos pelo período necessário à finalidade e aos fundamentos legais aplicáveis. Encerrada a necessidade, serão eliminados ou anonimizados quando cabível, ressalvadas retenções legalmente justificadas e ciclos técnicos de backup.",
      "A Gestify adota medidas técnicas e administrativas proporcionais ao risco, incluindo controles de acesso, autenticação, segregação lógica, logs, monitoramento, backups e gestão de incidentes conforme aplicável."
    ]},
    { id: "direitos", heading: "8. Direitos e preferências", paragraphs: [
      "O titular poderá exercer os direitos previstos na legislação aplicável, incluindo confirmação, acesso, correção, oposição quando cabível, informação sobre compartilhamentos, revogação de consentimento quando aplicável e demais direitos legalmente previstos.",
      "Solicitações de privacidade podem ser encaminhadas a atendimento@ntsolution.com.br. A Gestify poderá confirmar identidade e legitimidade antes de atender solicitações que envolvam dados pessoais."
    ]},
    { id: "atualizacoes", heading: "9. Atualizações e governança", paragraphs: [
      "Mudanças materiais de fornecedores, finalidade, publicidade comportamental, categorias de dados ou transferências deverão ser avaliadas antes da entrada em produção e refletidas na documentação aplicável. Alterações materiais serão versionadas e comunicadas quando necessário."
    ]}
  ]
};

export const cookiePolicyDocumentV21: LegalDocument = {
  slug: "/politica-de-cookies",
  title: "Política de Cookies",
  updatedAt: UPDATED_AT,
  description: "Política de Cookies Gestify v2.1: categorias, terceiros, analytics, publicidade e controle de preferências.",
  intro: ["Esta Política explica como a Gestify utiliza cookies, pixels, SDKs, armazenamento local e tecnologias semelhantes no site e na plataforma."],
  sections: [
    { id: "categorias", heading: "1. Categorias", list: [
      "estritamente necessários: autenticação, segurança, sessão e funcionamento essencial;",
      "funcionais: preferências e facilidades de navegação;",
      "analíticos: mensuração de desempenho, navegação e falhas;",
      "marketing/publicidade: mensuração de campanhas, atribuição, perfilamento ou publicidade, quando aplicável."
    ]},
    { id: "terceiros", heading: "2. Analytics, pixels e terceiros", paragraphs: [
      "Ferramentas como Google Analytics, Meta Pixel, Google Ads, Microsoft Clarity ou equivalentes somente serão descritas como utilizadas quando efetivamente integradas. Antes da ativação relevante, a Gestify deverá documentar fornecedor, finalidade, dados ou identificadores tratados, duração ou critérios de retenção, compartilhamento, eventual transferência internacional e fundamento jurídico aplicável.",
      "Cookies e tecnologias de terceiros podem permitir que o respectivo fornecedor trate identificadores e eventos segundo o papel jurídico e a configuração efetivamente adotados. A Gestify buscará aplicar minimização e configurações de privacidade compatíveis com a finalidade."
    ]},
    { id: "preferencias", heading: "3. Consentimento e preferências", paragraphs: [
      "Cookies estritamente necessários poderão operar sem escolha opcional quando indispensáveis ao serviço. Cookies não essenciais não deverão ser ativados antes da escolha do usuário quando a legislação exigir consentimento prévio.",
      "Quando aplicável, o usuário deverá poder aceitar, recusar e gerenciar categorias opcionais sem que a recusa de publicidade ou analytics opcional impeça o funcionamento essencial do serviço."
    ]},
    { id: "revogacao", heading: "4. Alteração e revogação", paragraphs: [
      "Quando houver centro ou banner de preferências, o usuário poderá revisar sua escolha e revogar consentimentos aplicáveis. Também poderá excluir ou bloquear cookies pelo navegador, observando que o bloqueio de tecnologias essenciais pode afetar funcionalidades necessárias."
    ]},
    { id: "release-gate", heading: "5. Regra para novas tecnologias", paragraphs: [
      "A inclusão de nova ferramenta de analytics, pixel, publicidade, rastreamento ou mensuração que altere materialmente o tratamento deverá passar por avaliação de privacidade e atualização desta Política e do inventário de tratamento antes da ativação em produção."
    ]},
    { id: "contato", heading: "6. Contato", paragraphs: ["Dúvidas ou solicitações: atendimento@ntsolution.com.br."] }
  ]
};
