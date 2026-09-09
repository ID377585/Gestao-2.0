# DPA Gestify — minuta vNext para revisão jurídica

Status: DRAFT — NÃO PUBLICAR SEM REVISÃO JURÍDICA
Versão de trabalho: 2026-09-09

Este Anexo de Tratamento de Dados deve substituir o DPA resumido atual somente após revisão por advogado brasileiro com experiência em LGPD, SaaS, contratos empresariais e relações de consumo. A minuta foi estruturada para remover cláusulas vagas e alinhar contrato, controles e evidências técnicas.

## 1. Partes, papéis e prevalência

1.1. Nos tratamentos em que o CONTRATANTE determina as finalidades e os meios essenciais dos dados pessoais inseridos ou geridos em seu ambiente Gestify, o CONTRATANTE atua como Controlador e a NT Solution/Gestify como Operadora.

1.2. A Gestify poderá atuar como Controladora independente para tratamentos necessários à gestão de sua própria relação contratual, conta, faturamento, segurança da plataforma, prevenção a fraude, suporte, cumprimento legal e exercício regular de direitos, conforme Política de Privacidade.

1.3. Em caso de conflito sobre matéria de proteção de dados, este DPA prevalece sobre cláusulas gerais do contrato naquilo que for mais específico, sem afastar norma legal obrigatória.

## 2. Objeto e instruções documentadas

2.1. A Operadora tratará dados pessoais somente para executar os Serviços, conforme o contrato, esta minuta após aprovada e instruções documentadas e lícitas do Controlador.

2.2. Instruções documentadas podem constar do contrato, ordem de serviço, configuração administrada pelo Controlador, chamado autenticado, API/integração autorizada ou comunicação formal emitida por representante autorizado.

2.3. A Operadora não venderá, cederá para publicidade comportamental própria nem reutilizará dados controlados pelo CONTRATANTE para finalidade incompatível com os Serviços.

2.4. Se uma instrução aparentar violar a legislação, decisão de autoridade competente, direitos de terceiros ou controles essenciais de segurança, a Operadora poderá suspender a instrução específica, informar o Controlador e solicitar adequação ou orientação jurídica, salvo quando proibida por lei.

## 3. Categorias de titulares e dados

3.1. Conforme módulos efetivamente habilitados, os titulares podem incluir representantes, administradores, empregados, colaboradores, fornecedores, clientes e outros indivíduos cujos dados sejam licitamente tratados pelo Controlador.

3.2. As categorias de dados podem incluir identificação, contato, conta, permissões, dados operacionais, registros de uso, suporte, documentos e demais campos efetivamente necessários aos módulos contratados.

3.3. Dados pessoais sensíveis, inclusive biometria, somente poderão ser tratados quando o módulo tiver sido especificamente aprovado para esse uso, com finalidade, base legal, instruções do Controlador, controles de acesso, retenção, transparência e avaliação de impacto compatíveis. Campos livres não constituem autorização para depósito indiscriminado de dados sensíveis.

3.4. Tratamento intencional de dados de crianças ou adolescentes depende de caso de uso aprovado e requisitos legais específicos. O serviço não deve ser usado para esse fim por mera conveniência.

## 4. Obrigações do Controlador

O CONTRATANTE deverá, sob sua esfera de decisão:
- assegurar base legal e finalidade para os dados inseridos;
- fornecer avisos e exercer transparência perante seus titulares;
- manter dados adequados, necessários e corretos;
- administrar usuários, perfis e permissões;
- não inserir credenciais, segredos ou dados excessivos em campos impróprios;
- responder por instruções, integrações e exportações que determine;
- comunicar à Operadora solicitações de titulares, incidentes ou legal holds que exijam assistência;
- observar legislação trabalhista, consumerista, fiscal, setorial e outras normas aplicáveis ao seu próprio uso da plataforma.

## 5. Pessoas autorizadas e confidencialidade

5.1. A Operadora limitará acesso a dados pessoais a pessoas que necessitem desse acesso para prestação, segurança, suporte ou obrigação legítima vinculada aos Serviços.

5.2. Pessoas com acesso privilegiado deverão estar sujeitas a dever de confidencialidade, menor privilégio, autenticação adequada, rastreabilidade proporcional e revogação de acesso após mudança de função ou desligamento.

5.3. Dados de Production não devem ser copiados para ferramentas pessoais ou ambientes não controlados apenas por conveniência de suporte/desenvolvimento.

## 6. Medidas técnicas e organizacionais mínimas

Sem prometer invulnerabilidade, a Operadora manterá controles compatíveis com o risco e o estado efetivamente implementado, incluindo, conforme aplicável:
- isolamento lógico entre tenants e autorização por vínculo/permissão;
- RLS e controles server-side para dados expostos pela camada de dados;
- proteção de secrets/chaves administrativas;
- autenticação e gestão de sessão;
- criptografia em trânsito e proteções de armazenamento da infraestrutura contratada;
- logs e trilhas de auditoria minimizados;
- gestão de vulnerabilidades e dependências;
- processo de mudança e revisão via PR/CI;
- backup, restore e continuidade;
- resposta a incidentes;
- revisão de acessos privilegiados.

A descrição pública/contratual de qualquer controle deve corresponder a evidência técnica verificável.

## 7. Suboperadores

7.1. O Controlador autoriza a utilização dos suboperadores necessários à prestação, desde que a Operadora mantenha registro atualizado contendo serviço, finalidade, categorias de dados, localidades relevantes e obrigações de proteção de dados.

7.2. A Operadora deverá impor ao suboperador obrigações de confidencialidade, segurança, incidente, retenção/deleção e tratamento compatíveis com o serviço prestado e com as obrigações assumidas neste DPA.

7.3. Mudança material na cadeia de suboperadores que aumente de forma relevante o risco ou altere materialmente a transferência internacional deverá seguir o mecanismo de aviso previsto no contrato. Eventual objeção do Controlador deverá ser fundamentada em risco concreto de proteção de dados; as partes buscarão solução razoável, como substituição, limitação de escopo ou, se inviável, encerramento do componente afetado conforme contrato.

7.4. A Operadora permanece responsável pelas obrigações que lhe sejam legalmente imputáveis, não podendo excluir genericamente responsabilidade apenas por ter utilizado terceiro.

## 8. Transferência internacional

8.1. Cada transferência internacional aplicável deverá estar vinculada a base legal do tratamento e a mecanismo permitido pela LGPD e regulamentação da ANPD.

8.2. Quando o mecanismo adotado forem cláusulas-padrão contratuais da Resolução CD/ANPD nº 19/2024, serão incorporadas conforme o texto e requisitos regulamentares aplicáveis, com preenchimento das informações exigidas e sem alteração incompatível do conteúdo obrigatório.

8.3. A Operadora manterá transparência adequada sobre países, finalidade, responsabilidades, medidas de segurança e canais de direitos, quando exigido.

## 9. Solicitações de titulares

9.1. Se a Operadora receber solicitação relativa a dados sob controle do CONTRATANTE, deverá registrá-la, verificar o contexto mínimo necessário e encaminhá-la ao Controlador sem tomar decisão jurídica em seu lugar, salvo obrigação própria.

9.2. A Operadora prestará assistência técnica razoável para localizar, exportar, corrigir, bloquear, anonimizar ou eliminar dados conforme instrução lícita do Controlador, preservando isolamento de tenant, terceiros e segredos de segurança.

9.3. Solicitações não autorizam entrega de dump bruto, credenciais, dados de outros titulares ou dados de outros clientes.

## 10. Incidentes de segurança

10.1. A Operadora manterá processo de detecção, registro, contenção, investigação e preservação de evidências.

10.2. Confirmado incidente material sob sua esfera que afete dados controlados pelo CONTRATANTE, a Operadora deverá informar o Controlador sem demora indevida e terá como alvo operacional fazê-lo ordinariamente em até 24 horas da confirmação, sem aguardar esse limite quando puder comunicar antes.

10.3. A primeira comunicação poderá ser preliminar e será complementada à medida que fatos confiáveis forem apurados. Deve conter, conforme disponível: natureza, cronologia, categorias de dados/titulares, escopo/tenants, medidas de contenção, riscos conhecidos, medidas planejadas e contato responsável.

10.4. O Controlador permanece responsável pelas decisões de comunicação regulatória quando atuar nessa qualidade; a Operadora cooperará tecnicamente. Quando a Gestify for Controladora independente do tratamento afetado, cumprirá suas próprias obrigações regulatórias.

## 11. Retenção, devolução, exportação e eliminação

11.1. Durante a vigência, dados serão mantidos conforme necessidade dos Serviços, obrigações legais, segurança e instruções do Controlador.

11.2. No encerramento, será aplicado fluxo documentado de autoridade, exportação/devolução prevista no plano/contrato, identificação de legal holds/retenções legais e eliminação ou anonimização do conteúdo operacional após a janela contratual definida.

11.3. Retenções por obrigação legal, segurança, investigação ou exercício regular de direitos deverão ser específicas e restritas ao necessário.

11.4. Backups seguirão ciclo técnico definido e protegido; não serão usados como arquivo comercial permanente. Se backup anterior a uma eliminação/retificação for restaurado, a obrigação válida deverá ser reaplicada antes do ambiente retornar ao uso normal.

11.5. Evidência de eliminação deverá comprovar a execução sem recriar desnecessariamente o conteúdo eliminado.

## 12. Auditoria e prestação de contas

12.1. Mediante solicitação razoável e proporcional, a Operadora fornecerá evidências relevantes de conformidade relacionadas ao serviço contratado, observados segredo comercial, segurança, confidencialidade e isolamento de outros clientes.

12.2. Auditoria não concede acesso irrestrito a Production, bancos, secrets, dados de terceiros ou ambientes de outro tenant. Quando suficiente, relatórios, evidências técnicas, questionários, logs minimizados ou atestados substituem acesso direto.

12.3. Auditoria presencial/técnica extraordinária poderá depender de justificativa, escopo, confidencialidade, horário e custos razoáveis definidos contratualmente, salvo exigência legal/autoridade competente.

## 13. RIPD, legítimo interesse e tratamentos de alto risco

13.1. A Operadora manterá processo interno de avaliação de impacto para biometria, monitoramento sistemático, dados sensíveis em escala, decisões automatizadas relevantes, menores e outros tratamentos de alto risco.

13.2. Quando o Controlador depender de informações sob posse da Operadora para seu RIPD, a Operadora prestará assistência proporcional ao serviço.

13.3. A Operadora poderá impedir ativação de funcionalidade de alto risco até que requisitos técnicos, contratuais e de proteção de dados estejam satisfeitos.

## 14. IA e provedores externos

Dados pessoais sob controle do CONTRATANTE não serão intencionalmente utilizados para treinar modelos externos ou enviados a serviço de IA para finalidade incompatível sem instrução/contrato, base jurídica, avaliação de fornecedor, retenção e transferência internacional adequadas. Funcionalidades futuras de IA deverão informar finalidade e condições específicas.

## 15. Ordens judiciais e autoridades

15.1. A Operadora verificará autenticidade, competência, base legal e escopo antes de entregar dados a autoridade.

15.2. Será fornecido apenas o mínimo legalmente exigido. Quando permitido e apropriado, o Controlador será informado. Ordens de sigilo serão respeitadas.

15.3. Pedido informal ou não autenticado não autoriza suporte a exportar dados do CONTRATANTE.

## 16. Responsabilidade

16.1. Cada parte responde pelas atividades sob sua esfera, conforme contrato e legislação. Nenhuma disposição deste DPA exclui responsabilidade inderrogável por lei.

16.2. O Controlador responde por instruções ilícitas, ausência de base legal ou coleta excessiva que determine, sem excluir eventual responsabilidade própria da Operadora por conduta, falha ou obrigação que lhe seja imputável.

16.3. Eventuais limites de responsabilidade deverão ser definidos no contrato principal após revisão jurídica e não poderão afastar direitos obrigatórios aplicáveis.

## 17. Vigência e sobrevivência

As obrigações de confidencialidade, segurança, eliminação/devolução, cooperação com incidentes e preservação de evidências sobreviverão ao término pelo período necessário para cumprir a finalidade/obrigação aplicável.

## 18. Anexos que devem acompanhar a versão final

A versão assinável deverá referenciar, conforme aplicável:
- Anexo A — escopo, categorias de titulares/dados e finalidades;
- Anexo B — medidas técnicas e organizacionais atuais;
- Anexo C — lista de suboperadores;
- Anexo D — matriz de retenção/encerramento;
- Anexo E — transferências internacionais e mecanismo por fluxo;
- Anexo F — cláusulas-padrão da ANPD, quando utilizadas, conforme texto regulamentar vigente.

## Aprovação antes de publicação

Bloqueadores obrigatórios:
- revisão jurídica brasileira;
- conferência da razão social/CNPJ/endereço/contatos;
- conferência dos contratos reais de Supabase, Vercel e demais suboperadores;
- preenchimento dos países e mecanismos reais de transferência;
- definição comercial da janela de exportação após término;
- validação de que os controles técnicos prometidos existem;
- versionamento e plano de reaceite quando a alteração for material.