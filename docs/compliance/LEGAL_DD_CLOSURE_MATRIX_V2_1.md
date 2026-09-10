# Gestify — Matriz de Fechamento Jurídico / Due Diligence v2.1

Data-base: 2026-09-10. Esta matriz separa **implementação interna** de **evidência externa**. Um item não é declarado 100% jurídico apenas porque existe texto contratual.

| Tema | Estado interno | Evidência para fechamento | Gate |
|---|---|---|---|
| Controlador x Operador | concluído no desenho v2.1 | revisão jurídica do enquadramento por fluxo | jurídico |
| Mapa dado/finalidade/base/compartilhamento/retenção | concluído em registro v2.1 | reconciliar fornecedores e prazos legais específicos | jurídico/evidência |
| E-mail/login | comprovado no produto e documentado | revisão final de finalidade/retention | jurídico |
| Pagamentos | nenhuma implementação de gateway encontrada na auditoria de repositório | escolher/implementar processador e documentar fluxo real antes de qualquer afirmação sobre PAN/CVV | produto/externo |
| Suboperadores | inventário criado; Supabase/Vercel e Resend integram arquitetura; condicionais separados | arquivar DPA/termos, regiões e mecanismo de transferência de cada fluxo | externo |
| Transferência internacional | requisito documentado | comprovar mecanismo efetivo por fornecedor/fluxo segundo Res. CD/ANPD 19/2024 | externo/jurídico |
| Retenção | matriz por categoria criada | validar prazos fiscal/contábil e demais obrigações específicas | jurídico/contábil |
| Cancelamento/exclusão | fluxo e offboarding documentados; destruição automática bloqueada | teste E2E do fluxo antes de automação destrutiva | produto |
| Contrato SaaS específico | requisitos e Termos v2.1 preparados | revisão jurídica final e reconciliação com oferta/checkout | jurídico/comercial |
| SLA | fórmula, exclusões e método definidos sem número inventado | série histórica de disponibilidade + decisão comercial para X%, créditos e suporte | operação/comercial |
| Incidentes | procedimento e matriz causal criados | exercício/tabletop e contatos de escalonamento; revisão jurídica | operação/jurídico |
| Customizações | política criada | incorporar em contratos aprovados | jurídico |
| Cadeia de PI | checklist/minuta criada | instrumentos efetivamente assinados por cada contribuidor relevante | externo/jurídico |
| Open Source | auditor automático criado e CI passa a executá-lo explicitamente | analisar itens de revisão e preservar NOTICE/SBOM quando aplicável | engenharia/jurídico |
| Trade dress/anterioridade | plano probatório criado | popular ativos reais em Data Room privado/Kratelis Company OS | externo |
| Descontinuidade/insolvência | Exit Plan criado | teste operacional e revisão jurídica | operação/jurídico |
| CDC/checkout | checklist criado | implementar/validar checkout, resumo, correção, confirmação, cópia, arrependimento e reembolso antes de B2C pago | produto/jurídico |
| Dados cadastrais | erro material identificado e corrigido nos artefatos v2.1 gerados | conferir razão social/nome empresarial, CNPJ, contatos e representação antes da assinatura/publicação | cadastral |

## Regra de 100%

O pacote somente pode receber status **100% pronto para publicação/assinatura** quando todos os gates externos aplicáveis tiverem evidência anexada e revisão jurídica final. Enquanto um fornecedor, processador, contrato de PI, mecanismo de transferência, métrica de SLA ou fluxo de checkout depender de decisão/documento externo, o status correto é `implementado internamente / evidência pendente`, e não `concluído`.

## Critério de promoção

1. CI, migrations, DR e auditorias verdes no HEAD.
2. Auditoria OSS obrigatória no CI.
3. Sem declaração pública sobre gateway inexistente.
4. Termos/Privacidade/DPA coerentes entre si e com produto.
5. Evidências externas arquivadas no Data Room privado.
6. Parecer/revisão final de advogado brasileiro registrado.
7. Congelamento de versão/hash dos documentos aprovados.
8. Migração/ledger mantém v2.1 como draft até autorização explícita de publicação.
9. Rollout controlado com teste do aceite e preservação de versões anteriores.