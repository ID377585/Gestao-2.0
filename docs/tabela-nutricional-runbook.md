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
  - Permite exportar produtos para CSV.
  - Permite importar CSV preenchido para atualizar nutrientes em lote.
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

## Fluxo por CSV

Use este fluxo quando houver muitos produtos para preencher.

1. Acessar `/engenharia/tabela-nutricional/produtos`.
2. Selecionar o filtro desejado:
   - `Pendentes`, para exportar apenas produtos sem nutrientes;
   - `Com nutrientes`, para revisar produtos já preenchidos;
   - `Produtos`, para exportar todos.
3. Clicar em `Exportar CSV`.
4. Preencher os valores nutricionais na planilha exportada.
5. Salvar como CSV mantendo a coluna `product_id`.
6. Clicar em `Importar CSV`.
7. Selecionar o arquivo preenchido.
8. Conferir a mensagem de sucesso e revisar os cards atualizados.

### Regras do CSV

- O arquivo pode usar separador `;` ou `,`.
- O sistema aceita números com vírgula decimal brasileira, por exemplo `12,5`.
- O sistema aceita números com ponto decimal, por exemplo `12.5`.
- A coluna `product_id` é obrigatória e não deve ser alterada.
- A importação atualiza até 500 produtos por vez.
- Produtos de outro estabelecimento são recusados.
- Linhas sem `product_id` são ignoradas.

### Colunas exportadas/importadas

| Coluna | Obrigatória | Descrição |
| --- | --- | --- |
| `product_id` | Sim | Identificador interno do produto. Não editar. |
| `produto` | Não | Nome do produto para conferência visual. |
| `marca` | Não | Marca do produto para conferência visual. |
| `categoria` | Não | Categoria/setor para conferência visual. |
| `unidade_base` | Não | Indicação de referência, geralmente 100 g ou 100 ml. |
| `valor_energetico_kcal_100g` | Não | Valor energético por 100 g/100 ml. |
| `carboidratos_g_100g` | Não | Carboidratos por 100 g/100 ml. |
| `acucares_totais_g_100g` | Não | Açúcares totais por 100 g/100 ml. |
| `acucares_adicionados_g_100g` | Não | Açúcares adicionados por 100 g/100 ml. |
| `proteinas_g_100g` | Não | Proteínas por 100 g/100 ml. |
| `gorduras_totais_g_100g` | Não | Gorduras totais por 100 g/100 ml. |
| `gorduras_saturadas_g_100g` | Não | Gorduras saturadas por 100 g/100 ml. |
| `gorduras_trans_g_100g` | Não | Gorduras trans por 100 g/100 ml. |
| `fibra_alimentar_g_100g` | Não | Fibra alimentar por 100 g/100 ml. |
| `sodio_mg_100g` | Não | Sódio por 100 g/100 ml. |
| `fonte` | Não | Origem dos dados nutricionais. |
| `observacoes` | Não | Observações internas. |

## Critérios de aceite

- A tela de produtos deve carregar todos os produtos ativos do estabelecimento.
- Ao salvar nutrientes de um produto, o card deve mudar de `Pendente` para `OK`.
- Ao importar CSV válido, os produtos importados devem mudar para `OK`.
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
- A importação CSV faz `upsert`, ou seja, cria o registro nutricional se não existir e atualiza se já existir.

## Validação regulatória

A tela foi estruturada para apoiar o modelo de rotulagem nutricional com nutrientes obrigatórios, porção, 100 g e `%VD`. Antes de uso oficial em embalagem ou comunicação ao consumidor, os dados e arredondamentos devem ser revisados por nutricionista ou responsável técnico conforme normas vigentes da ANVISA.
