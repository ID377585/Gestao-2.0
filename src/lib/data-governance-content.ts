import type { LegalDocument } from "@/lib/legal-content";

export const dataGovernancePolicyDocument: LegalDocument = {
  slug: "/governanca-e-protecao-de-dados",
  title: "Política de Governança e Proteção de Dados",
  updatedAt: "02/09/2026",
  description:
    "Conheça as regras de governança, proteção, retenção, segurança e tratamento de dados aplicáveis ao Gestify.",
  intro: [
    "Esta Política complementa a Política de Privacidade, os Termos do Serviço, o DPA e a Política de Cookies do Gestify. Seu objetivo é tornar transparentes as regras de governança utilizadas para tratar dados pessoais, dados pessoais sensíveis, dados de usuários e dados corporativos armazenados ou processados pela plataforma.",
    "A proteção de dados é tratada como requisito de produto e de segurança. As medidas descritas são aplicadas de forma proporcional ao risco, à natureza do tratamento, ao papel exercido pela Gestify e às obrigações legais e contratuais aplicáveis.",
  ],
  sections: [
    {
      id: "principios",
      heading: "1. Princípios obrigatórios de tratamento",
      paragraphs: [
        "O Gestify orienta seus tratamentos pelos princípios previstos na LGPD, incluindo finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação e responsabilização e prestação de contas.",
      ],
      list: [
        "coletar e manter somente dados adequados e necessários para finalidades legítimas;",
        "evitar reutilização incompatível com a finalidade informada;",
        "restringir acessos conforme função, tenant e necessidade;",
        "proteger dados durante coleta, transmissão, armazenamento, uso, exportação e descarte;",
        "manter evidências proporcionais de decisões, acessos, aceites, incidentes e solicitações;",
        "revisar riscos e controles quando novas funcionalidades ampliarem o tratamento de dados pessoais.",
      ],
    },
    {
      id: "papeis",
      heading: "2. Controlador, Operador e responsabilidades",
      paragraphs: [
        "Quando a NT Solution/Gestify define finalidade e meios essenciais do tratamento — por exemplo, gestão de contas próprias, contratação, cobrança, suporte, segurança, prevenção a fraude e relacionamento — atua como Controladora.",
        "Quando uma empresa cliente utiliza o Gestify para tratar dados de seus empregados, colaboradores, fornecedores, clientes ou outros titulares para suas próprias finalidades, em regra a empresa cliente atua como Controladora e a Gestify como Operadora, observadas as instruções documentadas, o contrato, o DPA e a legislação.",
        "A empresa cliente é responsável pela licitude, transparência, qualidade, necessidade e base legal dos dados que decide inserir na plataforma. A Gestify é responsável por executar o tratamento sob sua esfera de controle com segurança e conforme as instruções aplicáveis, sem prejuízo das responsabilidades inderrogáveis previstas em lei.",
      ],
    },
    {
      id: "sensivels",
      heading: "3. Dados pessoais sensíveis e dados de maior risco",
      paragraphs: [
        "Dados pessoais sensíveis exigem proteção reforçada e somente devem ser inseridos ou tratados quando houver necessidade real, finalidade determinada e base legal adequada. Isso inclui dados sobre origem racial ou étnica, convicção religiosa, opinião política, filiação sindical, dados referentes à saúde ou vida sexual e dados genéticos ou biométricos vinculados a pessoa natural.",
        "O cliente não deve utilizar campos livres para armazenar dados sensíveis, documentos, segredos, credenciais ou informações excessivas quando a funcionalidade não tiver sido projetada para essa finalidade.",
      ],
      list: [
        "aplicar minimização e acesso por menor privilégio;",
        "evitar exposição em logs, URLs, mensagens de erro e analytics;",
        "restringir exportações e compartilhamentos ao necessário;",
        "avaliar necessidade de relatório de impacto quando o tratamento puder gerar alto risco;",
        "não utilizar dados sensíveis para publicidade comportamental ou finalidade incompatível com a origem do dado.",
      ],
    },
    {
      id: "bases-legais",
      heading: "4. Bases legais e consentimento",
      paragraphs: [
        "Consentimento não é utilizado como base legal universal. Cada tratamento deve estar associado à base legal adequada ao contexto, podendo envolver execução de contrato, procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse dentro dos limites legais ou consentimento quando efetivamente cabível.",
        "Quando o tratamento depender de consentimento, o Gestify buscará registrar versão do documento, manifestação positiva, data e hora e demais evidências tecnicamente disponíveis. A recusa ou revogação não deverá produzir consequências além das necessárias para tratamentos que dependam daquela autorização.",
      ],
    },
    {
      id: "retencao",
      heading: "5. Retenção, bloqueio, anonimização e descarte",
      paragraphs: [
        "Dados não devem permanecer identificáveis por prazo indeterminado sem finalidade ou fundamento. A retenção considera a finalidade original, contrato, obrigações legais e regulatórias, segurança, prevenção a fraude, auditoria e exercício regular de direitos.",
        "Prazos concretos podem variar conforme a categoria de dado e a relação jurídica. O encerramento da conta não implica eliminação instantânea quando houver obrigação ou fundamento legítimo para retenção temporária.",
      ],
      list: [
        "dados de conta e autenticação: durante a relação e pelo período necessário para segurança, auditoria e defesa de direitos;",
        "logs de segurança e acesso: pelo período necessário para investigação, prevenção a fraude, auditoria e estabilidade, com minimização;",
        "registros de aceite: pelo período necessário para prova contratual, obrigação legal e defesa de direitos;",
        "dados operacionais do cliente: durante a prestação do serviço e a janela técnica de devolução, exportação, backup e eliminação aplicável;",
        "dados fiscais, financeiros e de cobrança: conforme obrigações legais, contábeis, fiscais e exercício de direitos;",
        "leads e marketing: enquanto existir base legal válida ou até oposição/revogação quando aplicável;",
        "solicitações de titulares: pelo período necessário para comprovar atendimento e exercer direitos.",
      ],
      afterListParagraphs: [
        "Quando a eliminação imediata de backups não for tecnicamente possível, os dados permanecerão protegidos e fora do uso operacional até a expiração do ciclo técnico aplicável, salvo necessidade legítima de restauração.",
      ],
    },
    {
      id: "direitos",
      heading: "6. Direitos dos titulares e autenticação da solicitação",
      paragraphs: [
        "Titulares podem exercer os direitos previstos na LGPD pelos canais de privacidade informados pela Gestify ou, quando a empresa cliente for a Controladora, diretamente perante essa empresa. A Gestify poderá solicitar informações razoavelmente necessárias para confirmar identidade, representação e escopo do pedido, evitando entregar dados a pessoa não autorizada.",
        "As respostas observarão os prazos legais aplicáveis. Quando o Gestify atuar como Operadora, poderá encaminhar a solicitação ao Controlador e prestar a assistência técnica razoavelmente necessária para atendimento.",
      ],
      list: [
        "confirmação e acesso;",
        "correção;",
        "anonimização, bloqueio ou eliminação quando cabível;",
        "portabilidade quando regulamentada e tecnicamente aplicável;",
        "informações sobre compartilhamentos;",
        "revogação de consentimento e eliminação de dados baseados em consentimento, ressalvadas hipóteses legais de conservação;",
        "oposição a tratamento realizado em desconformidade com a LGPD;",
        "revisão das hipóteses legalmente aplicáveis de decisões automatizadas.",
      ],
    },
    {
      id: "seguranca",
      heading: "7. Segurança, segregação e acesso",
      paragraphs: [
        "O Gestify adota controles técnicos e administrativos proporcionais aos riscos para prevenir acesso não autorizado, perda, alteração, destruição, vazamento e tratamento inadequado ou ilícito.",
      ],
      list: [
        "isolamento lógico entre empresas e validação de tenant;",
        "Row Level Security e controles de autorização no banco quando aplicável;",
        "menor privilégio e revisão de permissões;",
        "autenticação e gestão de sessões;",
        "criptografia em trânsito e mecanismos de proteção oferecidos pela infraestrutura de armazenamento;",
        "logs, rastreabilidade, monitoramento e alertas proporcionais ao risco;",
        "gestão de vulnerabilidades, dependências, segredos e alterações;",
        "backups, continuidade e procedimentos de restauração;",
        "ambientes e credenciais administrativas restritos.",
      ],
    },
    {
      id: "incidentes",
      heading: "8. Incidentes de segurança e comunicação",
      paragraphs: [
        "Incidentes envolvendo dados pessoais são registrados, triados, contidos, investigados e avaliados quanto a natureza, extensão, categorias de dados, quantidade de titulares, medidas de proteção existentes e potencial de risco ou dano relevante.",
        "Quando a Gestify atuar como Operadora, comunicará o Controlador afetado sem demora indevida após obter informações suficientes sobre incidente relevante sob sua esfera, de modo a permitir que o Controlador cumpra suas obrigações legais.",
        "Quando a Gestify atuar como Controladora e o incidente puder acarretar risco ou dano relevante aos titulares, a comunicação à ANPD e aos titulares será realizada conforme os requisitos e o prazo regulamentar vigente, atualmente de até 3 dias úteis contados do conhecimento de que o incidente afetou dados pessoais, ressalvadas hipóteses legais ou regulamentares específicas.",
      ],
    },
    {
      id: "suboperadores",
      heading: "9. Fornecedores e suboperadores",
      paragraphs: [
        "O Gestify pode contratar provedores de infraestrutura, hospedagem, banco de dados, autenticação, e-mail, observabilidade, pagamentos, suporte e segurança necessários à prestação do serviço. A contratação não afasta as responsabilidades que caibam à Gestify sob a legislação e o contrato.",
        "Suboperadores devem receber somente o acesso necessário ao serviço que prestam e estar sujeitos a obrigações compatíveis de confidencialidade, segurança e proteção de dados. Mudanças materiais na cadeia de tratamento serão geridas conforme contrato e DPA aplicáveis.",
      ],
    },
    {
      id: "transferencia",
      heading: "10. Transferência internacional de dados",
      paragraphs: [
        "Fornecedores utilizados pelo Gestify podem processar ou armazenar dados fora do Brasil. Transferências internacionais de dados pessoais devem observar os mecanismos admitidos pela LGPD e pela regulamentação da ANPD, incluindo decisão de adequação, garantias contratuais reconhecidas, cláusulas-padrão contratuais ou outros mecanismos legalmente aplicáveis.",
        "A escolha do mecanismo considera o fluxo de dados, o papel das partes e a localização e condições do destinatário. O simples uso de infraestrutura global não elimina as obrigações de transparência, segurança e governança aplicáveis.",
      ],
    },
    {
      id: "privacy-by-design",
      heading: "11. Privacy by design, minimização e novas funcionalidades",
      paragraphs: [
        "Novos módulos e alterações relevantes devem considerar proteção de dados desde a especificação, incluindo necessidade de coleta, finalidade, base legal, campos obrigatórios, permissões, tenant, logs, exportação, retenção e descarte.",
        "Funcionalidades de maior risco podem exigir avaliação adicional, testes de isolamento, revisão de segurança ou relatório de impacto antes de disponibilização ampla.",
      ],
    },
    {
      id: "auditoria",
      heading: "12. Evidências, auditoria e prestação de contas",
      paragraphs: [
        "A Gestify busca manter evidências proporcionais que permitam demonstrar diligência e conformidade, como versionamento de documentos jurídicos, registros de aceite, trilhas de auditoria, histórico de alterações de segurança, inventário de fornecedores, registros de incidentes, testes de continuidade e evidências de atendimento a solicitações.",
        "Auditorias e pedidos de informação devem respeitar confidencialidade, segurança, segredo comercial, dados de terceiros e limites técnicos razoáveis, sem permitir acesso irrestrito ao ambiente de outros clientes.",
      ],
    },
    {
      id: "responsabilidades",
      heading: "13. Responsabilidades e limites",
      paragraphs: [
        "Cada parte responde pelas atividades de tratamento sob sua responsabilidade e deve cooperar de boa-fé para prevenção e mitigação de danos. Nenhuma disposição desta Política pretende excluir ou limitar responsabilidade que não possa ser excluída ou limitada por lei.",
        "O cliente deve administrar seus usuários, permissões e credenciais; informar adequadamente seus titulares; definir bases legais; evitar coleta excessiva; manter dados corretos; e comunicar à Gestify situações que exijam assistência como Operadora.",
      ],
    },
    {
      id: "contato",
      heading: "14. Encarregado e canal de privacidade",
      paragraphs: [
        "Encarregado/DPO informado pela Gestify: Ivan da Silva Fernandes Escobar.",
        "Canal de privacidade: atendimento@ntsolution.com.br. Solicitações devem conter informações suficientes para identificação segura do solicitante e do contexto do pedido, sem envio desnecessário de dados sensíveis por canal aberto.",
      ],
    },
    {
      id: "alteracoes",
      heading: "15. Versionamento e alterações",
      paragraphs: [
        "Esta Política poderá ser atualizada em razão de mudanças legais, regulatórias, técnicas, de segurança ou de operação. Alterações materiais serão versionadas e comunicadas por meio razoável quando necessário. A versão vigente e sua data de atualização permanecerão publicadas no site.",
        "Esta Política deve ser interpretada em conjunto com a Política de Privacidade, os Termos do Serviço, o DPA, a Política de Cookies e contratos específicos. Em caso de conflito, prevalecerá a disposição legal obrigatória e, entre instrumentos contratuais, a regra mais específica aplicável ao tratamento em questão.",
      ],
    },
  ],
};
