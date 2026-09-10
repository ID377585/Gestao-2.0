# Gestify — Data Room de Due Diligence

Status: **estrutura de evidências — não substitui revisão jurídica profissional**  
Owner operacional: Kratelis / Gestify  
Última revisão inicial: 2026-09-10

## Regras do Data Room

1. Não armazenar segredos, tokens, senhas, chaves privadas ou dumps de produção neste repositório.
2. Evidência confidencial (contratos assinados, documentos societários, screenshots de design não públicos, documentos fiscais) deve ficar em repositório/Drive privado controlado, referenciada aqui apenas por ID/caminho.
3. Toda alegação material deve apontar para evidência verificável: contrato, commit, relatório, política, migration, log de CI ou documento assinado.
4. Documento em `draft` não deve ser apresentado como política/contrato vigente.
5. O Data Room deve registrar lacunas; nunca preencher ausência de evidência com declaração presumida.

## Índice

| Área | Evidência esperada | Estado inicial |
|---|---|---|
| Societário/cadastral | CNPJ, atos constitutivos vigentes, poderes de representação, marca/nome comercial | PENDENTE DE CONSOLIDAÇÃO |
| Propriedade intelectual | cadeia de titularidade do código, design, documentação e contribuições | PENDENTE |
| Clientes/contratos | contratos, pedidos/planos, versões e aceite | PARCIAL |
| Privacidade/LGPD | Privacy, DPA, Governance, Cookies, registro de titulares, incidentes | PARCIAL/IMPLEMENTADO NO PRODUTO |
| Suboperadores | contratos/DPA, finalidade, localização, transferências, segurança | PENDENTE DE EVIDÊNCIAS CONTRATUAIS |
| Segurança | arquitetura, RLS, autenticação, CI, vulnerabilidades, políticas | PARCIAL |
| Continuidade/DR | backups, restore, RPO/RTO medidos, evidências de drills | PARCIAL |
| Open Source | inventário transitivo, licenças, SBOM, NOTICE, política/gate | EM IMPLEMENTAÇÃO |
| Financeiro/fiscal | faturamento, tributos, fornecedores, custos e obrigações | PENDENTE NO DATA ROOM |
| Consumerista | contratação eletrônica, preço, cancelamento, arrependimento, reembolso | PENDENTE |
| SLA | baseline medido, fórmula, exclusões e remédios | PENDENTE DE MÉTRICA REAL |
| Exit/insolvência | exportação, cessação de cobrança, retenção e eliminação | PARCIAL |
| Trade dress/anterioridade | histórico privado de design, releases, telas, Figma e hashes | PENDENTE NO COMPANY OS |

## Evidências técnicas já existentes no repositório

- Scripts de readiness e deployment readiness.
- Auditorias de tenant writes e RLS de pedidos.
- Fluxos de DR/backup/restore e fixture drill.
- Registry de documentos jurídicos e ledger genérico de aceites.
- Entitlements contratuais por estabelecimento.
- Workflow de solicitações LGPD, incidentes e offboarding.
- Registro operacional de suboperadores e retenção.
- Política pública de Segurança e DPA.

## Evidências que exigem fonte externa ao código

### Propriedade intelectual
- Instrumento do fundador declarando origem/titularidade e listando ativos existentes.
- Cessões/licenças de prestadores anteriores, se houver.
- Templates obrigatórios para novos sócios, empregados, freelancers, designers e consultores.
- Registro de exceções: qualquer componente cujo direito patrimonial não pertença à entidade que explora o Gestify.

### Fornecedores/suboperadores
Para cada fornecedor efetivamente utilizado, manter:
- contrato/termos vigentes;
- DPA/aditivo de proteção de dados quando aplicável;
- finalidade e categorias de dados;
- localizações relevantes de tratamento;
- mecanismo aplicável de transferência internacional;
- evidência de revisão de segurança;
- data de entrada/saída e responsável pela revisão.

### Comercial/consumerista
- fluxo real de checkout/assinatura;
- telas pré-contratuais e confirmação de aceite;
- cópia da oferta/preço vigente por versão;
- procedimento de cancelamento, estorno e arrependimento quando aplicável;
- histórico de alterações materiais de preço/plano.

## Checklist de PI para toda nova contribuição

Antes de incorporar contribuição relevante ao Gestify:
1. identificar autor e vínculo;
2. identificar se há código/asset de terceiro;
3. registrar licença/origem;
4. obter instrumento de cessão/licença adequado quando necessário;
5. registrar exceções e componentes pré-existentes do contratado;
6. impedir inclusão de segredo/confidencialidade de cliente;
7. manter evidência assinada no Data Room privado.

## Política Open Source — baseline

O Gestify **usa componentes open source**. A política não deve declarar o contrário.

- AGPL e SSPL: bloqueadas por padrão até aprovação jurídica/arquitetural explícita.
- GPL/LGPL/MPL/EPL/CDDL e licenças desconhecidas/especiais: revisão manual obrigatória antes de nova adoção.
- MIT/BSD/Apache e demais permissivas: permitidas somente observando avisos, atribuições e condições específicas.
- A licença de uma dependência transitiva também deve ser considerada.
- O gate `npm run licenses:audit` deve falhar para licenças explicitamente bloqueadas e produzir relatório de auditoria.

## Trade dress e anterioridade

O dossiê detalhado deve ser **privado** e conter, quando disponíveis:
- screenshots datados das versões;
- vídeos/demonstrações;
- Figma/wireframes/exportações;
- commits/tags/releases e deploys;
- identidade visual e componentes distintivos;
- domínio e materiais comerciais;
- cronologia de mudanças relevantes;
- hashes dos arquivos de evidência.

O objetivo é preservar prova de criação/evolução e auxiliar eventual análise de autoria, concorrência desleal ou confusão de conjunto. Não declarar exclusividade automática sobre padrões funcionais ou elementos genéricos de interface.

## Exit Plan / insolvência — princípios

- interromper novas cobranças quando a descontinuidade se tornar efetiva;
- comunicar clientes com antecedência razoavelmente possível;
- oferecer exportação quando tecnicamente possível;
- revogar sessões/acessos no encerramento;
- separar dados que devem ser eliminados daqueles conservados por fundamento legal residual;
- proteger dados conservados e impedir reutilização para finalidade incompatível;
- não prometer prazo de continuidade impossível de garantir em insolvência;
- registrar conclusão e evidências do offboarding.

## Critério para declarar Due Diligence pronta

Somente marcar `READY` quando:
- itens críticos possuírem evidência verificável;
- cadeia de PI estiver documentada;
- inventário OSS/SBOM e exceções estiverem revisados;
- contratos/políticas vigentes coincidirem com comportamento real do produto;
- suboperadores e transferências tiverem evidência contratual;
- SLA publicado estiver baseado em métricas reais;
- fluxos consumeristas estiverem implementados quando houver venda B2C;
- revisão jurídica humana final estiver registrada.
