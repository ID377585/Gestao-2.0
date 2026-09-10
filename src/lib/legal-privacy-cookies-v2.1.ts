import type { LegalDocument } from "@/lib/legal-content";

const UPDATED_AT = "10/09/2026";

export const privacyPolicyDocumentV21: LegalDocument = {
  slug: "/politica-de-privacidade",
  title: "Política de Privacidade",
  updatedAt: UPDATED_AT,
  description: "Política de Privacidade Gestify v2.1, incluindo terceiros, analytics, publicidade, marketing e governança de novos tratamentos.",
  intro: [
    "A Gestify trata dados pessoais com transparência, necessidade, segurança e observância da legislação aplicável. Esta versão integra o pacote jurídico v2.1 e descreve tratamentos próprios e aqueles realizados em apoio aos clientes.",
    "A utilização de fornecedor de tecnologia não significa, por si só, venda de dados. A Gestify deverá descrever de forma fiel o fluxo efetivamente implementado, inclusive compartilhamentos, publicidade, analytics e transferências internacionais quando existentes."
  ],
  institutionalData: [
    { label: "Controladora", value: "NT Solution" },
    { label: "Nome fantasia", value: "Gestify" },
    { label: "CNPJ", value: "12.676.960/0001-55" },
    { label: "Endereço", value: "AV. Anacé, 337 - AP 2505 - JD. Umarizal - São Paulo - SP - Brasil" },
    { label: "E-mail para privacidade", value: "atendimento@ntsolution.com.br" },
    { label: "Encarregado/DPO", value: "Ivan da Silva Fernandes Escobar" },
    { label: "Telefone", value: "+55 11 98675-4605" }
  ],
  sections: [
    { id: "papeis", heading: "1. Papéis e abrangência", paragraphs: [
      "A Gestify atua como Controladora quando define finalidades e meios de tratamentos próprios, como cadastro e administração de contas, segurança, prevenção de fraude, suporte, relacionamento, cobrança e cumprimento de obrigações. Quando processa dados operacionais inseridos pelo cliente segundo finalidades determinadas por ele, tende a atuar como Operadora, observados contrato, DPA e contexto real."
    ]},
    { id: "categorias", heading: "2. Categorias de dados", list: [
      "dados cadastrais, identificação e contato;", "dados de conta, papéis, permissões e vínculos organizacionais;", "IP, dispositivo, navegador, logs, autenticação, sessão e eventos técnicos;", "dados operacionais inseridos pelo cliente;", "informações de suporte, relacionamento e contratação;", "cookies, identificadores e eventos de navegação quando as tecnologias correspondentes estiverem efetivamente habilitadas."
    ]},
    { id: "finalidades", heading: "3. Finalidades e bases jurídicas", paragraphs: [
      "Os dados poderão ser tratados para prestar e administrar o serviço, autenticar usuários, proteger contas e infraestrutura, atender solicitações, cumprir contratos e obrigações legais, exercer direitos, melhorar desempenho e, quando juridicamente permitido, realizar comunicações e mensuração. A base jurídica será definida conforme a finalidade e o contexto, podendo incluir execução de contrato, obrigação legal/regulatória, exercício regular de direitos, legítimo interesse ou consentimento quando aplicável."
    ]},
    { id: "terceiros", heading: "4. Fornecedores, analytics, pixels e publicidade", paragraphs: [
      "Antes de ativar Google Analytics, Meta Pixel, Google Ads, Microsoft Clarity ou ferramenta equivalente que trate dados pessoais, cookies, identificadores ou eventos para analytics, atribuição, perfilamento, publicidade ou mensuração, a Gestify deverá avaliar e registrar o fluxo efetivamente implementado.",
      "Quando aplicável, a documentação pública e interna deverá identificar fornecedor, finalidade, categorias de dados ou identificadores, forma de compartilhamento, retenção conhecida ou critério aplicável, eventual transferência internacional e fundamento jurídico pertinente.",
      "A Gestify não declarará genericamente que vende ou não vende dados quando a qualificação depender do fluxo concreto. A transparência deverá refletir a realidade técnica e contratual do tratamento."
    ]},
    { id: "cookies", heading: "5. Cookies e escolhas do usuário", paragraphs: [
      "Cookies estritamente necessários poderão ser utilizados para funcionamento, autenticação, segurança e recursos essenciais. Tecnologias não necessárias, especialmente publicidade e marketing, deverão respeitar as escolhas e o fundamento jurídico aplicáveis.",
      "Quando consentimento for exigido ou adotado como fundamento, a tecnologia correspondente não deverá ser disparada antes de manifestação válida e deverá existir mecanismo acessível para gerenciar ou revogar a escolha, sem prejuízo do funcionamento estritamente necessário do serviço."
    ]},
    { id: "marketing", heading: "6. Comunicações e marketing", paragraphs: [
      "Comunicações técnicas, de segurança, suporte, cobrança e execução contratual poderão ser necessárias ao serviço. Comunicações promocionais serão tratadas conforme fundamento e legislação aplicáveis.",
      "Quando houver e-mail marketing, a Gestify deverá identificar adequadamente o remetente e a natureza da mensagem, manter assunto compatível com o conteúdo, disponibilizar mecanismo simples de oposição ou descadastramento quando cabível e registrar a preferência para que ela seja respeitada em comunicações promocionais futuras.",
      "Requisitos adicionais de outras jurisdições serão observados quando uma campanha for destinada a pessoas ou mercados sujeitos a tais regras."
    ]},
    { id: "transferencias", heading: "7. Transferências internacionais", paragraphs: [
      "Quando dados forem transferidos internacionalmente, a Gestify deverá observar os requisitos da LGPD e da regulamentação aplicável, documentando o mecanismo pertinente em vez de presumir país, cláusula ou instrumento sem evidência."
    ]},
    { id: "retencao", heading: "8. Retenção, segurança e incidentes", paragraphs: [
      "Dados serão mantidos pelo tempo compatível com finalidade, contrato, segurança, obrigação legal/regulatória e exercício regular de direitos. Encerrada a necessidade e inexistindo fundamento residual, serão eliminados ou anonimizados conforme aplicável e segundo o ciclo técnico.",
      "A Gestify mantém medidas técnicas e administrativas proporcionais ao risco e procedimentos de resposta a incidentes."
    ]},
    { id: "direitos", heading: "9. Direitos dos titulares", paragraphs: [
      "Titulares poderão exercer os direitos previstos na legislação aplicável, incluindo confirmação, acesso, correção, informação sobre compartilhamentos, oposição quando cabível e revogação de consentimento quando essa for a base utilizada. Solicitações poderão ser encaminhadas para atendimento@ntsolution.com.br e poderão exigir verificação razoável de identidade."
    ]},
    { id: "release-gate", heading: "10. Governança de novos tratamentos", paragraphs: [
      "Nova tecnologia de rastreamento, publicidade, analytics, pagamentos, uploads, integração ou marketing que altere materialmente o tratamento de dados deverá passar por avaliação técnica e de privacidade/compliance antes da ativação em produção. Quando necessário, inventário, avisos, Política de Cookies, registro de fornecedores e mecanismos de preferência deverão ser atualizados antes ou no momento juridicamente exigido."
    ]},
    { id: "contato", heading: "11. Contato e atualização", paragraphs: [
      "Esta Política poderá ser atualizada para refletir mudanças legais, regulatórias, operacionais ou tecnológicas. Alterações materiais serão tratadas conforme o mecanismo de comunicação e reaceite aplicável. Contato de privacidade: atendimento@ntsolution.com.br."
    ]}
  ]
};

export const cookiePolicyDocumentV21: LegalDocument = {
  slug: "/politica-de-cookies",
  title: "Política de Cookies",
  updatedAt: UPDATED_AT,
  description: "Política de Cookies Gestify v2.1 com controles para analytics, publicidade e tecnologias de terceiros.",
  intro: [
    "Esta Política explica o uso de cookies e tecnologias semelhantes pela Gestify e integra o pacote jurídico v2.1.",
    "A lista e o comportamento das tecnologias devem refletir a implementação real. A simples previsão contratual não autoriza ativar rastreadores incompatíveis com as escolhas ou com o fundamento jurídico aplicável."
  ],
  sections: [
    { id: "conceito", heading: "1. O que são cookies e tecnologias semelhantes", paragraphs: ["Cookies e identificadores semelhantes podem armazenar ou acessar informações no dispositivo, manter sessões, registrar preferências, medir eventos e apoiar funcionalidades do site e da plataforma."]},
    { id: "categorias", heading: "2. Categorias", list: [
      "Estritamente necessários: autenticação, sessão, segurança, balanceamento e funcionamento essencial;", "Funcionais: preferências e recursos opcionais;", "Analíticos: métricas de uso, desempenho e navegação;", "Publicidade/marketing: atribuição, campanhas, audiência, personalização ou mensuração publicitária, quando efetivamente utilizados e juridicamente permitidos."
    ]},
    { id: "terceiros", heading: "3. Analytics, pixels e terceiros", paragraphs: [
      "Google Analytics, Meta Pixel, Google Ads, Microsoft Clarity ou equivalentes somente deverão constar como ativos quando realmente implementados. Antes da ativação, a Gestify deverá documentar fornecedor, finalidade, identificadores/categorias de dados, compartilhamento, retenção conhecida ou critério aplicável, transferência internacional e fundamento jurídico pertinente."
    ]},
    { id: "controle", heading: "4. Consentimento e gerenciamento", paragraphs: [
      "Tecnologias estritamente necessárias podem operar sem depender de preferência destinada a cookies opcionais quando isso for juridicamente permitido. Cookies não necessários deverão observar o fundamento e as escolhas aplicáveis.",
      "Quando consentimento for exigido ou utilizado, cookies e pixels correspondentes não deverão ser disparados antes da escolha afirmativa válida. O usuário deverá poder recusar categorias opcionais sem ser induzido a aceitar e deverá existir mecanismo acessível para revisar ou revogar escolhas posteriormente."
    ]},
    { id: "registro", heading: "5. Registro e mudança de fornecedores", paragraphs: [
      "A Gestify deverá manter inventário técnico compatível com os rastreadores efetivamente utilizados. A inclusão de fornecedor ou finalidade materialmente nova deverá acionar revisão de privacidade/compliance e, quando necessário, atualização desta Política e do mecanismo de preferências antes da ativação em produção."
    ]},
    { id: "contato", heading: "6. Contato", paragraphs: ["Dúvidas sobre cookies e privacidade podem ser encaminhadas para atendimento@ntsolution.com.br."]}
  ]
};
