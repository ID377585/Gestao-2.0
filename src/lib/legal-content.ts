import type { Metadata } from "next";
import {
  CURRENT_TERMS_DOCUMENT_TITLE,
  CURRENT_TERMS_DOCUMENT_VERSION,
  CURRENT_TERMS_UPDATED_AT,
} from "@/lib/auth/terms-config";

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
    label: CURRENT_TERMS_DOCUMENT_TITLE,
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
  title: CURRENT_TERMS_DOCUMENT_TITLE,
  updatedAt: CURRENT_TERMS_UPDATED_AT,
  description:
    "Conheça o contrato SaaS vigente da Gestify, com regras de uso, cobrança, suporte, proteção de dados, segurança e responsabilidades das partes.",
  intro: [
    `Este ${CURRENT_TERMS_DOCUMENT_TITLE} regula a disponibilização e o uso da plataforma Gestify em modelo SaaS. Ao acessar o site, criar conta, contratar, efetuar pagamento, receber convite de acesso ou utilizar a plataforma, o usuário declara que leu, compreendeu e concorda com este contrato e com a Política de Privacidade da Gestify.`,
    `Versão contratual vigente: ${CURRENT_TERMS_DOCUMENT_VERSION}. Data da versão: ${CURRENT_TERMS_UPDATED_AT}.`,
    "Observação importante: este documento é um modelo-base contratual para uso comercial do Gestify. Antes da publicação final e do uso com clientes Enterprise, recomenda-se revisão por advogado especializado em contratos digitais, LGPD e SaaS.",
  ],
  sections: [
    {
      id: "partes",
      heading: "1. Partes",
      paragraphs: [
        "CONTRATADA: NT Solution, responsável pela disponibilização, operação e comercialização da plataforma Gestify.",
        "PLATAFORMA: Gestify, solução digital disponibilizada em modelo SaaS, acessível por meio do domínio gestify.app e de outros domínios, subdomínios, aplicações, APIs e ambientes relacionados.",
        "CONTRATANTE: pessoa física ou jurídica que cria conta, acessa, contrata, paga, utiliza ou aceita eletronicamente este contrato, diretamente ou por representantes autorizados.",
        "Ao aceitar este contrato eletronicamente, criar conta, efetuar pagamento ou utilizar a plataforma, o CONTRATANTE declara ciência e concordância integral com seus termos.",
      ],
    },
    {
      id: "objeto",
      heading: "2. Objeto",
      paragraphs: [
        "O presente contrato tem por objeto a disponibilização de acesso à plataforma Gestify, em modelo SaaS, incluindo funcionalidades, atualizações, suporte técnico, recursos de armazenamento, integrações e demais serviços vinculados, conforme o plano contratado.",
        "A contratação não implica venda, cessão, transferência de propriedade, acesso ao código-fonte ou qualquer direito de titularidade sobre o software.",
      ],
    },
    {
      id: "definicoes",
      heading: "3. Definições",
      paragraphs: ["Para fins deste contrato:"],
      list: [
        "SaaS: software disponibilizado como serviço, mediante acesso remoto via internet.",
        "Conta: ambiente de acesso do CONTRATANTE na plataforma.",
        "Usuário: pessoa autorizada pelo CONTRATANTE a acessar a plataforma.",
        "Dados do Cliente: informações inseridas, cadastradas, importadas ou processadas pelo CONTRATANTE na plataforma.",
        "Dados Pessoais: informações relacionadas a pessoa natural identificada ou identificável.",
        "Controlador: parte que decide as finalidades e meios do tratamento de dados pessoais.",
        "Operador: parte que trata dados pessoais em nome do controlador.",
        "Suboperador: terceiro contratado para apoiar o tratamento de dados pessoais.",
        "Downtime: período em que a plataforma fica indisponível por falha atribuível exclusivamente à CONTRATADA, excluídas as hipóteses previstas neste contrato e em seus anexos.",
      ],
    },
    {
      id: "licenca",
      heading: "4. Licença de uso",
      paragraphs: [
        "A CONTRATADA concede ao CONTRATANTE uma licença de uso limitada, revogável, não exclusiva, intransferível, não sublicenciável e condicionada ao cumprimento deste contrato, enquanto houver plano ativo e pagamento regular, quando aplicável.",
        "É expressamente vedado ao CONTRATANTE e aos seus usuários:",
      ],
      list: [
        "realizar engenharia reversa, descompilação, desmontagem ou tentativa de acesso ao código-fonte;",
        "copiar, modificar, adaptar, traduzir, reproduzir ou criar obras derivadas da plataforma sem autorização;",
        "revender, sublicenciar, alugar, ceder, compartilhar comercialmente ou explorar a plataforma sem autorização;",
        "utilizar a plataforma para desenvolver produto concorrente;",
        "praticar scraping, mineração abusiva, automação não autorizada ou coleta massiva de dados;",
        "sobrecarregar, testar vulnerabilidades, invadir ou tentar comprometer a infraestrutura;",
        "utilizar a plataforma para fins ilegais, fraudulentos, discriminatórios, abusivos ou contrários à legislação aplicável.",
      ],
    },
    {
      id: "planos",
      heading: "5. Planos, preços e condições comerciais",
      paragraphs: [
        "A plataforma poderá ser contratada em planos de referência como Starter, Pro e Enterprise, com valores e escopos definidos comercialmente no momento da contratação.",
        "Os valores poderão ser alterados mediante aviso prévio mínimo de 30 dias, salvo promoções, reajustes tributários, alterações de escopo ou contratação específica.",
        "A cobrança poderá ocorrer por cartão de crédito, Pix, boleto, gateway de pagamento, plataforma de assinatura ou outro meio disponibilizado pela CONTRATADA.",
        "A contratação poderá incluir limites de uso, como quantidade de usuários, unidades, registros, integrações, armazenamento, requisições, automações, módulos, ambientes e funcionalidades.",
      ],
    },
    {
      id: "inadimplencia",
      heading: "6. Inadimplência, suspensão e reativação",
      paragraphs: [
        "O atraso no pagamento superior a 7 dias poderá resultar em suspensão parcial ou total do acesso à plataforma.",
        "A inadimplência superior a 30 dias poderá resultar em rescisão contratual, bloqueio definitivo da conta e início do prazo de retenção técnica dos dados.",
        "A reativação poderá depender da quitação dos valores em aberto, atualização cadastral, regularização contratual e, se aplicável, pagamento de taxa administrativa.",
      ],
    },
    {
      id: "cancelamento",
      heading: "7. Cancelamento e reembolso",
      paragraphs: [
        "O CONTRATANTE poderá cancelar a assinatura a qualquer momento pelos canais disponibilizados pela CONTRATADA.",
        "Salvo disposição expressa em contrato específico, o cancelamento não gera reembolso proporcional de período já pago, permanecendo o acesso disponível até o fim do ciclo contratado.",
        "Em caso de violação contratual, uso indevido, fraude ou risco à segurança da plataforma, a CONTRATADA poderá suspender ou encerrar o acesso sem obrigação de reembolso.",
      ],
    },
    {
      id: "enterprise",
      heading: "8. Clientes B2B, corporativos e Enterprise",
      paragraphs: [
        "Clientes B2B e Enterprise poderão contratar condições específicas mediante proposta comercial, ordem de serviço, contrato complementar ou aditivo.",
        "Essas condições poderão incluir:",
      ],
      list: [
        "SLA customizado;",
        "suporte prioritário;",
        "canal dedicado de atendimento;",
        "limites ampliados de uso;",
        "condições específicas de pagamento;",
        "treinamento, onboarding e implantação assistida;",
        "integrações específicas;",
        "obrigações adicionais de segurança;",
        "cláusulas próprias de auditoria, confidencialidade e proteção de dados;",
        "ambientes segregados ou dedicados, quando técnica e comercialmente aplicável.",
      ],
      afterListParagraphs: [
        "Em caso de conflito entre este contrato e instrumento Enterprise assinado separadamente, prevalecerá o instrumento mais específico.",
      ],
    },
    {
      id: "sla",
      heading: "9. SLA — nível de serviço",
      paragraphs: [
        "A CONTRATADA envidará esforços comercialmente razoáveis para manter a plataforma disponível conforme o plano contratado.",
        "Como referência contratual, a disponibilidade mensal poderá observar 99,0% para planos Starter e Pro e 99,9% para clientes Enterprise, nos termos do Anexo I.",
        "Os créditos previstos em SLA, quando aplicáveis, constituem a compensação contratual cabível por indisponibilidade elegível, salvo disposição expressa em contrato específico.",
      ],
    },
    {
      id: "suporte",
      heading: "10. Suporte técnico",
      paragraphs: [
        "O suporte será prestado conforme o plano contratado e os canais disponibilizados pela CONTRATADA.",
        "Como referência, os prazos de primeira resposta poderão variar de até 48 horas úteis em planos básicos até atendimento prioritário para clientes Enterprise.",
        "Os prazos de primeira resposta não garantem prazo de solução definitiva, pois a correção poderá depender da complexidade técnica, de terceiros, de infraestrutura, de APIs externas ou da cooperação do CONTRATANTE.",
      ],
    },
    {
      id: "backup",
      heading: "11. Backup, retenção e continuidade",
      paragraphs: [
        "A CONTRATADA adotará rotina de backup compatível com o estágio, porte e arquitetura da plataforma.",
        "A política padrão prevê, como referência, backup automático diário, retenção padrão de 7 dias e armazenamento em infraestrutura cloud ou de terceiros.",
        "A CONTRATADA não garante recuperação integral de dados em todos os cenários, especialmente quando a perda decorrer de ação ou omissão do CONTRATANTE, exclusão manual, uso indevido, falha de credenciais, integrações externas, limitação técnica ou eventos de força maior.",
        "O CONTRATANTE é responsável por manter cópias próprias de dados críticos, documentos fiscais, relatórios, bases contábeis, registros legais e informações essenciais à sua operação.",
      ],
    },
    {
      id: "portabilidade",
      heading: "12. Exportação, portabilidade e devolução de dados",
      paragraphs: [
        "O CONTRATANTE poderá exportar seus dados a qualquer momento, quando a funcionalidade estiver disponível na plataforma, ou solicitar exportação por canal de atendimento.",
        "A exportação poderá ser fornecida em formato estruturado, como CSV, JSON, XLSX ou equivalente, conforme viabilidade técnica e plano contratado.",
        "Após o encerramento da conta, os dados poderão permanecer armazenados por período técnico de retenção, backup, auditoria, prevenção a fraudes, cumprimento legal ou defesa de direitos, conforme este contrato e a Política de Privacidade.",
      ],
    },
    {
      id: "integracoes",
      heading: "13. Integrações, infraestrutura e serviços de terceiros",
      paragraphs: [
        "A plataforma poderá utilizar, integrar-se ou depender de tecnologias e provedores de terceiros, incluindo infraestrutura, banco de dados, autenticação, hospedagem, pagamento, armazenamento, e-mail, DNS, CDN, logs, monitoramento e analytics.",
        "A CONTRATADA não se responsabiliza por falhas, interrupções, alterações, limitações, custos, indisponibilidades, políticas ou incidentes originados exclusivamente em terceiros, embora adote esforços razoáveis para mitigar impactos.",
        "Quando uma integração for configurada pelo CONTRATANTE, este será responsável por credenciais, permissões, chaves de API, limites de uso, cobranças de terceiros e conformidade com os termos desses provedores.",
      ],
    },
    {
      id: "uso-aceitavel",
      heading: "14. Uso aceitável e medidas por uso indevido",
      paragraphs: [
        "O CONTRATANTE compromete-se a utilizar a plataforma de forma lícita, ética e compatível com sua finalidade.",
        "São proibidos, entre outros:",
      ],
      list: [
        "uso para atividades ilícitas, fraudulentas ou abusivas;",
        "envio de spam, phishing, malware ou conteúdo malicioso;",
        "tentativa de acesso não autorizado;",
        "exploração de vulnerabilidades;",
        "uso de bots, crawlers, scripts ou automações não autorizadas;",
        "compartilhamento indevido de credenciais;",
        "violação de direitos de terceiros;",
        "uso que comprometa desempenho, segurança, reputação ou disponibilidade da plataforma.",
      ],
      afterListParagraphs: [
        "Em caso de uso indevido, a CONTRATADA poderá aplicar, isolada ou cumulativamente, alerta formal, limitação de recursos, suspensão temporária, bloqueio de conta, rescisão unilateral, cobrança de custos técnicos, administrativos, jurídicos e operacionais e responsabilização por perdas e danos.",
      ],
    },
    {
      id: "propriedade-intelectual",
      heading: "15. Propriedade intelectual",
      paragraphs: [
        "Todos os direitos de propriedade intelectual relacionados à plataforma, incluindo software, código-fonte, código-objeto, arquitetura, banco de dados, fluxos, telas, layout, marca, identidade visual, documentação, APIs, modelos, integrações, automações, know-how e melhorias pertencem exclusivamente à CONTRATADA ou a seus licenciantes.",
        "O CONTRATANTE não adquire qualquer direito de propriedade sobre a plataforma.",
        "Os dados inseridos pelo CONTRATANTE permanecem de titularidade do CONTRATANTE ou de seus respectivos titulares, conforme aplicável.",
        "Feedbacks, sugestões, ideias ou recomendações enviados pelo CONTRATANTE poderão ser utilizados pela CONTRATADA para melhoria da plataforma, sem obrigação de remuneração, desde que não envolvam informações confidenciais indevidamente divulgadas.",
      ],
    },
    {
      id: "confidencialidade",
      heading: "16. Confidencialidade",
      paragraphs: [
        "As partes comprometem-se a manter sigilo sobre informações confidenciais obtidas em razão da contratação, incluindo dados técnicos, comerciais, financeiros, estratégicos, operacionais, credenciais, informações de clientes, documentação, propostas e materiais não públicos.",
        "A obrigação de confidencialidade permanecerá vigente por 5 anos após o encerramento contratual, ou por prazo superior quando exigido por lei, segredo de negócio ou contrato específico.",
      ],
    },
    {
      id: "lgpd",
      heading: "17. LGPD, DPA e proteção de dados",
      paragraphs: [
        "No tratamento de dados pessoais inseridos pelo CONTRATANTE na plataforma, em regra, o CONTRATANTE atua como Controlador e a CONTRATADA atua como Operadora, tratando os dados conforme instruções do CONTRATANTE e limites necessários à prestação dos serviços.",
        "As regras detalhadas de tratamento de dados pessoais, segurança, suboperadores, transferência internacional, resposta a titulares, incidentes e cooperação constam no Anexo II — DPA.",
        "A CONTRATADA poderá atuar como Controladora em relação a dados próprios necessários à gestão da conta, cobrança, relacionamento comercial, segurança, prevenção a fraudes, marketing próprio e cumprimento legal, conforme a Política de Privacidade.",
      ],
    },
    {
      id: "seguranca",
      heading: "18. Segurança da informação",
      paragraphs: [
        "A CONTRATADA adotará medidas técnicas e organizacionais razoáveis para proteger a plataforma e os dados contra acessos não autorizados, perdas, alterações, destruição, vazamentos e usos indevidos.",
        "As medidas poderão incluir:",
      ],
      list: [
        "controle de acesso;",
        "autenticação;",
        "segregação lógica de ambientes;",
        "criptografia em trânsito;",
        "backups;",
        "logs;",
        "monitoramento;",
        "gestão de incidentes;",
        "revisão de permissões;",
        "boas práticas de desenvolvimento seguro.",
      ],
      afterListParagraphs: [
        "A política detalhada consta no Anexo III — Política de Segurança da Informação.",
      ],
    },
    {
      id: "limitacao-de-responsabilidade",
      heading: "19. Limitação de responsabilidade",
      paragraphs: [
        "Na máxima extensão permitida pela legislação aplicável, a responsabilidade total da CONTRATADA por danos decorrentes deste contrato ficará limitada ao valor efetivamente pago pelo CONTRATANTE nos 12 meses anteriores ao evento que gerou a reclamação.",
        "A CONTRATADA não será responsável por:",
      ],
      list: [
        "lucros cessantes;",
        "perda de receita;",
        "perda de oportunidade;",
        "danos indiretos, incidentais, especiais ou consequenciais;",
        "decisões comerciais tomadas com base em dados inseridos pelo CONTRATANTE;",
        "falhas de internet, energia, infraestrutura local ou dispositivos do CONTRATANTE;",
        "falhas de terceiros;",
        "atos de usuários, colaboradores, parceiros ou representantes do CONTRATANTE;",
        "exclusões, alterações ou erros de cadastro feitos pelo CONTRATANTE.",
      ],
      afterListParagraphs: [
        "Nada neste contrato limitará responsabilidade que não possa ser limitada por lei.",
      ],
    },
    {
      id: "garantias",
      heading: "20. Isenções e garantias",
      paragraphs: [
        "A plataforma é fornecida conforme disponível, respeitadas as obrigações contratuais expressas.",
        "A CONTRATADA não garante que a plataforma será livre de erros, falhas, interrupções, vulnerabilidades, incompatibilidades ou que atenderá a todas as necessidades específicas do CONTRATANTE sem customização ou contratação adicional.",
        "A CONTRATADA não presta consultoria contábil, fiscal, jurídica, trabalhista ou regulatória, salvo se contratado expressamente em instrumento separado.",
      ],
    },
    {
      id: "rescisao",
      heading: "21. Rescisão",
      paragraphs: [
        "O contrato poderá ser rescindido por solicitação do CONTRATANTE, por inadimplência, por violação contratual, por uso indevido, por risco à segurança da plataforma, por ordem legal, regulatória ou judicial, ou por descontinuidade comercial da plataforma, mediante aviso prévio razoável quando possível.",
        "Após a rescisão, a CONTRATADA poderá restringir acesso, iniciar período de retenção técnica e excluir dados conforme este contrato, a Política de Privacidade e o DPA.",
      ],
    },
    {
      id: "versionamento",
      heading: "22. Alterações, versionamento e aceite",
      paragraphs: [
        `Este contrato é identificado pela versão ${CURRENT_TERMS_DOCUMENT_VERSION}.`,
        "A CONTRATADA poderá atualizar este contrato para refletir alterações legais, técnicas, comerciais, operacionais, regulatórias ou de segurança.",
        "Alterações relevantes serão comunicadas por meio razoável, como e-mail, aviso na plataforma ou publicação no site.",
        "O uso contínuo da plataforma após a entrada em vigor de nova versão implica aceitação dos novos termos.",
        "A CONTRATADA poderá manter histórico de versões anteriores para fins de auditoria e transparência.",
      ],
    },
    {
      id: "investidores",
      heading: "23. Termos preparados para investidores",
      paragraphs: [
        "Este contrato foi estruturado para demonstrar maturidade operacional, previsibilidade jurídica, governança, proteção de dados, controle de risco e clareza comercial da plataforma.",
        "Este contrato não concede ao CONTRATANTE, usuário, parceiro, investidor potencial ou terceiro participação societária, direito de preferência, opção de compra, participação em receitas, acesso ao código-fonte, direito de auditoria irrestrita ou poder de gestão sobre a CONTRATADA ou sobre a plataforma.",
        "Qualquer relação com investidores, sócios, aceleradoras, fundos, parceiros estratégicos ou financiadores deverá ser formalizada por instrumento próprio.",
      ],
    },
    {
      id: "disposicoes-gerais",
      heading: "24. Disposições gerais",
      paragraphs: [
        "A tolerância de uma parte quanto ao descumprimento de qualquer obrigação não constituirá renúncia de direito.",
        "Se qualquer cláusula for considerada inválida, as demais permanecerão válidas e eficazes.",
        "O CONTRATANTE não poderá ceder este contrato sem autorização prévia da CONTRATADA.",
        "A CONTRATADA poderá ceder este contrato em caso de reorganização societária, venda de ativos, fusão, aquisição, investimento, sucessão empresarial ou mudança de estrutura jurídica.",
      ],
    },
    {
      id: "foro",
      heading: "25. Foro",
      paragraphs: [
        "Fica eleito o foro da comarca da sede da CONTRATADA, salvo disposição legal obrigatória em sentido diverso.",
      ],
    },
    {
      id: "anexo-sla",
      heading: "26. Anexo I — SLA Enterprise",
      paragraphs: [
        "Este anexo define níveis de serviço aplicáveis ao plano Enterprise, incluindo disponibilidade, cálculo de downtime, suporte prioritário, créditos contratuais e exclusões.",
      ],
      subsections: [
        {
          id: "sla-disponibilidade",
          heading: "26.1. Disponibilidade e downtime elegível",
          paragraphs: [
            "A CONTRATADA buscará manter disponibilidade mensal de 99,9% para clientes Enterprise.",
            "Será considerado downtime elegível o período em que o núcleo essencial da plataforma estiver indisponível para a maioria dos usuários do CONTRATANTE por falha diretamente atribuível à CONTRATADA.",
          ],
          list: [
            "manutenção programada ou emergencial de segurança;",
            "falhas causadas por provedores externos;",
            "falhas de internet, DNS, CDN, gateway de pagamento, APIs externas ou infraestrutura do CONTRATANTE;",
            "falhas decorrentes de credenciais incorretas, permissões, integrações ou configurações feitas pelo CONTRATANTE;",
            "indisponibilidade parcial que não impeça o uso principal da plataforma;",
            "bloqueios por inadimplência, violação contratual ou suspeita de fraude;",
            "eventos de força maior;",
            "ataques cibernéticos, DDoS ou exploração de vulnerabilidades, salvo culpa comprovada da CONTRATADA;",
            "uso acima dos limites contratados.",
          ],
        },
        {
          id: "sla-suporte-creditos",
          heading: "26.2. Suporte e créditos",
          paragraphs: [
            "Clientes Enterprise poderão receber canal prioritário dedicado e tempos de primeira resposta compatíveis com a severidade do incidente.",
            "Quando a disponibilidade mensal ficar abaixo de 99,9% por downtime elegível, o CONTRATANTE Enterprise poderá solicitar crédito contratual, aplicado preferencialmente na fatura seguinte.",
            "Os créditos não serão pagos em dinheiro, não serão cumulativos e constituem o remédio contratual exclusivo por descumprimento de SLA, salvo dolo, fraude, má-fé ou disposição expressa em contrato Enterprise específico.",
          ],
        },
      ],
    },
    {
      id: "anexo-dpa",
      heading: "27. Anexo II — DPA (LGPD / GDPR)",
      paragraphs: [
        "Este anexo regula o tratamento de dados pessoais realizado pela CONTRATADA em nome do CONTRATANTE no contexto da prestação dos serviços da plataforma Gestify.",
      ],
      subsections: [
        {
          id: "dpa-papeis",
          heading: "27.1. Papéis, finalidades e categorias",
          paragraphs: [
            "Para os dados pessoais inseridos pelo CONTRATANTE na plataforma, em regra, o CONTRATANTE atua como Controlador, a CONTRATADA atua como Operadora e terceiros de infraestrutura, hospedagem, banco de dados, autenticação, pagamento, suporte, logs e monitoramento poderão atuar como Suboperadores.",
            "A CONTRATADA tratará dados pessoais para disponibilizar e operar a plataforma, autenticar usuários, armazenar e processar dados inseridos pelo CONTRATANTE, prestar suporte técnico, processar pagamentos e cobranças, prevenir fraudes e abusos, monitorar segurança e estabilidade, cumprir obrigações legais, regulatórias e contratuais e melhorar funcionalidades quando permitido.",
          ],
        },
        {
          id: "dpa-seguranca-suboperadores",
          heading: "27.2. Segurança, suboperadores e atendimento a titulares",
          paragraphs: [
            "A CONTRATADA adotará medidas técnicas e organizacionais razoáveis, proporcionais ao risco, incluindo controle de acesso, autenticação, segregação lógica de dados, criptografia em trânsito, backups, logs de acesso, monitoramento de disponibilidade, restrição de privilégios administrativos, revisão de permissões e gestão de incidentes.",
            "O CONTRATANTE autoriza a contratação de suboperadores necessários à prestação dos serviços, incluindo provedores de cloud, banco de dados, autenticação, hospedagem, monitoramento, suporte, pagamento, comunicação e segurança.",
            "Quando a CONTRATADA receber solicitação de titular relacionada a dados tratados em nome do CONTRATANTE, poderá encaminhá-la ao próprio CONTRATANTE, salvo obrigação legal diversa.",
          ],
        },
      ],
    },
    {
      id: "anexo-seguranca",
      heading: "28. Anexo III — Política de Segurança da Informação",
      paragraphs: [
        "Esta política descreve medidas administrativas, técnicas e organizacionais adotadas para proteger a plataforma Gestify, seus ambientes, dados, acessos, integrações e infraestrutura.",
      ],
      subsections: [
        {
          id: "seguranca-principios",
          heading: "28.1. Princípios e controles",
          paragraphs: [
            "A CONTRATADA adota princípios de menor privilégio, necessidade de acesso, segregação lógica, rastreabilidade, prevenção, resposta rápida a incidentes, melhoria contínua e proteção proporcional ao risco.",
          ],
          list: [
            "contas individuais sempre que possível;",
            "restrição de acessos administrativos;",
            "revogação de acessos desnecessários;",
            "uso de autenticação segura;",
            "revisão periódica de permissões;",
            "separação entre acessos internos e acessos de clientes;",
            "registro de acessos relevantes quando tecnicamente disponível.",
          ],
        },
        {
          id: "seguranca-logs-incidentes",
          heading: "28.2. Logs, monitoramento e incidentes",
          paragraphs: [
            "A plataforma poderá manter logs técnicos para autenticação, diagnóstico de falhas, segurança, auditoria, prevenção de abuso, investigação de incidentes e melhoria da estabilidade.",
            "Incidentes com potencial impacto em dados pessoais serão tratados conforme o DPA e a legislação aplicável.",
            "A CONTRATADA buscará aplicar boas práticas de desenvolvimento seguro, atualização de dependências, proteção de variáveis sensíveis, validação de entradas, controle de erros, restrição de permissões em banco de dados e correção de vulnerabilidades conforme criticidade.",
          ],
        },
      ],
    },
    {
      id: "controle-de-versoes",
      heading: "29. Controle de versões",
      paragraphs: [
        "v1.0 — 23/04/2026 — Primeira versão contratual.",
        "v1.1 — 23/04/2026 — Ajustes de planos, cobrança e LGPD.",
        "v1.2 — 23/04/2026 — Inclusão de SLA, backup, DPA e segurança.",
        `v1.3 — ${CURRENT_TERMS_UPDATED_AT} — Versão robusta com anexos Enterprise, DPA nacional/internacional, política de segurança e termos preparados para investidores.`,
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
