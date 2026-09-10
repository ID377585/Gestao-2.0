import type { LegalDocument } from "@/lib/legal-content";

export const dpaDocument: LegalDocument = {
  slug: "/dpa",
  title: "Acordo de Tratamento de Dados Pessoais (DPA)",
  updatedAt: "09/09/2026",
  description: "Regras de tratamento de dados pessoais entre empresas clientes e o Gestify.",
  intro: [
    "Este Acordo de Tratamento de Dados Pessoais (DPA) complementa os Termos do Serviço e contratos específicos do Gestify. Em regra, a empresa cliente atua como Controladora dos dados pessoais que decide inserir na plataforma e a Gestify atua como Operadora, sem prejuízo das situações em que a Gestify atua como Controladora independente para finalidades próprias legítimas.",
    "Versão publicada: v2.0. Este documento não substitui instruções específicas, contrato especial ou obrigação legal aplicável ao tratamento em questão.",
  ],
  sections: [
    {
      id: "papeis",
      heading: "1. Papéis e escopo",
      paragraphs: [
        "A empresa cliente define as finalidades e instruções referentes aos dados pessoais utilizados em sua operação. A Gestify trata esses dados para disponibilizar, proteger, suportar e manter o serviço, dentro do contrato, das instruções documentadas e da legislação.",
        "A Gestify poderá atuar como Controladora independente para gestão de conta, segurança, prevenção a fraude, registros de acesso, relacionamento contratual, cobrança quando aplicável, cumprimento legal e exercício regular de direitos.",
      ],
    },
    {
      id: "instrucoes",
      heading: "2. Instruções documentadas e finalidade",
      paragraphs: [
        "A Gestify tratará dados sob responsabilidade da empresa cliente segundo instruções documentadas, os Termos, o contrato aplicável e as configurações legitimamente realizadas por administradores autorizados.",
        "Se uma instrução aparentar violar a legislação aplicável ou expuser terceiros a risco indevido, a Gestify poderá suspender sua execução e solicitar esclarecimentos.",
      ],
    },
    {
      id: "cliente",
      heading: "3. Obrigações da empresa cliente",
      list: [
        "garantir base legal, transparência, necessidade e qualidade dos dados inseridos;",
        "administrar usuários, perfis, permissões e credenciais pelo princípio do menor privilégio;",
        "não inserir dados sensíveis, credenciais, segredos ou documentos excessivos em campos não destinados a essa finalidade;",
        "atender titulares quando atuar como Controladora e acionar a Gestify quando precisar de assistência técnica razoável;",
        "comunicar incidentes, ordens ou solicitações relevantes que possam afetar o tratamento realizado na plataforma.",
      ],
    },
    {
      id: "gestify",
      heading: "4. Obrigações da Gestify",
      list: [
        "tratar dados somente para finalidades compatíveis com o serviço, instruções aplicáveis e obrigações legais;",
        "restringir acesso a pessoas e serviços que necessitem dele;",
        "adotar medidas técnicas e administrativas proporcionais ao risco;",
        "manter confidencialidade e trilhas de auditoria proporcionais;",
        "cooperar de maneira razoável com direitos de titulares, incidentes, auditorias e obrigações do Controlador;",
        "não comercializar dados operacionais do cliente como ativo próprio.",
      ],
    },
    {
      id: "seguranca",
      heading: "5. Segurança e segregação",
      paragraphs: [
        "Os controles podem incluir autenticação, gestão de sessões, autorização server-side, isolamento lógico por estabelecimento, Row Level Security quando aplicável, gestão de segredos, criptografia em trânsito, logs, monitoramento, backups e práticas de desenvolvimento seguro.",
        "Nenhuma medida representa garantia de invulnerabilidade. Controles e procedimentos evoluem de acordo com risco, arquitetura e maturidade operacional.",
      ],
    },
    {
      id: "suboperadores",
      heading: "6. Suboperadores e fornecedores",
      paragraphs: [
        "A Gestify pode utilizar provedores de infraestrutura, banco de dados, autenticação, hospedagem, e-mail, observabilidade, suporte, segurança e continuidade. Eles devem receber acesso limitado ao necessário e obrigações compatíveis de confidencialidade, segurança e proteção de dados.",
        "Mudanças materiais na cadeia de tratamento serão administradas conforme contrato, legislação e mecanismos de transparência disponíveis.",
      ],
    },
    {
      id: "transferencias",
      heading: "7. Transferências internacionais",
      paragraphs: [
        "Quando houver transferência internacional de dados pessoais, serão observados os mecanismos admitidos pela LGPD e pela regulamentação vigente da ANPD, considerando o fluxo de dados, o papel das partes e as condições do destinatário.",
      ],
    },
    {
      id: "titulares",
      heading: "8. Direitos dos titulares",
      paragraphs: [
        "Quando a empresa cliente for Controladora, ela permanece o ponto principal de decisão sobre solicitações de titulares. A Gestify prestará assistência técnica razoável para localizar, corrigir, exportar, restringir, anonimizar ou eliminar dados quando aplicável e tecnicamente possível.",
        "A identidade e legitimidade do solicitante poderão ser verificadas antes de qualquer entrega ou alteração de dados.",
      ],
    },
    {
      id: "incidentes",
      heading: "9. Incidentes de segurança",
      paragraphs: [
        "Incidentes relevantes serão registrados, triados, contidos, investigados e avaliados. Quando a Gestify atuar como Operadora, comunicará o Controlador afetado sem demora indevida após obter informações suficientes sobre incidente relevante sob sua esfera.",
        "Quando a Gestify atuar como Controladora, observará os requisitos e prazos regulamentares vigentes para eventual comunicação à ANPD e aos titulares.",
      ],
    },
    {
      id: "retencao",
      heading: "10. Retenção, exportação e eliminação",
      paragraphs: [
        "Dados operacionais são mantidos durante a prestação do serviço e a janela técnica de devolução, exportação, backup e eliminação aplicável. Obrigações legais, segurança, antifraude, auditoria e exercício de direitos podem justificar retenção adicional restrita.",
        "Após encerramento, o cliente deve solicitar exportação dentro da janela contratual aplicável. Backups podem seguir ciclo técnico próprio até expiração segura.",
      ],
    },
    {
      id: "auditoria",
      heading: "11. Evidências e auditoria proporcional",
      paragraphs: [
        "A Gestify poderá fornecer evidências razoáveis de conformidade, observados confidencialidade, segurança, segredo comercial, dados de terceiros e isolamento entre clientes. O DPA não concede acesso irrestrito à infraestrutura, código-fonte ou dados de outros tenants.",
      ],
    },
    {
      id: "contato",
      heading: "12. Canal de privacidade",
      paragraphs: [
        "Encarregado/DPO informado pela Gestify: Ivan da Silva Fernandes Escobar. Canal de privacidade: atendimento@ntsolution.com.br.",
      ],
    },
  ],
};

export const securityPolicyDocument: LegalDocument = {
  slug: "/seguranca-da-informacao",
  title: "Política de Segurança da Informação",
  updatedAt: "09/09/2026",
  description: "Resumo público dos princípios e controles de segurança aplicáveis ao Gestify.",
  intro: [
    "A segurança do Gestify é tratada como requisito contínuo de produto, infraestrutura e operação. Esta política pública descreve princípios e controles em nível apropriado para transparência, sem revelar segredos, configurações sensíveis ou detalhes que reduzam a segurança do ambiente.",
  ],
  sections: [
    {
      id: "principios",
      heading: "1. Princípios",
      list: [
        "menor privilégio e necessidade de acesso;",
        "defesa em profundidade;",
        "segregação lógica entre empresas;",
        "autenticação e autorização em camadas;",
        "minimização de dados e segredos;",
        "rastreabilidade proporcional;",
        "mudanças controladas e revisão contínua de risco.",
      ],
    },
    {
      id: "identidade",
      heading: "2. Identidade, autenticação e sessões",
      paragraphs: [
        "O Gestify utiliza mecanismos de autenticação e sessão compatíveis com sua arquitetura. Contas administrativas e acessos sensíveis podem exigir controles reforçados, inclusive autenticação multifator quando configurada ou exigida.",
        "Usuários são responsáveis por credenciais individuais, dispositivos confiáveis e comunicação imediata de suspeita de comprometimento.",
      ],
    },
    {
      id: "autorizacao",
      heading: "3. Autorização e isolamento multiempresa",
      paragraphs: [
        "O acesso é condicionado a vínculos e permissões do estabelecimento. Controles de tenant, autorização server-side e Row Level Security são utilizados quando aplicáveis para impedir acesso indevido entre empresas.",
      ],
    },
    {
      id: "aplicacao",
      heading: "4. Aplicação e desenvolvimento seguro",
      list: [
        "validação de entradas e regras de autorização;",
        "gestão de dependências e vulnerabilidades;",
        "headers de segurança e proteção de navegador quando aplicável;",
        "segredos fora do código-fonte;",
        "revisões, testes e verificações automatizadas antes de promoção de mudanças;",
        "separação entre ambientes de desenvolvimento, preview/staging e produção quando suportada pela arquitetura.",
      ],
    },
    {
      id: "dados",
      heading: "5. Banco de dados, storage e dados",
      paragraphs: [
        "A proteção considera controle de acesso, isolamento lógico, transmissão protegida, minimização, backups e restrição de recursos sensíveis. Arquivos sensíveis devem permanecer privados e ser disponibilizados por mecanismos controlados quando aplicável.",
      ],
    },
    {
      id: "monitoramento",
      heading: "6. Logs, monitoramento e resposta",
      paragraphs: [
        "Eventos relevantes podem gerar logs e trilhas de auditoria para segurança, diagnóstico, investigação, antifraude e continuidade. Incidentes são triados e tratados de acordo com criticidade e impacto.",
      ],
    },
    {
      id: "continuidade",
      heading: "7. Backup e continuidade",
      paragraphs: [
        "O Gestify mantém e evolui procedimentos de backup, restauração e recuperação de desastre compatíveis com o estágio técnico do serviço. Metas de RPO, RTO ou recuperação integral somente são consideradas compromisso quando formalmente contratadas e tecnicamente comprovadas.",
        "Clientes devem manter cópias independentes de documentos e registros legalmente críticos quando sua operação exigir disponibilidade ou retenção específica.",
      ],
    },
    {
      id: "fornecedores",
      heading: "8. Fornecedores",
      paragraphs: [
        "Fornecedores são avaliados de forma proporcional ao risco e recebem somente o acesso necessário. Dependências de terceiros não eliminam a responsabilidade da Gestify por controles sob sua esfera.",
      ],
    },
    {
      id: "vulnerabilidades",
      heading: "9. Comunicação de vulnerabilidades",
      paragraphs: [
        "Suspeitas de vulnerabilidade, acesso indevido ou incidente devem ser comunicadas de forma responsável para atendimento@ntsolution.com.br, sem exploração além do necessário para demonstrar o problema e sem acesso a dados de terceiros.",
      ],
    },
    {
      id: "evolucao",
      heading: "10. Melhoria contínua",
      paragraphs: [
        "Controles são revisados conforme mudanças de arquitetura, legislação, risco, uso e evidências operacionais. Esta política não declara invulnerabilidade nem certificação que não tenha sido formalmente obtida.",
      ],
    },
  ],
};
