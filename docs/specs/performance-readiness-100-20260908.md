# Performance readiness 100 — 2026-09-08

Status: implementing
Priority: P3
Date: 2026-09-08

## Contexto e evidência

A nota de Performance do Gestify estava em 78%. A investigação atual mediu o banco Production, o Supabase Performance Advisor, o runtime da Vercel e o código dos hot paths antes de propor mudanças.

Evidências observadas:

- a consulta mais relevante do catálogo de produtos executou 4.403 vezes em `pg_stat_statements`, acumulou aproximadamente 118 segundos de execução e teve média de 26,79 ms;
- essa consulta filtra por `establishment_id` + `is_active`, ordena por `name` e retorna o catálogo usado por várias telas;
- outra variante do catálogo ordena por `product_type` + `name`;
- `products` possui cerca de 616 linhas em Production, portanto o gargalo atual é frequência/repetição e alinhamento do índice, não volume absoluto;
- `technical_sheets` possui cerca de 151 linhas, mas a listagem com relações aninhadas apresentou média de aproximadamente 19 ms;
- o Performance Advisor registrou 16 avisos de políticas permissivas múltiplas, 326 índices atualmente sem uso, 1 tabela de backup sem PK e configuração absoluta de conexões do Auth;
- os 326 índices sem uso não serão removidos sem janela de observação e prova de redundância, pois muitos são índices de FK, segurança ou módulos de baixa frequência;
- a Vercel apresentou apenas um grupo de erro nos últimos 7 dias, relacionado ao serviço externo de clima, sem evidência de saturação do runtime principal;
- o staging atual está defasado em relação ao schema Production e não contém todas as tabelas relacionadas a fichas técnicas. Portanto ele não pode ser usado como prova completa de capacidade até o alinhamento do schema.

## Objetivo

Definir e cumprir um contrato auditável de prontidão de performance sem alterar regras de negócio, autorização, RLS, isolamento multiempresa ou comportamento transacional.

## Critério para 100% técnico

Performance será considerada 100% em prontidão técnica quando:

1. hot paths de banco identificados por evidência tiverem índice compatível com filtro e ordenação;
2. o catálogo de produtos possuir proteção contra leituras repetidas de banco em rajadas curtas, sempre isolada por `establishment_id`;
3. existir gate estático no CI impedindo regressão do contrato de performance;
4. migrations de performance forem validadas primeiro em staging e versionadas no repositório;
5. lint, typecheck, dependency audit, tenant audit, readiness, build e testes específicos estiverem verdes;
6. Preview Vercel estiver READY e sem erros novos atribuíveis à mudança;
7. nenhuma mudança for promovida para Production sem revisão e autorização humana;
8. a nota 100% não depender de apagar índices apenas porque o Advisor os marca como não usados.

## Invariantes

- nenhuma chave de cache pode misturar tenants;
- nenhum dado de catálogo pode ser compartilhado entre estabelecimentos;
- TTL do cache de aplicação deve ser curto e limitado;
- erros do Supabase não podem ser armazenados em cache;
- mudanças de índice não alteram RLS, grants ou constraints;
- nenhum DROP INDEX será executado nesta etapa;
- nenhuma carga será enviada para Production;
- Production permanece somente leitura durante diagnóstico.

## Design técnico

### Catálogo de produtos

Adicionar cache de processo de curta duração na rota autenticada `/api/products/catalog`, indexado por `establishmentId`. O cache reduz chamadas repetidas ao Supabase durante navegação entre telas em uma mesma instância serverless. O cabeçalho HTTP privado existente permanece como camada complementar.

### Índices de hot path

Adicionar:

- `(establishment_id, is_active, name)` para a consulta dominante do catálogo;
- `(establishment_id, is_active, product_type, name)` para a variante por tipo;
- `(establishment_id, name, created_at desc)` para a ordenação principal de fichas técnicas.

Os índices foram aplicados primeiro no projeto staging via migration `performance_hot_path_indexes` e depois versionados com a mesma versão observada no histórico remoto.

### Itens deliberadamente não alterados

- 326 índices classificados como unused pelo Advisor;
- tabela histórica `products_cost_backup_20260527` sem PK;
- 16 casos de multiple permissive policies, pois a consolidação RLS é mudança de segurança e deve ser tratada em ciclo específico com provas de equivalência;
- configuração de conexões do Supabase Auth, que é configuração de infraestrutura e exige avaliação separada antes de alteração.

## Testes e aceitação

- auditor estático de performance no CI;
- migration presente e sem `drop index`;
- cache explicitamente chaveado por establishment;
- TTL máximo de 30 segundos;
- consulta mantém filtro por `establishment_id` e `is_active`;
- CI completo verde;
- Supabase advisors sem regressão de segurança após DDL;
- Vercel Preview READY;
- smoke da rota autenticada em ambiente seguro quando houver sessão de teste disponível.

## Rollout

1. staging: índices aplicados e verificados;
2. branch isolada + CI + Preview;
3. PR para revisão;
4. somente após autorização: merge em main;
5. somente após autorização de mudança Production: aplicar/promover migration e verificar Advisor, runtime e latência.

## Rollback

- cache: reverter a mudança da rota;
- índices: em caso de regressão comprovada, criar migration de rollback específica após revisão; não remover índices diretamente em Production;
- nenhuma alteração de dados é necessária para rollback desta etapa.
