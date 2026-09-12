# Integridade das respostas no teste de carga

Status: validated
Priority: P2
Issue: #28

## Contexto

Em 2026-08-27, um smoke de 100 requests contra o Preview da PR #70 recebeu 100 respostas `302` da Deployment Protection da Vercel. O harness antigo considerava erro apenas `5xx` e `429`, registrando incorretamente taxa de erro zero. A latência reprovou o ensaio, mas os números não eram uma evidência válida de capacidade da aplicação.

## Objetivos

1. impedir que redirects, páginas de autenticação do provedor ou outros status inesperados sejam tratados como sucesso;
2. permitir o bypass oficial de automação da Vercel sem expor o secret;
3. manter a carga manual, limitada e tecnicamente bloqueada em Production;
4. tornar a evidência suficiente para diferenciar resposta da aplicação de resposta da camada de proteção.

## Invariantes

- o status permitido padrão é somente `200`;
- status adicionais exigem lista explícita em `GESTIFY_LOAD_ALLOWED_STATUSES`;
- lista vazia, malformada ou fora do intervalo HTTP `100-599` interrompe antes da carga;
- cada resposta fora da lista permitida incrementa `errors`;
- `VERCEL_AUTOMATION_BYPASS_SECRET`, quando configurado, é enviado somente no header `x-vercel-protection-bypass`;
- o valor do bypass e o segredo do readiness nunca aparecem na saída;
- hosts e project ref de Production continuam bloqueados;
- o workflow permanece manual e limitado a 2.000 requests e concorrência 25.

## Evidência esperada

O JSON registra status observados, status permitidos, taxa de erro, p50/p95/p99/max e apenas um booleano indicando se o bypass foi configurado. Um Preview protegido sem bypass deve reprovar com `302` contado como erro. Com o bypass correto, o endpoint deve retornar o status autorizado antes de qualquer baseline ser aceito.

## Testes

- auditor estático do contrato operacional;
- configuração inválida de status falha antes de rede;
- Preview protegido sem bypass reprova respostas `302`;
- CI completo e `git diff --check` verdes;
- carga válida será executada somente após configurar o secret no ambiente protegido de staging.

## Rollout e rollback

A mudança afeta apenas o workflow manual e o script de teste. Não altera aplicação, banco, Production ou dados de tenant. O rollback é a reversão da PR; nenhuma migration ou restauração de dados é necessária.
