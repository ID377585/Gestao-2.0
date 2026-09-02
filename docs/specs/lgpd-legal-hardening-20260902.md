# Spec — LGPD / jurídico / consentimento hardening

Status: implementing
Priority: P1/P2
Date: 2026-09-02

## Contexto

O Gestify é um SaaS B2B multiempresa utilizado por estabelecimentos de alimentação e pode tratar dados de representantes, usuários, colaboradores, fornecedores e outros titulares. Em parte dos tratamentos a NT Solution/Gestify atua como Controladora; nos dados inseridos pelo cliente para operação do estabelecimento, em regra, o cliente atua como Controlador e a Gestify como Operadora.

A base jurídica pública já inclui Política de Privacidade, Termos do Serviço, DPA, Política de Cookies e Política de Acessibilidade. O endurecimento atual busca reduzir ambiguidades e alinhar cláusulas, processos e evidências técnicas.

## Problemas observados

1. Retenção descrita de forma genérica, sem matriz operacional por categoria.
2. Resposta a incidentes não explicita prazos regulatórios externos nem janela operacional interna entre Operadora e Controlador.
3. Transferência internacional descrita genericamente, sem referência aos mecanismos aplicáveis e governança de suboperadores.
4. DPA ainda curto para um SaaS B2B que pode tratar dados trabalhistas, financeiros, de autenticação e eventualmente dados pessoais sensíveis.
5. Ausência de uma política pública específica de governança e proteção de dados que consolide minimização, retenção, descarte, direitos, subprocessadores, segurança, privacy by design e evidências.
6. Necessidade de preservar coerência com o ledger append-only de aceite dos termos em evolução na PR de compliance de autenticação.

## Objetivo

Elevar a maturidade de LGPD/jurídico/consentimento sem criar promessas técnicas que a plataforma ainda não consegue comprovar. A regra de conformidade é: cláusula pública, procedimento interno e evidência técnica devem ser compatíveis.

## Invariantes

- Nenhuma cláusula exclui responsabilidade que a lei torne inderrogável.
- Consentimento não será usado como base legal universal quando houver base mais adequada.
- Dados pessoais sensíveis somente serão tratados quando necessários e com base legal adequada.
- A empresa cliente permanece responsável por instruções, licitude e transparência dos dados que insere quando atua como Controladora.
- O Gestify, quando Operador, trata dados somente segundo instruções documentadas, contrato e necessidades de segurança/continuidade permitidas em lei.
- Dados de tenants não podem ser compartilhados entre estabelecimentos.
- Direitos de titulares devem ter canal, identidade verificável, trilha de auditoria e resposta dentro dos prazos legais aplicáveis.
- Incidentes devem ter registro, triagem, contenção, avaliação de risco e comunicação escalonada.
- Transferência internacional deve observar os mecanismos aprovados pela ANPD quando aplicáveis.
- Eliminação deve considerar backups, obrigações legais, antifraude e exercício regular de direitos.

## Mudanças propostas

1. Criar Política de Governança e Proteção de Dados vinculada no rodapé jurídico.
2. Atualizar Política de Privacidade para:
   - distinguir dados pessoais, sensíveis e dados corporativos;
   - detalhar bases legais e responsabilidades;
   - formalizar matriz de retenção orientativa;
   - explicitar prazos e fluxo de incidentes;
   - detalhar transferências internacionais e suboperadores;
   - reforçar direitos e autenticação de solicitações;
   - prever privacy by design, minimização e descarte seguro.
3. Atualizar DPA/Termos para:
   - instruções documentadas;
   - confidencialidade de pessoas autorizadas;
   - assistência ao Controlador;
   - suboperadores;
   - incidentes e cooperação;
   - devolução/eliminação;
   - auditoria proporcional;
   - transferências internacionais;
   - responsabilidade de cada parte.
4. Versionar os documentos jurídicos de forma explícita.
5. Não alterar produção nem realizar merge automático.

## Matriz orientativa de retenção

A matriz abaixo não substitui obrigação legal específica do cliente nem prescrição aplicável a cada relação:

| Categoria | Regra padrão |
| --- | --- |
| Conta e autenticação | durante a relação e pelo período necessário a segurança, auditoria e defesa de direitos |
| Logs de segurança/acesso | pelo período necessário a segurança, investigação, auditoria e prevenção a fraude, com minimização |
| Aceites/versões de termos | enquanto necessários para prova contratual, obrigação legal e defesa de direitos |
| Dados operacionais do cliente | durante a contratação e janela técnica de devolução/eliminação definida contratualmente |
| Backups | ciclo técnico limitado, com expiração automática quando tecnicamente suportada |
| Cobrança/fiscal/financeiro | conforme obrigações fiscais, contábeis, regulatórias e exercício de direitos |
| Leads/marketing | até oposição/revogação quando aplicável ou enquanto persistir base legal válida |
| Solicitações LGPD | enquanto necessário para comprovar atendimento e exercer direitos |

Prazos concretos somente devem ser prometidos quando houver mecanismo técnico/processual capaz de cumpri-los.

## Incidentes

- Registrar data/hora de detecção e ciência.
- Preservar evidências e limitar acesso.
- Identificar categorias de dados, titulares, tenants e impacto.
- Operadora informa o Controlador sem demora indevida e, contratualmente, dentro de janela operacional compatível com a obrigação externa do Controlador.
- Quando a Gestify atuar como Controladora e o incidente puder acarretar risco ou dano relevante, o fluxo deve suportar comunicação à ANPD e aos titulares no prazo regulamentar aplicável.
- Manter registro do incidente mesmo quando não houver comunicação externa.

## Critérios de aceitação

- Conteúdo jurídico compila e renderiza sem quebrar rotas existentes.
- Links jurídicos apontam para todos os documentos vigentes.
- Nenhuma promessa contradiz o estado técnico conhecido.
- Termos/DPA deixam claros papéis de Controlador/Operador.
- Retenção, incidentes, suboperadores e transferências internacionais estão cobertos.
- Alterações passam por lint, typecheck, audit, tenant writes, readiness, build e testes relevantes.
- Revisão humana jurídica é obrigatória antes da publicação final da nova versão contratual.

## Rollback

Reverter os commits da branch antes do merge. Se publicado posteriormente, restaurar a versão jurídica anterior e manter histórico/versionamento dos aceites sem apagar registros já coletados.
