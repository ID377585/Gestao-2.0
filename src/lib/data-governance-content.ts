import type { LegalDocument } from "@/lib/legal-content";

export const dataGovernancePolicyDocument: LegalDocument = {
  slug: "/governanca-e-protecao-de-dados",
  title: "Política de Governança e Proteção de Dados",
  updatedAt: "09/09/2026",
  description:
    "Conheça as regras de governança, proteção, retenção, segurança e tratamento de dados aplicáveis ao Gestify.",
  intro: [
    "Esta Política complementa a Política de Privacidade, os Termos do Serviço, o DPA e a Política de Cookies do Gestify. Seu objetivo é tornar transparentes as regras de governança utilizadas para tratar dados pessoais, dados pessoais sensíveis, dados de usuários e dados corporativos armazenados ou processados pela plataforma.",
    "A proteção de dados é requisito de produto, contrato, segurança e operação. O Gestify não considera um tratamento conforme apenas porque existe uma cláusula jurídica: devem existir finalidade, base legal, responsável, procedimento executável e evidência compatível com o tratamento efetivamente realizado.",
  ],
  sections: [
    {
      id: "principios",
      heading: "1. Princípios obrigatórios de tratamento",
      paragraphs: [
        "O Gestify orienta seus tratamentos pelos princípios previstos na LGPD, incluindo finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação e responsabilização e prestação de contas.",
      ],
      list: [
        "coletar e manter somente dados adequados e necessários para finalidades legítimas e documentadas;",
        "não reutilizar dados para finalidade incompatível sem nova avaliação jurídica e transparência adequada;",
        "restringir acessos conforme função, tenant, necessidade e menor privilégio;",
        "proteger dados durante coleta, transmissão, armazenamento, uso, exportação, backup e descarte;",
        "manter evidências proporcionais de decisões, acessos, aceites, incidentes, solicitações e eliminações;",
        "revisar riscos e controles antes de funcionalidades que ampliem materialmente o tratamento de dados pessoais.",
      ],
    },
    {
      id: "papeis",
      heading: "2. Controlador, Operador e responsabilidades",
      paragraphs: [
        "Quando a NT Solution/Gestify define finalidade e meios essenciais do tratamento — por exemplo, gestão de contas próprias, contratação, cobrança, suporte, segurança, prevenção a fraude e relacionamento — atua como Controladora.",
        "Quando uma empresa cliente utiliza o Gestify para tratar dados de seus empregados, colaboradores, fornecedores, clientes ou outros titulares para suas próprias finalidades, em regra a empresa cliente atua como Controladora e a Gestify como Operadora, observadas as instruções documentadas, o contrato, o DPA e a legislação.",
        "A empresa cliente responde pelas decisões de tratamento sob sua esfera, incluindo licitude, transparência, qualidade, necessidade e base legal dos dados que decide inserir. A Gestify responde pelas atividades de tratamento sob sua esfera e, quando Operadora, deve seguir instruções lícitas e documentadas, sem prejuízo das responsabilidades inderrogáveis previstas em lei.",
        "Se uma instrução do cliente aparentar violar lei, contrato, direitos de terceiros ou controles essenciais de segurança, a execução poderá ser suspensa e escalada para avaliação de Privacidade/Legal antes de prosseguir.",
      ],
    },
    {
      id: "sensivels",
      heading: "3. Dados pessoais sensíveis, biometria e dados de maior risco",
      paragraphs: [
        "Dados pessoais sensíveis somente devem ser tratados quando houver necessidade real, finalidade determinada, base legal adequada e controles reforçados. Isso inclui origem racial ou étnica, convicção religiosa, opinião política, filiação sindical, dados referentes à saúde ou vida sexual e dados genéticos ou biométricos vinculados a pessoa natural.",
        "O cliente não deve utilizar campos livres para armazenar dados sensíveis, documentos, segredos, credenciais ou informações excessivas quando a funcionalidade não tiver sido projetada e aprovada para essa finalidade.",
        "Funcionalidades biométricas não são consideradas juridicamente autorizadas apenas pela aceitação genérica dos Termos. Antes de ativação ampla devem existir avaliação de impacto, finalidade específica, base legal, ciclo de retenção/eliminação, controles de acesso, procedimento alternativo quando aplicável e instruções contratuais compatíveis.",
      ],
      list: [
        "aplicar minimização e acesso por menor privilégio;",
        "evitar exposição em logs, URLs, mensagens de erro e analytics;",
        "restringir exportações e compartilhamentos ao necessário;",
        "realizar RIPD/DPIA interno para biometria, decisões de alto impacto e outros tratamentos de risco elevado;",
        "não utilizar dados sensíveis ou biométricos para publicidade comportamental ou finalidade incompatível com a origem do dado;",
        "evitar retenção de imagem biométrica original quando um template tecnicamente adequado for suficiente para a finalidade aprovada.",
      ],
    },
    {
      id: "menores",
      heading: "4. Crianças, adolescentes e pessoas vulneráveis",
      paragraphs: [
        "O Gestify não é projetado como serviço destinado a crianças. Funcionalidades que intencionalmente tratem dados de crianças ou adolescentes somente poderão ser disponibilizadas após avaliação específica do melhor interesse, base legal, transparência, minimização e requisitos de responsável legal quando aplicáveis.",
        "Clientes não devem cadastrar dados de menores em campos genéricos apenas por conveniência operacional. Um caso de uso que exija esse tratamento deve ser previamente identificado e submetido à governança de privacidade.",
      ],
    },
    {
      id: "bases-legais",
      heading: "5. Bases legais e consentimento",
      paragraphs: [
        "Consentimento não é utilizado como base legal universal. Cada finalidade deve estar associada à hipótese legal adequada ao contexto, podendo envolver execução de contrato ou procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse dentro dos limites legais ou consentimento quando efetivamente cabível.",
        "Quando o tratamento depender de consentimento, o Gestify deve registrar a versão do documento, manifestação positiva, data/hora e evidências razoáveis do contexto. A revogação deve ser facilitada e não pode retirar direitos ou gerar consequências além das necessárias para tratamentos que efetivamente dependam daquela autorização.",
        "Quando legítimo interesse for a base escolhida, o tratamento deve passar por avaliação de necessidade, expectativa razoável, impacto sobre direitos/liberdades e medidas de mitigação, com registro da decisão.",
      ],
    },
    {
      id: "retencao",
      heading: "6. Retenção, bloqueio, anonimização, eliminação e legal hold",
      paragraphs: [
        "Dados não devem permanecer identificáveis por prazo indeterminado sem finalidade ou fundamento. Cada categoria relevante deve possuir regra operacional de retenção que identifique finalidade, evento inicial, prazo ou critério objetivo, responsável, método de descarte e exceções legais.",
        "O encerramento da conta não implica eliminação instantânea quando houver obrigação legal, exercício regular de direitos, prevenção a fraude, investigação de incidente ou legal hold específico. Essas exceções não autorizam retenção indiscriminada de todos os dados do cliente.",
      ],
      list: [
        "dados de conta e autenticação: durante a relação e pelo período objetivamente definido para segurança, auditoria e defesa de direitos;",
        "registros de acesso sujeitos ao Marco Civil: preservados pelo período legal aplicável, quando a obrigação se aplicar ao tipo de registro e à atividade;",
        "registros de aceite: enquanto necessários para prova contratual, obrigação legal e defesa de direitos;",
        "dados operacionais do cliente: durante a prestação do serviço e janela contratual de exportação/encerramento, seguida de eliminação ou anonimização, ressalvadas retenções legalmente justificadas;",
        "dados fiscais, financeiros e de cobrança: conforme obrigações legais, contábeis, fiscais e exercício de direitos;",
        "leads e marketing: enquanto existir base legal válida ou até oposição/revogação quando aplicável;",
        "solicitações de titulares e incidentes: pelo período necessário para demonstrar atendimento, investigação, obrigações regulatórias e exercício de direitos;",
        "biometria, quando habilitada: somente pelo tempo necessário à finalidade aprovada e sob regra específica de exclusão.",
      ],
      afterListParagraphs: [
        "Quando a eliminação imediata de backups não for tecnicamente possível, cópias permanecem protegidas e fora do uso operacional normal até a expiração do ciclo de backup. Se um backup antigo for restaurado, eliminações e correções válidas devem ser reaplicadas antes do ambiente restaurado retornar à operação normal.",
      ],
    },
    {
      id: "direitos",
      heading: "7. Direitos dos titulares e autenticação da solicitação",
      paragraphs: [
        "Titulares podem exercer direitos pelos canais de privacidade informados pela Gestify ou, quando a empresa cliente for a Controladora, diretamente perante essa empresa. A Gestify poderá solicitar apenas informações razoavelmente necessárias para confirmar identidade, representação e escopo, evitando revelar dados a pessoa não autorizada.",
        "Quando a Gestify atuar como Controladora, solicitações de confirmação e acesso serão tratadas conforme a LGPD: confirmação/acesso simplificado quando cabível de forma imediata e resposta completa nos prazos legais aplicáveis, incluindo a referência de até 15 dias para a declaração completa prevista na LGPD. O exercício dos direitos legais não é cobrado do titular.",
        "Quando o Gestify atuar como Operadora, encaminhará a solicitação ao Controlador competente e prestará a assistência técnica necessária dentro do escopo contratual, preservando trilha de auditoria.",
      ],
      list: [
        "confirmação e acesso;",
        "correção;",
        "anonimização, bloqueio ou eliminação quando cabível;",
        "portabilidade quando regulamentada e tecnicamente aplicável;",
        "informações sobre uso compartilhado;",
        "revogação de consentimento e eliminação de dados baseados em consentimento, ressalvadas hipóteses legais de conservação;",
        "oposição a tratamento realizado em desconformidade com a LGPD;",
        "revisão e explicação das hipóteses legalmente aplicáveis de decisões automatizadas.",
      ],
    },
    {
      id: "decisoes-automatizadas",
      heading: "8. Decisões automatizadas, perfilamento e inteligência artificial",
      paragraphs: [
        "Funcionalidades automatizadas que possam afetar de forma relevante interesses de pessoas devem ser inventariadas e avaliadas quanto a finalidade, base legal, transparência, segurança, vieses e possibilidade de revisão nos casos previstos em lei.",
        "Dados pessoais de clientes não devem ser enviados a provedores externos de inteligência artificial para treinamento ou reutilização incompatível sem base jurídica, contrato, transparência, controle de retenção e transferência internacional compatíveis.",
        "O Gestify deve manter um caminho de revisão/contestação quando a lei ou o risco da funcionalidade assim exigir, sem divulgar segredos comerciais além do necessário para cumprir os direitos do titular.",
      ],
    },
    {
      id: "seguranca",
      heading: "9. Segurança, segregação e acesso",
      paragraphs: [
        "O Gestify adota controles técnicos e administrativos proporcionais aos riscos para prevenir acesso não autorizado, perda, alteração, destruição, vazamento e tratamento inadequado ou ilícito. Os controles devem corresponder ao estado real da plataforma e ser verificados por evidência técnica, não apenas por declaração contratual.",
      ],
      list: [
        "isolamento lógico entre empresas e validação de tenant;",
        "Row Level Security e controles de autorização no banco quando aplicável;",
        "menor privilégio e revisão de permissões;",
        "autenticação, gestão de sessões e proteção de credenciais;",
        "criptografia em trânsito e proteções de armazenamento oferecidas pela infraestrutura contratada;",
        "logs, rastreabilidade, monitoramento e alertas proporcionais ao risco, sem registrar conteúdo desnecessário;",
        "gestão de vulnerabilidades, dependências, segredos e alterações;",
        "backups, continuidade e procedimentos de restauração;",
        "ambientes e credenciais administrativas restritos;",
        "revogação de acessos privilegiados após desligamento ou mudança de função.",
      ],
    },
    {
      id: "incidentes",
      heading: "10. Incidentes de segurança e comunicação",
      paragraphs: [
        "Incidentes envolvendo dados pessoais são registrados, triados, contidos, investigados e avaliados quanto a natureza, extensão, categorias de dados, quantidade/categorias de titulares, tenants afetados, medidas de proteção existentes e potencial de risco ou dano relevante.",
        "Quando a Gestify atuar como Operadora, a meta operacional é comunicar o Controlador afetado assim que houver informação minimamente confiável e, ordinariamente, em até 24 horas da confirmação de incidente material sob sua esfera que afete dados daquele Controlador. Essa janela interna não altera a responsabilidade legal do Controlador e não autoriza atrasar comunicação que possa ser feita antes.",
        "Quando a Gestify atuar como Controladora e o incidente puder acarretar risco ou dano relevante, a comunicação à ANPD e aos titulares observará a Resolução CD/ANPD nº 15/2024 e o prazo regulamentar vigente, atualmente de até 3 dias úteis, sem esperar indevidamente a conclusão perfeita da investigação quando for possível complementar informações posteriormente.",
        "Incidentes não comunicados externamente também devem permanecer registrados com a justificativa da decisão.",
      ],
    },
    {
      id: "suboperadores",
      heading: "11. Fornecedores e suboperadores",
      paragraphs: [
        "O Gestify pode contratar provedores de infraestrutura, hospedagem, banco de dados, autenticação, e-mail, observabilidade, pagamentos, suporte e segurança necessários à prestação do serviço. A contratação não afasta as responsabilidades que caibam à Gestify sob a legislação e o contrato.",
        "Antes de processar dados pessoais em Production, fornecedores relevantes devem passar por registro de finalidade, categorias de dados, papel, localidades, controles de segurança, retenção/eliminação, obrigação de incidente, cadeia de suboperadores e plano de saída. Acesso deve ser limitado ao mínimo necessário.",
        "Mudanças materiais na cadeia de suboperadores serão tratadas conforme o DPA/contrato aplicável, com registro e transparência adequados.",
      ],
    },
    {
      id: "transferencia",
      heading: "12. Transferência internacional de dados",
      paragraphs: [
        "Fornecedores utilizados pelo Gestify podem processar ou armazenar dados fora do Brasil. Cada fluxo internacional aplicável deve possuir tanto uma hipótese legal para o tratamento quanto um mecanismo válido de transferência internacional previsto na LGPD e na regulamentação da ANPD.",
        "Quando forem utilizadas as cláusulas-padrão contratuais aprovadas pela Resolução CD/ANPD nº 19/2024, o texto obrigatório deverá ser incorporado de acordo com a norma, sem alterações incompatíveis. O uso de infraestrutura global, por si só, não é mecanismo jurídico de transferência.",
        "A transparência da transferência deve identificar, quando exigido, forma/duração/finalidade, países de destino, responsabilidades, medidas de segurança, compartilhamentos e canal para exercício de direitos. A lista operacional de fornecedores e destinos deve ser mantida a partir das configurações e contratos reais, sem inferências sobre país apenas pela sede do fornecedor.",
      ],
    },
    {
      id: "privacy-by-design",
      heading: "13. Privacy by design, minimização e novas funcionalidades",
      paragraphs: [
        "Novos módulos e alterações relevantes devem considerar proteção de dados desde a especificação, incluindo necessidade de coleta, finalidade, base legal, campos obrigatórios, permissões, tenant, logs, exportação, retenção, eliminação, destinatários e transferências internacionais.",
        "Uma funcionalidade que cria ou amplia materialmente tratamento de dados pessoais não deve ser liberada sem responder a esses pontos na spec/PR. Tratamentos de maior risco exigem RIPD/DPIA interno e aprovação de Privacidade/Security antes de Production.",
      ],
    },
    {
      id: "auditoria",
      heading: "14. Evidências, auditoria e prestação de contas",
      paragraphs: [
        "A Gestify mantém, conforme aplicável, evidências versionadas de documentos jurídicos, aceites, inventário/ROPA, avaliações de impacto, solicitações de titulares, incidentes, fornecedores, transferências, eliminações, alterações de segurança, testes de continuidade e revisões de acesso.",
        "Auditorias e pedidos de informação devem respeitar confidencialidade, segurança, segredo comercial, dados de terceiros e isolamento entre tenants. Nenhuma auditoria contratual autoriza acesso irrestrito ao banco ou ao ambiente de outro cliente.",
      ],
    },
    {
      id: "autoridades",
      heading: "15. Ordens judiciais, autoridades e solicitações governamentais",
      paragraphs: [
        "Solicitações de autoridades devem ser verificadas quanto a autenticidade, competência, fundamento e escopo antes de qualquer entrega. O Gestify fornecerá apenas os dados legalmente exigidos e necessários, respeitando ordens de sigilo e preservando registro da solicitação, base jurídica, aprovador e material efetivamente produzido.",
        "Pedidos informais, mensagens sem autenticidade verificável ou solicitações excessivamente amplas não autorizam suporte ou colaboradores a exportar dados de clientes. Casos controvertidos serão encaminhados à assessoria jurídica.",
      ],
    },
    {
      id: "encerramento",
      heading: "16. Encerramento de contrato, exportação e eliminação",
      paragraphs: [
        "O encerramento de um cliente deve seguir um fluxo controlado: validar autoridade da solicitação, registrar a data efetiva, limitar novos acessos/processamentos, permitir a exportação prevista em contrato, identificar retenções legais/legal holds e eliminar ou anonimizar o conteúdo operacional ao final da janela aplicável.",
        "Backups não são arquivo comercial permanente. Cópias remanescentes seguem ciclo técnico restrito e não devem voltar ao uso operacional normal sem reaplicação de eliminações/retificações válidas.",
      ],
    },
    {
      id: "responsabilidades",
      heading: "17. Responsabilidades do cliente e limites jurídicos",
      paragraphs: [
        "O cliente deve administrar usuários, permissões e credenciais; informar seus titulares; definir bases legais sob sua responsabilidade; evitar coleta excessiva; manter dados corretos; e comunicar à Gestify situações que exijam assistência como Operadora.",
        "Nenhuma disposição desta Política pretende excluir responsabilidade que não possa ser excluída ou limitada por lei. Cláusulas de responsabilidade, foro, cancelamento, reembolso ou alteração unilateral devem respeitar direitos obrigatórios aplicáveis, inclusive quando a relação concreta puder ser considerada de consumo.",
      ],
    },
    {
      id: "contato",
      heading: "18. Encarregado e canal de privacidade",
      paragraphs: [
        "Encarregado/DPO informado pela Gestify: Ivan da Silva Fernandes Escobar.",
        "Canal de privacidade: atendimento@ntsolution.com.br. Solicitações devem conter informações suficientes para identificação segura do solicitante e do contexto do pedido, sem envio desnecessário de dados sensíveis por canal aberto.",
        "O canal serve para exercício de direitos, dúvidas sobre tratamento, incidentes e questões relacionadas à proteção de dados. A Gestify poderá direcionar pedidos relativos a dados controlados por uma empresa cliente ao respectivo Controlador.",
      ],
    },
    {
      id: "alteracoes",
      heading: "19. Versionamento, revisão e alterações",
      paragraphs: [
        "Esta Política poderá ser atualizada em razão de mudanças legais, regulatórias, técnicas, de segurança ou de operação. Alterações materiais serão versionadas e comunicadas por meio razoável quando necessário. A versão vigente e sua data de atualização permanecerão publicadas no site.",
        "A regulamentação de privacidade aplicável ao Gestify será revisada periodicamente e sempre que houver mudança material da ANPD ou da legislação. Esta Política deve ser interpretada em conjunto com a Política de Privacidade, os Termos do Serviço, o DPA, a Política de Cookies e contratos específicos. Em caso de conflito, prevalece a norma legal obrigatória e, entre instrumentos contratuais válidos, a regra específica aplicável ao tratamento em questão.",
      ],
    },
  ],
};
