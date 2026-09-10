# Gestify — Anexo de Suboperadores v2.1

Status: inventário de Due Diligence; **publicar somente dados comprovados**.

## Regra de evidência
Para cada fornecedor efetivamente utilizado, registrar serviço, finalidade, categorias de dados acessíveis, papel, localização de tratamento conhecida, transferência internacional, DPA/termos, medidas de segurança relevantes, data de revisão e responsável pela evidência.

O fato de um fornecedor integrar a arquitetura não significa que receba todas as categorias de dados. O anexo público definitivo deve descrever apenas os fluxos efetivos e comprovados.

## Inventário técnico e documental

| Serviço | Uso técnico comprovado/condicional | Categorias potencialmente acessíveis pelo fluxo | Situação DD |
|---|---|---|---|
| Supabase | banco, autenticação e/ou storage conforme arquitetura implantada | conta/autenticação, dados operacionais do tenant e metadados conforme tabelas/storage utilizados | integração técnica conhecida; contrato/DPA, localização e mecanismo de transferência precisam integrar a evidência externa |
| Vercel | hospedagem/deploy da aplicação | requisições HTTP, metadados técnicos e conteúdo processado pela aplicação na medida necessária à hospedagem | integração técnica conhecida; contrato/DPA, localização e mecanismo de transferência precisam integrar a evidência externa |
| Resend | envio de e-mail transacional e alertas operacionais | endereço de e-mail do destinatário, remetente, assunto e conteúdo necessário à mensagem | **integração técnica comprovada no repositório** por `src/lib/alerts/email.ts`, `.env.example` e readiness operacional; contrato/DPA, localização e mecanismo de transferência permanecem pendentes de evidência externa |
| Cloudflare R2 | backup off-site/DR quando habilitado | dados incluídos no conjunto de backup configurado | condicional; não declarar como suboperador ativo sem comprovação do ambiente |
| Google | e-mail/integrações quando aplicável | depende do produto e fluxo efetivamente habilitado | condicional; discriminar produto e fluxo antes de declarar |
| Gateway de pagamento | assinatura/cobrança | dependerá do processador e da arquitetura escolhidos | **não identificado/comprovado; proibido nomear fornecedor ou afirmar tratamento de cartão/CVV por suposição** |

## Evidência técnica do Resend
O repositório contém chamada direta ao endpoint da API do Resend para envio de mensagens, variáveis `RESEND_API_KEY`/`RESEND_FROM_EMAIL` e verificações operacionais relacionadas ao e-mail transacional. Isso é suficiente para classificar a integração como tecnicamente comprovada; não é suficiente, por si só, para concluir país de tratamento, cláusula contratual, DPA ou mecanismo de transferência internacional.

## Transferência internacional
Antes da publicação, cada fluxo internacional deverá ser reconciliado com a Resolução CD/ANPD nº 19/2024 e com o mecanismo jurídico efetivamente utilizado. Não declarar cláusula-padrão, decisão de adequação ou outra salvaguarda sem documento comprobatório.

Para cada fluxo internacional comprovado, registrar no Data Room: fornecedor/produto, finalidade, categorias de dados, países/localizações conhecidas, duração ou critério, compartilhamentos relevantes, responsabilidades, medidas de segurança, direitos/canais do titular, mecanismo jurídico adotado, documento-fonte, data de verificação e responsável.

## Mudança material
Alterações de suboperador devem gerar nova versão do inventário, evidência de revisão e comunicação conforme DPA/contrato aplicável.
