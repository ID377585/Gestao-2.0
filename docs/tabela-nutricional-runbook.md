# Tabela Nutricional - implantação e validação

Este guia descreve como ativar e validar a área de Tabela Nutricional criada em Engenharia.

## Rotas criadas

- `/engenharia/tabela-nutricional`
  - Lista as fichas técnicas ativas em cards.
  - Ao clicar em uma ficha, mostra a tabela nutricional calculada.
  - Permite imprimir a tabela.
  - Permite salvar um snapshot do cálculo.

- `/engenharia/tabela-nutricional/produtos`
  - Lista produtos ativos do catálogo.
  - Permite cadastrar os nutrientes por 100 g ou 100 ml.
  - Alimenta automaticamente os cálculos das receitas.

## Migration necessária

Antes de testar as rotas em produção, aplicar a migration:

```bash
supabase db push
```

ou aplicar diretamente o arquivo:

```text
supabase/migrations/202605250001_add_nutrition_label_tables.sql
```

Essa migration cria:

- `public.product_nutrition_facts`
- `public.technical_sheet_nutrition_snapshots`

As políticas RLS usam `public.establishment_memberships` com `is_active = true`, seguindo o padrão atual das migrations mais recentes do projeto.

## Fluxo de uso

1. Acessar `/engenharia/tabela-nutricional/produtos`.
2. Pesquisar o produto/ingrediente usado nas fichas técnicas.
3. Preencher os valores por 100 g ou 100 ml:
   - valor energético;
   - carboidratos;
   - açúcares totais;
   - açúcares adicionados;
   - proteínas;
   - gorduras totais;
   - gorduras saturadas;
   - gorduras trans;
   - fibra alimentar;
   - sódio.
4. Informar a fonte dos dados, por exemplo:
   - rótulo do fornecedor;
   - ficha técnica do fabricante;
   - tabela de composição reconhecida;
   - laudo ou cálculo validado por responsável técnico.
5. Salvar.
6. Acessar `/engenharia/tabela-nutricional`.
7. Clicar na receita desejada.
8. Conferir o status:
   - `Completa`: todos os ingredientes têm dados nutricionais e quantidade/unidade válida;
   - `Parcial`: parte dos ingredientes tem dados válidos;
   - `Pendente`: faltam dados suficientes para cálculo confiável.
9. Revisar a tabela.
10. Salvar snapshot após validação.
11. Imprimir.

## Critérios de aceite

- A tela de produtos deve carregar todos os produtos ativos do estabelecimento.
- Ao salvar nutrientes de um produto, o card deve mudar de `Pendente` para `OK`.
- A tela de tabela nutricional deve refletir os novos valores sem exigir alteração na ficha técnica.
- Receitas com ingredientes sem `product_id`, sem cadastro nutricional ou com unidade não convertível devem aparecer como `Parcial` ou `Pendente`.
- A tabela deve exibir colunas de 100 g, porção e `%VD`.
- O botão de impressão deve abrir uma página limpa com apenas a tabela e metadados da receita.
- O botão de snapshot deve gravar em `technical_sheet_nutrition_snapshots`.

## Observações técnicas

- As unidades convertidas automaticamente para gramas são: `g`, `kg`, `mg`, `ml` e `l`.
- Para `ml` e `l`, o cálculo assume equivalência aproximada com gramas. Ingredientes com densidade diferente precisam de validação técnica.
- O sistema não inventa valores nutricionais. Quando não houver dado cadastrado no produto, a receita fica pendente/parcial.
- O cálculo usa os dados por 100 g/100 ml do produto e multiplica pela quantidade usada na ficha técnica.

## Validação regulatória

A tela foi estruturada para apoiar o modelo de rotulagem nutricional com nutrientes obrigatórios, porção, 100 g e `%VD`. Antes de uso oficial em embalagem ou comunicação ao consumidor, os dados e arredondamentos devem ser revisados por nutricionista ou responsável técnico conforme normas vigentes da ANVISA.
