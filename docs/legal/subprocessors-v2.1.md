# Gestify — Anexo de Suboperadores v2.1

Status: inventário de Due Diligence; **publicar somente dados comprovados**.

## Regra de evidência
Para cada fornecedor efetivamente utilizado, registrar serviço, finalidade, categorias de dados acessíveis, papel, localização de tratamento conhecida, transferência internacional, DPA/termos, medidas de segurança relevantes, data de revisão e responsável pela evidência.

## Inventário técnico conhecido a validar documentalmente

| Serviço | Uso conhecido/previsto | Situação DD |
|---|---|---|
| Supabase | banco, autenticação e/ou storage conforme arquitetura implantada | uso técnico conhecido; contrato/DPA, localização e transferências precisam integrar evidência |
| Vercel | hospedagem/deploy da aplicação | uso técnico conhecido; contrato/DPA, localização e transferências precisam integrar evidência |
| Resend | e-mail transacional quando habilitado | validar configuração efetiva, dados enviados e documentação contratual |
| Cloudflare R2 | backup off-site/DR quando habilitado | condicional; não declarar como suboperador ativo sem comprovação do ambiente |
| Google | e-mail/integrações quando aplicável | condicional; discriminar produto e fluxo antes de declarar |
| Gateway de pagamento | assinatura/cobrança | **não identificado/comprovado; proibido nomear fornecedor por suposição** |

## Transferência internacional
Antes da publicação, cada fluxo internacional deverá ser reconciliado com a Resolução CD/ANPD nº 19/2024 e com o mecanismo jurídico efetivamente utilizado. Não declarar cláusula-padrão, adequação ou outra salvaguarda sem documento comprobatório.

## Mudança material
Alterações de suboperador devem gerar nova versão do inventário, evidência de revisão e comunicação conforme DPA/contrato aplicável.