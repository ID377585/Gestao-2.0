# Checklist de isolamento multiempresa

Este checklist deve ser executado antes de liberar uma nova empresa real no Gestify.

## Objetivo

Garantir que cada empresa acesse apenas seus próprios dados, usuários, arquivos e configurações, mesmo quando o mesmo usuário participa de mais de uma empresa.

## Cenários obrigatórios

### 1. Empresa ativa e troca de contexto

- [ ] Usuário com uma única empresa vê o nome correto da empresa no Topbar.
- [ ] Usuário com duas ou mais empresas vê o seletor de empresa no Topbar.
- [ ] Ao trocar a empresa ativa, a página recarrega e todos os dados passam a refletir a nova empresa.
- [ ] Tentativa de trocar para um `establishment_id` sem membership ativa retorna erro e não altera o cookie.
- [ ] Página `/dashboard/admin/empresas` lista apenas empresas vinculadas ao usuário atual.

### 2. Usuários e permissões

- [ ] Admin da empresa A não lista usuários da empresa B.
- [ ] Admin da empresa A não edita perfil, status, senha ou módulos de usuário da empresa B.
- [ ] Usuário operação não executa ações reservadas para admin quando a regra exigir admin.
- [ ] Usuário de uma empresa não recebe permissões de módulos de outra empresa.
- [ ] Usuário com duas empresas pode ter papéis diferentes em cada empresa.

### 3. Estoque e produtos

- [ ] Produtos da empresa A não aparecem na empresa B.
- [ ] Saldos de estoque são filtrados por `establishment_id`.
- [ ] Movimentações de estoque criadas na empresa A não aparecem na empresa B.
- [ ] Inventários e perdas respeitam a empresa ativa.
- [ ] Transferências validam origem e destino conforme membership autorizada.

### 4. Pedidos, produção e separação

- [ ] Pedidos da empresa A não aparecem na empresa B.
- [ ] Itens, timeline, eventos de status e separação herdam isolamento do pedido.
- [ ] Produção e produtividade não expõem dados entre empresas.
- [ ] Cliente só vê pedidos próprios e da empresa correta.

### 5. Fiscal, notas e certificados

- [ ] Dados fiscais são carregados apenas da empresa ativa.
- [ ] Certificado digital A1 é privado e vinculado a uma única empresa.
- [ ] XML/PDF de notas seguem path com `establishment_id`.
- [ ] Caixa fiscal/NFe não mostra documentos de outra empresa.
- [ ] Vínculos fiscais de produtos são filtrados por empresa.

### 6. Compras e fornecedores

- [ ] Fornecedores não vazam entre empresas.
- [ ] Entradas de notas e itens de entrada respeitam a empresa ativa.
- [ ] Rascunhos de entrada são isolados por empresa.
- [ ] Importações de XML não criam produtos na empresa errada.

### 7. Financeiro e assinatura

- [ ] Tela de assinatura usa a empresa ativa.
- [ ] Uso e limites de plano são calculados por empresa.
- [ ] DRE, contas, fluxo de caixa e relatórios não misturam empresas.
- [ ] Auditoria financeira é filtrada por empresa.

### 8. Storage e arquivos

- [ ] Todo arquivo novo é salvo em path com `establishment_id`.
- [ ] Policies de storage impedem leitura cruzada entre empresas.
- [ ] Imports, certificados, XML/PDF e imagens de fichas técnicas não usam paths globais compartilhados.

### 9. Segurança de API e server actions

- [ ] Toda action que recebe `establishmentId` do front valida membership ativa.
- [ ] Toda action sensível usa `assertSameActiveEstablishment` ou validação equivalente.
- [ ] RPCs `SECURITY DEFINER` expostas para authenticated foram revisadas.
- [ ] Service role é usado somente no servidor e sempre após validação de usuário/tenant.

### 10. Teste de tentativa maliciosa

- [ ] Alterar manualmente o cookie da empresa ativa não libera acesso indevido.
- [ ] Alterar hidden input `establishment_id` no navegador não altera dados de outra empresa.
- [ ] Chamar API diretamente com ID de outra empresa retorna erro.
- [ ] Queries diretas via client Supabase respeitam RLS.

## Evidências a registrar

Para cada rodada de validação, registrar:

- data;
- ambiente testado;
- usuários usados;
- empresas usadas;
- módulos testados;
- prints ou logs de falhas;
- correções aplicadas;
- responsável pela aprovação.

## Critério mínimo para liberar nova empresa

Uma nova empresa só deve ser liberada quando todos os itens P0 abaixo estiverem concluídos:

- [ ] empresa ativa aparece corretamente pelo nome;
- [ ] seletor de empresa troca contexto sem erro;
- [ ] usuários são isolados por empresa;
- [ ] produtos/estoque são isolados por empresa;
- [ ] pedidos são isolados por empresa;
- [ ] fiscal/storage não expõe arquivos entre empresas;
- [ ] actions sensíveis validam `establishment_id`;
- [ ] Supabase Advisors de segurança foram revisados;
- [ ] deploy production está no commit validado.
