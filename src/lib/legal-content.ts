import type { Metadata } from "next";

export type LegalSubsection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  list?: string[];
  afterListParagraphs?: string[];
};

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  list?: string[];
  afterListParagraphs?: string[];
  subsections?: LegalSubsection[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  updatedAt: string;
  description: string;
  intro: string[];
  institutionalData?: Array<{
    label: string;
    value: string;
  }>;
  sections: LegalSection[];
};

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://gestify.app";

export const legalNavigationLinks = [
  {
    href: "/politica-de-privacidade",
    label: "Política de Privacidade",
  },
  {
    href: "/termos-de-uso",
    label: "Termos de Uso",
  },
  {
    href: "/politica-de-cookies",
    label: "Política de Cookies",
  },
  {
    href: "/acessibilidade",
    label: "Acessibilidade",
  },
] as const;

export const authLegalNavigationLinks = legalNavigationLinks.filter(
  (link) => link.href !== "/acessibilidade"
);

export function createLegalPageMetadata(document: LegalDocument): Metadata {
  const title = `${document.title} | Gestify`;

  return {
    title,
    description: document.description,
    alternates: {
      canonical: document.slug,
    },
    openGraph: {
      title,
      description: document.description,
      url: `${SITE_URL}${document.slug}`,
      siteName: "Gestify",
      locale: "pt_BR",
      type: "article",
    },
  };
}

export const privacyPolicyDocument: LegalDocument = {
  slug: "/politica-de-privacidade",
  title: "Política de Privacidade",
  updatedAt: "22/04/2026",
  description:
    "Saiba como a Gestify coleta, utiliza, compartilha e protege dados pessoais no site e na plataforma.",
  intro: [
    "A Gestify valoriza a privacidade, a segurança e a transparência no tratamento de dados pessoais. Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos, protegemos e compartilhamos dados pessoais de visitantes do site, leads, representantes de empresas clientes, usuários cadastrados e demais pessoas que interagem com o site institucional, canais de atendimento e plataforma da Gestify.",
    "Ao acessar o site, solicitar contato, contratar serviços, criar conta, receber convite de acesso ou utilizar a plataforma, você declara ciência desta Política de Privacidade.",
  ],
  institutionalData: [
    { label: "Controladora", value: "NT Solution" },
    { label: "Nome fantasia", value: "Gestify" },
    { label: "CNPJ", value: "12.676.960/0001-55" },
    {
      label: "Endereço",
      value: "AV. Anacé, 337 - AP 2505 - JD. Umarizal - São Paulo - SP - Brasil",
    },
    {
      label: "E-mail para privacidade",
      value: "atendimento@ntsolution.com.br",
    },
    {
      label: "Encarregado/DPO",
      value: "Ivan da Silva Fernandes Escobar",
    },
    { label: "Telefone", value: "+55 11 98675-4605" },
  ],
  sections: [
    {
      id: "abrangencia",
      heading: "1. Abrangência desta Política",
      paragraphs: ["Esta Política se aplica a:"],
      list: [
        "visitantes do site institucional;",
        "pessoas que entram em contato com a Gestify por formulários, e-mail, telefone, WhatsApp ou outros canais;",
        "usuários cadastrados na plataforma;",
        "administradores, representantes e colaboradores das empresas clientes;",
        "potenciais clientes que participam de demonstrações, campanhas, propostas comerciais ou fluxos de contratação.",
      ],
    },
    {
      id: "papeis",
      heading: "2. Papéis da Gestify no tratamento de dados",
      subsections: [
        {
          id: "controladora",
          heading: "2.1. Como Controladora",
          paragraphs: [
            "A Gestify atua como controladora dos dados pessoais quando decide as finalidades e os meios do tratamento relacionados, por exemplo, a:",
          ],
          list: [
            "navegação no site institucional;",
            "formulários de contato e geração de leads;",
            "comunicação comercial e institucional;",
            "cadastro e administração de contas de acesso;",
            "atendimento, suporte, faturamento e relacionamento com clientes;",
            "segurança do ambiente e prevenção a fraudes.",
          ],
        },
        {
          id: "operadora",
          heading: "2.2. Como Operadora",
          paragraphs: [
            "Em determinadas situações, a Gestify poderá atuar como operadora de dados tratados em nome de empresas clientes dentro da plataforma, quando esses dados forem inseridos, organizados ou gerenciados pelo cliente contratante para execução dos serviços. Nesses casos, a empresa cliente poderá ser a controladora dos dados tratados em seu ambiente de uso.",
          ],
        },
      ],
    },
    {
      id: "dados-coletados",
      heading: "3. Quais dados pessoais podemos coletar",
      paragraphs: [
        "Poderemos coletar, conforme o contexto de uso, as seguintes categorias de dados:",
      ],
      subsections: [
        {
          id: "identificacao-e-contato",
          heading: "3.1. Dados de identificação e contato",
          list: [
            "nome completo;",
            "e-mail profissional ou pessoal;",
            "número de telefone;",
            "cargo ou função;",
            "empresa;",
            "CNPJ da empresa contratante, quando aplicável;",
            "informações cadastrais necessárias à contratação, cobrança ou suporte.",
          ],
        },
        {
          id: "acesso-e-navegacao",
          heading: "3.2. Dados de acesso e navegação",
          list: [
            "endereço IP;",
            "data, hora e duração do acesso;",
            "navegador, sistema operacional, idioma e tipo de dispositivo;",
            "páginas visualizadas e interações realizadas;",
            "origem de tráfego;",
            "identificadores de sessão;",
            "logs técnicos, registros de autenticação e eventos de uso.",
          ],
        },
        {
          id: "conta-e-plataforma",
          heading: "3.3. Dados relacionados à conta e ao uso da plataforma",
          list: [
            "nome e perfil do usuário;",
            "credenciais e identificadores de acesso;",
            "permissões, papéis e vínculos organizacionais;",
            "preferências e configurações;",
            "histórico de ações e interações na plataforma;",
            "dados operacionais inseridos no sistema, conforme as funcionalidades utilizadas pela empresa cliente.",
          ],
        },
        {
          id: "cookies-e-tecnologias",
          heading: "3.4. Dados coletados por cookies e tecnologias semelhantes",
          list: [
            "cookies estritamente necessários;",
            "cookies funcionais;",
            "cookies analíticos;",
            "cookies de marketing, quando aplicável e autorizados.",
          ],
        },
      ],
    },
    {
      id: "coleta",
      heading: "4. Como os dados são coletados",
      paragraphs: ["Os dados podem ser coletados por diferentes meios, incluindo:"],
      list: [
        "preenchimento voluntário de formulários;",
        "criação de conta ou convite de acesso por empresa cliente;",
        "contratação de serviços;",
        "navegação no site e uso da plataforma;",
        "interações com suporte, comercial e atendimento;",
        "envio de documentos ou informações pelo titular ou pela empresa cliente;",
        "integrações autorizadas;",
        "registros automáticos de logs, autenticação, cookies e eventos técnicos.",
      ],
    },
    {
      id: "finalidades",
      heading: "5. Finalidades do tratamento",
      paragraphs: [
        "A Gestify poderá tratar dados pessoais para as seguintes finalidades:",
      ],
      list: [
        "identificar e autenticar usuários;",
        "viabilizar cadastro, acesso e uso da plataforma;",
        "prestar os serviços contratados;",
        "administrar contas, perfis, permissões e ambientes organizacionais;",
        "responder dúvidas, solicitações e chamados de suporte;",
        "realizar contato comercial, demonstrações e envio de propostas;",
        "cumprir obrigações legais, regulatórias e contratuais;",
        "proteger a segurança da plataforma, prevenir fraudes e registrar eventos relevantes;",
        "melhorar funcionalidades, desempenho, estabilidade e experiência do usuário;",
        "produzir métricas, estatísticas e análises internas, preferencialmente em formato agregado ou minimizado;",
        "exercer direitos em processos judiciais, administrativos, arbitrais ou de auditoria;",
        "realizar comunicações institucionais, técnicas, operacionais e, quando permitido, comerciais.",
      ],
    },
    {
      id: "bases-legais",
      heading: "6. Bases legais do tratamento",
      paragraphs: [
        "O tratamento de dados pessoais poderá ocorrer com fundamento nas bases legais previstas na LGPD, conforme o contexto, inclusive:",
      ],
      list: [
        "execução de contrato ou de procedimentos preliminares relacionados a contrato;",
        "cumprimento de obrigação legal ou regulatória;",
        "exercício regular de direitos;",
        "legítimo interesse, observados os direitos e liberdades fundamentais do titular;",
        "consentimento, quando exigido ou aplicável.",
      ],
    },
    {
      id: "compartilhamento",
      heading: "7. Compartilhamento de dados pessoais",
      paragraphs: [
        "A Gestify poderá compartilhar dados pessoais, quando necessário, com:",
      ],
      list: [
        "provedores de hospedagem, infraestrutura, nuvem e banco de dados;",
        "serviços de autenticação, comunicação e envio de e-mails;",
        "ferramentas de analytics, monitoramento, atendimento e suporte;",
        "prestadores de serviço e parceiros essenciais à operação;",
        "gateways de pagamento, faturamento e serviços financeiros, quando aplicável;",
        "autoridades públicas e órgãos competentes, mediante obrigação legal, regulatória ou ordem válida.",
      ],
      afterListParagraphs: [
        "A Gestify busca adotar o princípio da necessidade, compartilhando apenas o mínimo necessário para cada finalidade.",
      ],
    },
    {
      id: "transferencia-internacional",
      heading: "8. Transferência internacional de dados",
      paragraphs: [
        "Alguns fornecedores de tecnologia utilizados pela Gestify poderão armazenar ou processar dados fora do Brasil. Nesses casos, a Gestify buscará adotar medidas razoáveis para assegurar nível adequado de proteção, observadas as exigências legais aplicáveis.",
      ],
    },
    {
      id: "retencao",
      heading: "9. Armazenamento e retenção",
      paragraphs: [
        "Os dados pessoais serão armazenados pelo tempo necessário para cumprir as finalidades descritas nesta Política, atender obrigações legais, regulatórias, contratuais, de auditoria e de defesa de direitos.",
        "Os prazos de retenção poderão variar conforme:",
      ],
      list: [
        "a natureza da relação com o titular;",
        "o tipo de dado tratado;",
        "a finalidade do tratamento;",
        "a existência de obrigação legal ou fundamento legítimo para retenção.",
      ],
      afterListParagraphs: [
        "Quando não houver mais necessidade ou fundamento legal para manutenção, os dados poderão ser eliminados, anonimizados ou armazenados de forma segura e restrita, conforme cabível.",
      ],
    },
    {
      id: "seguranca",
      heading: "10. Segurança da informação",
      paragraphs: [
        "A Gestify adota medidas técnicas e administrativas razoáveis para proteger os dados pessoais contra acessos não autorizados, perda, destruição, alteração, vazamento, comunicação ou qualquer forma de tratamento inadequado ou ilícito.",
        "Essas medidas podem incluir, conforme aplicável:",
      ],
      list: [
        "controle de acesso por perfil e necessidade;",
        "autenticação e gestão de credenciais;",
        "segregação de ambientes;",
        "monitoramento e rastreabilidade;",
        "logs de segurança;",
        "revisão de permissões;",
        "backups;",
        "criptografia, pseudonimização ou mecanismos equivalentes, quando aplicável;",
        "políticas internas e rotinas de segurança.",
      ],
      afterListParagraphs: [
        "Nenhum ambiente é absolutamente invulnerável. Por isso, o usuário também deve manter sigilo sobre suas credenciais e utilizar boas práticas de segurança.",
      ],
    },
    {
      id: "incidentes",
      heading: "11. Incidentes de segurança",
      paragraphs: [
        "Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, a Gestify poderá adotar as medidas cabíveis, inclusive avaliação do impacto, contenção do evento e, quando exigido, comunicação aos envolvidos e às autoridades competentes, nos termos da legislação aplicável.",
      ],
    },
    {
      id: "direitos-do-titular",
      heading: "12. Direitos do titular",
      paragraphs: [
        "Nos termos da legislação aplicável, o titular poderá solicitar, quando cabível:",
      ],
      list: [
        "confirmação da existência de tratamento;",
        "acesso aos dados;",
        "correção de dados incompletos, inexatos ou desatualizados;",
        "anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;",
        "portabilidade dos dados, quando aplicável;",
        "eliminação de dados tratados com base em consentimento;",
        "informação sobre compartilhamentos realizados;",
        "revogação do consentimento, quando essa for a base legal;",
        "oposição a tratamento irregular.",
      ],
      afterListParagraphs: [
        "As solicitações poderão ser enviadas para: atendimento@ntsolution.com.br.",
        "Para proteger os dados pessoais, a Gestify poderá solicitar informações adicionais para confirmação de identidade e legitimidade do pedido.",
      ],
    },
    {
      id: "cookies",
      heading: "13. Cookies e tecnologias semelhantes",
      paragraphs: [
        "A Gestify utiliza cookies e tecnologias correlatas para:",
      ],
      list: [
        "garantir o funcionamento técnico do site e da plataforma;",
        "manter sessões autenticadas;",
        "lembrar preferências;",
        "analisar desempenho e navegação;",
        "apoiar, quando autorizado, ações de mensuração e comunicação.",
      ],
      afterListParagraphs: [
        "Mais informações estão disponíveis na Política de Cookies.",
      ],
    },
    {
      id: "menores",
      heading: "14. Dados de menores de idade",
      paragraphs: [
        "O site e a plataforma da Gestify não são direcionados a menores de 18 anos. Caso a Gestify identifique tratamento indevido de dados de menores sem base legal adequada, poderá adotar medidas para exclusão, bloqueio ou regularização do tratamento.",
      ],
    },
    {
      id: "links-terceiros",
      heading: "15. Links de terceiros",
      paragraphs: [
        "O site e a plataforma poderão conter links para sites, serviços ou aplicações de terceiros. A Gestify não se responsabiliza pelas políticas, práticas ou conteúdos de terceiros.",
      ],
    },
    {
      id: "atualizacoes",
      heading: "16. Atualizações desta Política",
      paragraphs: [
        "Esta Política poderá ser alterada a qualquer momento para refletir mudanças legais, regulatórias, operacionais ou tecnológicas. A versão vigente estará sempre disponível nesta página com a respectiva data de atualização.",
      ],
    },
    {
      id: "contato",
      heading: "17. Contato",
      list: [
        "NT Solution",
        "Nome fantasia: Gestify",
        "E-mail: atendimento@ntsolution.com.br",
        "Encarregado/DPO: Ivan da Silva Fernandes Escobar",
        "Telefone: +55 11 98675-4605",
        "Endereço: AV. Anacé, 337 - AP 2505 - JD. Umarizal - São Paulo - SP - Brasil",
      ],
    },
  ],
};

export const termsOfUseDocument: LegalDocument = {
  slug: "/termos-de-uso",
  title: "Termos e Condições de Uso",
  updatedAt: "22/04/2026",
  description:
    "Conheça as condições de acesso e uso do site, da plataforma e dos serviços disponibilizados pela Gestify.",
  intro: [
    "Estes Termos e Condições de Uso regulam o acesso e a utilização do site, da plataforma e dos serviços disponibilizados pela Gestify. Ao acessar o site ou utilizar a plataforma, o usuário declara que leu, compreendeu e concorda com estes Termos e com a Política de Privacidade.",
  ],
  sections: [
    {
      id: "definicoes",
      heading: "1. Definições",
      paragraphs: ["Para fins destes Termos:"],
      list: [
        "Gestify: marca, site, plataforma, sistema, interface, aplicações, conteúdos e serviços disponibilizados pela NT Solution.",
        "Usuário: qualquer pessoa que acesse o site ou utilize a plataforma.",
        "Cliente: pessoa física ou jurídica que contrata os serviços da Gestify.",
        "Conta: credencial de acesso vinculada a usuário autorizado.",
        "Administrador da conta: usuário com poderes de gestão de contas, acessos, permissões e configurações do ambiente da empresa cliente.",
        "Plataforma: ambiente digital com funcionalidades operacionais, administrativas, gerenciais e comerciais disponibilizadas pela Gestify.",
      ],
    },
    {
      id: "objeto",
      heading: "2. Objeto",
      paragraphs: [
        "A Gestify disponibiliza solução digital voltada à gestão operacional, administrativa e organizacional, conforme funcionalidades contratadas, liberadas e tecnicamente disponíveis na plataforma.",
      ],
    },
    {
      id: "aceitacao",
      heading: "3. Aceitação",
      paragraphs: [
        "Ao acessar o site, criar conta, receber convite de acesso, contratar serviços ou utilizar a plataforma, o usuário concorda integralmente com estes Termos. Caso não concorde, deverá cessar o uso do site e da plataforma.",
      ],
    },
    {
      id: "elegibilidade",
      heading: "4. Elegibilidade e responsabilidade cadastral",
      paragraphs: ["O usuário declara que:"],
      list: [
        "possui capacidade legal para aceitar estes Termos;",
        "utilizará a plataforma em nome próprio ou com autorização legítima da empresa vinculada;",
        "fornecerá informações verdadeiras, completas e atualizadas;",
        "manterá seus dados cadastrais atualizados;",
        "utilizará a plataforma somente para finalidades lícitas e autorizadas.",
      ],
    },
    {
      id: "cadastro",
      heading: "5. Cadastro, conta e credenciais",
      paragraphs: [
        "Determinadas funcionalidades exigem conta de acesso, que poderá ser criada diretamente, por contratação ou por convite feito por administrador autorizado.",
        "O usuário é responsável por:",
      ],
      list: [
        "manter o sigilo de login e senha;",
        "não compartilhar credenciais;",
        "comunicar imediatamente qualquer suspeita de acesso indevido;",
        "utilizar mecanismos razoáveis de segurança em seus dispositivos.",
      ],
      afterListParagraphs: [
        "A Gestify poderá adotar medidas de proteção, bloqueio, suspensão ou limitação de acesso diante de indícios de fraude, uso indevido, violação destes Termos ou risco à segurança.",
      ],
    },
    {
      id: "conduta",
      heading: "6. Regras de conduta",
      paragraphs: ["É proibido ao usuário:"],
      list: [
        "praticar atos ilícitos ou contrários à boa-fé;",
        "violar direitos da Gestify ou de terceiros;",
        "tentar obter acesso não autorizado a contas, sistemas, servidores ou dados;",
        "burlar permissões, autenticação, limites técnicos ou controles de acesso;",
        "inserir vírus, malware, scripts maliciosos ou rotinas automatizadas abusivas;",
        "copiar, reproduzir, desmontar, descompilar, modificar ou explorar indevidamente a plataforma;",
        "realizar scraping ou mineração não autorizada;",
        "utilizar a plataforma para spam, fraude, engenharia social, assédio, difamação ou discriminação;",
        "inserir conteúdo ilegal, enganoso, ofensivo, abusivo ou sem base legítima de tratamento.",
      ],
    },
    {
      id: "responsabilidades-do-cliente",
      heading: "7. Responsabilidades do cliente e dos dados inseridos",
      paragraphs: [
        "O cliente e os usuários vinculados à sua conta são responsáveis pelos dados, conteúdos, documentos, cadastros, registros operacionais e demais informações inseridas na plataforma.",
        "O cliente declara que possui legitimidade para inserir e tratar tais dados, inclusive quando envolver dados pessoais de terceiros, comprometendo-se a observar a legislação aplicável e a fornecer avisos, bases legais e instruções cabíveis quando for controlador desses dados.",
      ],
    },
    {
      id: "disponibilidade",
      heading: "8. Disponibilidade dos serviços",
      paragraphs: [
        "A Gestify busca manter a plataforma disponível, estável e segura, mas não garante operação ininterrupta ou livre de erros.",
        "Poderão ocorrer indisponibilidades temporárias em razão de:",
      ],
      list: [
        "manutenção preventiva ou corretiva;",
        "atualização técnica;",
        "falhas de conectividade, energia ou serviços de terceiros;",
        "incidentes de segurança;",
        "caso fortuito ou força maior.",
      ],
    },
    {
      id: "evolucao",
      heading: "9. Funcionalidades, evolução e alterações",
      paragraphs: [
        "A Gestify poderá atualizar, evoluir, reorganizar, limitar ou descontinuar funcionalidades, interfaces ou recursos, desde que respeitados os compromissos contratuais aplicáveis.",
      ],
    },
    {
      id: "propriedade-intelectual",
      heading: "10. Propriedade intelectual",
      paragraphs: [
        "Todo o conteúdo, software, código-fonte, layout, design, marca, identidade visual, documentação, bancos de dados, fluxos, interfaces e elementos da Gestify são protegidos pela legislação aplicável e pertencem à Gestify ou aos seus licenciadores.",
        "O uso da plataforma não transfere ao usuário qualquer direito de propriedade intelectual, exceto licença limitada, revogável, não exclusiva e intransferível para uso conforme estes Termos e os instrumentos contratuais aplicáveis.",
      ],
    },
    {
      id: "privacidade",
      heading: "11. Privacidade e proteção de dados",
      paragraphs: [
        "O tratamento de dados pessoais relacionado ao uso do site e da plataforma observará a Política de Privacidade da Gestify e a legislação aplicável.",
      ],
    },
    {
      id: "planos",
      heading: "12. Planos, contratação, cobrança e cancelamento",
      paragraphs: [
        "Quando houver contratação paga, as condições comerciais, preços, periodicidade, reajustes, limites, cancelamento, suporte, inadimplência e demais regras seguirão proposta comercial, contrato, ordem de serviço, plano ou checkout aplicável.",
        "Na ausência de instrumento específico, prevalecerão as condições informadas no momento da contratação.",
      ],
    },
    {
      id: "suspensao",
      heading: "13. Suspensão, bloqueio e encerramento",
      paragraphs: ["A Gestify poderá suspender, restringir ou encerrar acesso em caso de:"],
      list: [
        "violação destes Termos;",
        "inadimplência, quando aplicável;",
        "uso indevido da plataforma;",
        "risco à segurança do ambiente;",
        "determinação legal, regulatória ou judicial;",
        "uso incompatível com a finalidade do serviço.",
      ],
    },
    {
      id: "limitacao-de-responsabilidade",
      heading: "14. Limitação de responsabilidade",
      paragraphs: [
        "Na máxima extensão permitida pela legislação aplicável, a Gestify não será responsável por:",
      ],
      list: [
        "danos decorrentes de uso inadequado da plataforma;",
        "falhas de internet, energia, navegadores, dispositivos ou provedores de terceiros;",
        "indisponibilidades temporárias razoáveis;",
        "perda causada por compartilhamento indevido de credenciais pelo próprio usuário;",
        "decisões empresariais tomadas exclusivamente com base em informações da plataforma sem validação própria;",
        "danos indiretos, incidentais, especiais, consequenciais ou lucros cessantes, salvo quando a lei aplicável vedar essa limitação.",
      ],
    },
    {
      id: "indenizacao",
      heading: "15. Indenização",
      paragraphs: [
        "O usuário e/ou cliente concorda em indenizar a Gestify por prejuízos, perdas, despesas, custos e demandas decorrentes de uso indevido da plataforma, violação destes Termos ou lesão a direitos de terceiros.",
      ],
    },
    {
      id: "comunicacoes",
      heading: "16. Comunicações",
      paragraphs: [
        "A Gestify poderá enviar comunicações administrativas, técnicas, operacionais, de segurança, cobrança e, quando permitido, comunicações comerciais, por e-mail, sistema, WhatsApp ou outros canais informados pelo usuário ou cliente.",
      ],
    },
    {
      id: "nulidade",
      heading: "17. Tolerância e nulidade parcial",
      paragraphs: [
        "A eventual tolerância ao descumprimento de qualquer disposição destes Termos não implicará renúncia de direito. Caso alguma cláusula seja considerada inválida, as demais permanecerão em vigor.",
      ],
    },
    {
      id: "foro",
      heading: "18. Lei aplicável e foro",
      paragraphs: [
        "Estes Termos serão regidos pelas leis da República Federativa do Brasil.",
        "Fica eleito o foro da comarca de São Paulo/SP, salvo hipótese de competência legal imperativa diversa.",
      ],
    },
    {
      id: "contato",
      heading: "19. Contato",
      list: [
        "NT Solution / Gestify",
        "E-mail: atendimento@ntsolution.com.br",
        "Telefone: +55 11 98675-4605",
      ],
    },
  ],
};

export const cookiePolicyDocument: LegalDocument = {
  slug: "/politica-de-cookies",
  title: "Política de Cookies",
  updatedAt: "22/04/2026",
  description:
    "Entenda como a Gestify utiliza cookies, quais categorias estão disponíveis e como gerenciar suas preferências.",
  intro: [
    "Esta Política de Cookies explica como a Gestify utiliza cookies e tecnologias semelhantes em seu site e plataforma.",
  ],
  sections: [
    {
      id: "o-que-sao-cookies",
      heading: "1. O que são cookies",
      paragraphs: [
        "Cookies são pequenos arquivos de texto armazenados no navegador ou dispositivo do usuário quando ele visita um site ou utiliza uma aplicação. Eles ajudam a manter sessões, lembrar preferências, melhorar a navegação, medir desempenho e compreender como o ambiente é utilizado.",
      ],
    },
    {
      id: "para-que-usamos",
      heading: "2. Para que usamos cookies",
      paragraphs: ["A Gestify utiliza cookies para:"],
      list: [
        "permitir o funcionamento técnico do site e da plataforma;",
        "manter sessões autenticadas;",
        "lembrar preferências e configurações;",
        "melhorar desempenho, estabilidade e segurança;",
        "compreender padrões de navegação e uso;",
        "apoiar mensuração de campanhas e comunicação, quando aplicável e autorizada.",
      ],
    },
    {
      id: "categorias",
      heading: "3. Categorias de cookies",
      subsections: [
        {
          id: "necessarios",
          heading: "3.1. Cookies estritamente necessários",
          paragraphs: [
            "São indispensáveis para o funcionamento do site e da plataforma, incluindo autenticação, segurança, persistência de sessão, preferências essenciais e integridade técnica. Em regra, não dependem de consentimento prévio por serem necessários à prestação do serviço.",
          ],
        },
        {
          id: "funcionais",
          heading: "3.2. Cookies funcionais",
          paragraphs: [
            "Permitem lembrar preferências, idioma, personalizações e facilidades de navegação.",
          ],
        },
        {
          id: "analiticos",
          heading: "3.3. Cookies analíticos",
          paragraphs: [
            "Ajudam a entender como o usuário navega no site e na plataforma, com o objetivo de medir desempenho, identificar falhas e aprimorar a experiência.",
          ],
        },
        {
          id: "marketing",
          heading: "3.4. Cookies de marketing e publicidade",
          paragraphs: [
            "Podem ser usados para mensurar campanhas, personalizar comunicação e exibir conteúdos mais relevantes, quando aplicável e mediante consentimento, se exigido.",
          ],
        },
      ],
    },
    {
      id: "terceiros",
      heading: "4. Cookies de terceiros",
      paragraphs: [
        "Alguns cookies podem ser definidos por terceiros integrados ao site ou à plataforma, como ferramentas de autenticação, atendimento, análise, monitoramento, mídia incorporada ou automação.",
        "Nesses casos, o tratamento também poderá seguir as políticas próprias desses terceiros.",
      ],
    },
    {
      id: "consentimento",
      heading: "5. Consentimento e preferências",
      paragraphs: [
        "Quando exigido pela legislação aplicável, a Gestify solicitará consentimento antes da ativação de cookies não essenciais, especialmente cookies analíticos e de marketing.",
        "O usuário poderá:",
      ],
      list: [
        "aceitar cookies opcionais;",
        "recusar cookies opcionais;",
        "personalizar preferências por categoria, quando disponível.",
      ],
    },
    {
      id: "gerenciar",
      heading: "6. Como gerenciar ou desativar cookies",
      paragraphs: ["O usuário poderá, a qualquer momento:"],
      list: [
        "revisar suas preferências no banner ou centro de preferências, quando disponível;",
        "ajustar permissões no navegador;",
        "excluir cookies já armazenados;",
        "bloquear cookies futuros.",
      ],
      afterListParagraphs: [
        "O bloqueio de cookies essenciais pode prejudicar funcionalidades do site ou da plataforma.",
      ],
    },
    {
      id: "alteracoes",
      heading: "7. Alterações nesta Política",
      paragraphs: [
        "A Gestify poderá atualizar esta Política de Cookies para refletir mudanças legais, tecnológicas ou operacionais. A versão vigente estará sempre disponível nesta página com a data de atualização.",
      ],
    },
    {
      id: "contato",
      heading: "8. Contato",
      paragraphs: [
        "Para dúvidas sobre esta Política de Cookies, entre em contato por: atendimento@ntsolution.com.br",
      ],
    },
  ],
};

export const accessibilityPolicyDocument: LegalDocument = {
  slug: "/acessibilidade",
  title: "Política de Acessibilidade",
  updatedAt: "22/04/2026",
  description:
    "Conheça o compromisso da Gestify com acessibilidade digital e como relatar barreiras de acesso.",
  intro: [
    "A Gestify busca oferecer uma experiência digital acessível, inclusiva e utilizável pelo maior número possível de pessoas, inclusive pessoas com deficiência.",
  ],
  sections: [
    {
      id: "compromisso",
      heading: "1. Compromisso",
      paragraphs: [
        "Nosso compromisso é evoluir continuamente o site e a plataforma para ampliar a acessibilidade, a clareza de navegação, a compatibilidade com teclado, a legibilidade visual e a compreensão do conteúdo por tecnologias assistivas.",
      ],
    },
    {
      id: "diretrizes",
      heading: "2. Diretrizes de referência",
      paragraphs: [
        "Sempre que tecnicamente viável, buscamos orientar nossas interfaces por boas práticas de acessibilidade digital e por diretrizes reconhecidas internacionalmente, como as WCAG.",
      ],
    },
    {
      id: "medidas",
      heading: "3. Medidas adotadas ou em evolução",
      paragraphs: [
        "Entre as medidas que buscamos implementar, revisar ou ampliar, estão:",
      ],
      list: [
        "estrutura semântica adequada de títulos e conteúdo;",
        "contraste visual apropriado;",
        "foco visível em elementos interativos;",
        "navegação por teclado;",
        "rótulos claros em campos de formulário;",
        "mensagens de erro compreensíveis;",
        "responsividade e legibilidade em diferentes dispositivos;",
        "uso de textos alternativos quando aplicável;",
        "consistência visual e funcional dos componentes.",
      ],
    },
    {
      id: "melhoria-continua",
      heading: "4. Limitações e melhoria contínua",
      paragraphs: [
        "A acessibilidade é um processo contínuo. Algumas áreas do site ou da plataforma podem estar em evolução, e a Gestify busca corrigir barreiras identificadas conforme criticidade, viabilidade técnica e prioridade de uso.",
      ],
    },
    {
      id: "relatar-dificuldade",
      heading: "5. Como relatar dificuldade de acesso",
      paragraphs: [
        "Caso você encontre dificuldade de navegação, leitura, preenchimento de formulário ou uso de qualquer funcionalidade, entre em contato informando, se possível:",
      ],
      list: [
        "a página ou funcionalidade afetada;",
        "a dificuldade encontrada;",
        "o dispositivo e navegador utilizados;",
        "eventual tecnologia assistiva utilizada.",
      ],
    },
    {
      id: "canal-de-contato",
      heading: "6. Canal de contato",
      list: [
        "E-mail: atendimento@ntsolution.com.br",
        "Telefone: +55 11 98675-4605",
      ],
    },
    {
      id: "tratamento-das-solicitacoes",
      heading: "7. Tratamento das solicitações",
      paragraphs: [
        "A Gestify buscará analisar os relatos recebidos e adotar, quando possível, medidas corretivas ou alternativas razoáveis em prazo compatível com a criticidade da demanda.",
      ],
    },
  ],
};
