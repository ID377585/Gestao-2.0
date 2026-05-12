"use client";

import {
  Fragment,
  type ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Download, Printer, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listTechnicalSheets } from "@/app/(dashboard)/dashboard/fichas-tecnicas/actions";

type ProductCatalogItem = {
  id: string;
  name: string;
  category: string;
  sectorCategory: string;
  normalizedName: string;
};

type IngredienteFicha = {
  id: string;
  productId: string | null;
  nome: string;
  quantidadeUso: number;
  unidadeUso: string;
};

type FichaTecnica = {
  id: string;
  nome: string;
  categoria: string;
  rendimento: number;
  ingredientes: IngredienteFicha[];
};

type SelectedFicha = FichaTecnica & {
  escala: number;
};

type ShoppingListItem = {
  key: string;
  productId: string | null;
  nome: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  receitas: string[];
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value || 0);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");

  if (/[",;\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getProductNameFromRaw(product: any) {
  return String(
    product?.name ??
      product?.product_name ??
      product?.productName ??
      product?.description ??
      product?.title ??
      ""
  ).trim();
}

function normalizeFichaFromDb(raw: any): FichaTecnica {
  return {
    id: String(raw.id),
    nome: String(raw.name ?? ""),
    categoria: String(raw.category ?? "").trim(),
    rendimento: Number(raw.yield_portions ?? 0),
    ingredientes: Array.isArray(raw.ingredients)
      ? raw.ingredients
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((item: any) => ({
            id: String(item.id ?? crypto.randomUUID()),
            productId: item.product_id ? String(item.product_id) : null,
            nome: String(item.ingredient_name ?? item.name ?? "").trim(),
            quantidadeUso: Number(item.usage_quantity ?? 0),
            unidadeUso: String(item.usage_unit ?? "UN").trim().toUpperCase(),
          }))
      : [],
  };
}

function normalizeProductFromCatalog(product: any): ProductCatalogItem {
  const name = getProductNameFromRaw(product);

  return {
    id: String(product.id ?? product.product_id ?? product.productId ?? ""),
    name,
    category: String(product.category ?? "").trim(),
    sectorCategory: String(product.sector_category ?? "").trim(),
    normalizedName: normalizeText(name),
  };
}

function getProductCategory(
  ingredient: IngredienteFicha,
  productsById: Map<string, ProductCatalogItem>,
  productsByName: Map<string, ProductCatalogItem>,
  products: ProductCatalogItem[]
) {
  const byId = ingredient.productId
    ? productsById.get(ingredient.productId) ?? null
    : null;

  const normalizedIngredient = normalizeText(ingredient.nome);
  const exactByName = normalizedIngredient
    ? productsByName.get(normalizedIngredient) ?? null
    : null;

  const fuzzyByName = normalizedIngredient
    ? products.find((product) => {
        if (!product.normalizedName) return false;

        return (
          product.normalizedName === normalizedIngredient ||
          product.normalizedName.includes(normalizedIngredient) ||
          normalizedIngredient.includes(product.normalizedName)
        );
      }) ?? null
    : null;

  const product = byId ?? exactByName ?? fuzzyByName;
  const category = product?.sectorCategory || product?.category;

  return category?.trim() || "Sem categoria";
}

function buildPrintHtml(groups: Array<[string, ShoppingListItem[]]>) {
  const rowsHtml = groups
    .map(([categoria, items]) => {
      const itemsHtml = items
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.nome)}</td>
              <td class="right">${formatQuantity(item.quantidade)}</td>
              <td>${escapeHtml(item.unidade)}</td>
            </tr>
          `
        )
        .join("");

      return `
        <tr class="category-row">
          <td colspan="3">${escapeHtml(categoria)}</td>
        </tr>
        ${itemsHtml}
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Lista Rápida de Compras</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px;
    color: #0f172a;
    font-family: Arial, Helvetica, sans-serif;
  }
  h1 { margin: 0 0 6px; font-size: 26px; }
  p { margin: 0 0 22px; color: #475569; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #dbe2ea; padding: 9px 10px; text-align: left; }
  th { background: #f1f5f9; font-weight: 700; }
  .category-row td { background: #e2e8f0; font-weight: 800; text-transform: uppercase; }
  .right { text-align: right; }
  @page { size: A4; margin: 12mm; }
</style>
</head>
<body>
  <h1>Lista Rápida de Compras</h1>
  <p>Resumo consolidado por categoria para produção.</p>
  <table>
    <thead>
      <tr>
        <th>Ingrediente</th>
        <th class="right">Quantidade</th>
        <th>Unidade</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || "<tr><td colspan=\"3\">Nenhum item calculado.</td></tr>"}
    </tbody>
  </table>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>
  `.trim();
}

export default function ListaRapidaPage() {
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [scalesByFichaId, setScalesByFichaId] = useState<Record<string, string>>({});
  const [removedFichaIds, setRemovedFichaIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasCalculated, setHasCalculated] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [fichasRes, productsRes] = await Promise.all([
          listTechnicalSheets(),
          fetch("/api/products/catalog", { cache: "no-store" }),
        ]);

        setFichas((fichasRes ?? []).map(normalizeFichaFromDb));

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          const list = Array.isArray(productsData) ? productsData : [];

          setProducts(
            list
              .map(normalizeProductFromCatalog)
              .filter((product: ProductCatalogItem) => product.id && product.name)
          );
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error("Erro ao carregar lista rápida:", err);
        setError("Não foi possível carregar fichas técnicas e produtos.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const productsById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const productsByName = useMemo(() => {
    return new Map(
      products
        .filter((product) => product.normalizedName)
        .map((product) => [product.normalizedName, product])
    );
  }, [products]);

  const visibleFichas = useMemo(() => {
    const removed = new Set(removedFichaIds);

    return fichas.filter((ficha) => !removed.has(ficha.id));
  }, [fichas, removedFichaIds]);

  const selectedFichas = useMemo<SelectedFicha[]>(() => {
    return visibleFichas
      .map((ficha) => {
        const escala = toNumber(scalesByFichaId[ficha.id], 0);

        return {
          ...ficha,
          escala,
        };
      })
      .filter((ficha) => ficha.escala > 0);
  }, [visibleFichas, scalesByFichaId]);

  const shoppingList = useMemo(() => {
    const map = new Map<string, ShoppingListItem>();

    selectedFichas.forEach((ficha) => {
      ficha.ingredientes.forEach((ingredient) => {
        const quantidade = Number((ingredient.quantidadeUso * ficha.escala).toFixed(3));
        const unidade = String(ingredient.unidadeUso || "UN").toUpperCase();
        const key = `${ingredient.productId || normalizeText(ingredient.nome)}::${unidade}`;
        const categoria = getProductCategory(
          ingredient,
          productsById,
          productsByName,
          products
        );
        const current = map.get(key);
        const recipeLabel = `${ficha.nome} (${formatQuantity(ficha.escala)}X)`;

        if (!current) {
          map.set(key, {
            key,
            productId: ingredient.productId,
            nome: ingredient.nome || "Ingrediente sem nome",
            categoria,
            quantidade,
            unidade,
            receitas: [recipeLabel],
          });

          return;
        }

        current.quantidade = Number((current.quantidade + quantidade).toFixed(3));
        if (!current.receitas.includes(recipeLabel)) current.receitas.push(recipeLabel);
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const categoryOrder = a.categoria.localeCompare(b.categoria, "pt-BR");
      if (categoryOrder !== 0) return categoryOrder;

      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [products, productsById, productsByName, selectedFichas]);

  const groupedShoppingList = useMemo(() => {
    const grouped = shoppingList.reduce<Record<string, ShoppingListItem[]>>(
      (acc, item) => {
        const key = item.categoria || "Sem categoria";
        acc[key] = acc[key] ?? [];
        acc[key].push(item);
        return acc;
      },
      {}
    );

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [shoppingList]);

  const canCalculate = selectedFichas.length > 0;

  const updateScale = (fichaId: string, value: string) => {
    setScalesByFichaId((prev) => ({
      ...prev,
      [fichaId]: value,
    }));
    setHasCalculated(false);
  };

  const handleScaleChange = (
    fichaId: string,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    updateScale(fichaId, event.target.value);
  };

  const removeFichaFromList = (fichaId: string) => {
    setRemovedFichaIds((prev) =>
      prev.includes(fichaId) ? prev : [...prev, fichaId]
    );
    setScalesByFichaId((prev) => {
      const next = { ...prev };
      delete next[fichaId];
      return next;
    });
    setHasCalculated(false);
  };

  const clearScales = () => {
    setScalesByFichaId({});
    setHasCalculated(false);
  };

  const restoreRemovedFichas = () => {
    setRemovedFichaIds([]);
    setHasCalculated(false);
  };

  const exportCsv = () => {
    const rows = [
      ["Categoria", "Ingrediente", "Quantidade", "Unidade"],
      ...shoppingList.map((item) => [
        item.categoria,
        item.nome,
        formatQuantity(item.quantidade),
        item.unidade,
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(";")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `lista-rapida-compras-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=1100,height=800");

    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintHtml(groupedShoppingList));
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Lista Rápida
          </CardTitle>
          <CardDescription>
            Digite a escala na frente de cada ficha técnica que deseja produzir e
            gere uma lista de compras consolidada de uma só vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-col gap-3 rounded-xl border bg-slate-50 p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between dark:bg-slate-900/40">
              <div className="space-y-1">
                <Label>Produto</Label>
                <p className="text-sm text-muted-foreground">
                  Preencha a escala somente nas receitas que entram na lista.
                  Exemplo: digite 1 para 1X, 2 para 2X, 10 para 10X ou 33,5 para 33,5X.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 sm:justify-end">
                {removedFichaIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    onClick={restoreRemovedFichas}
                  >
                    Restaurar removidos
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || selectedFichas.length === 0}
                  onClick={clearScales}
                  className="h-12 min-w-[170px] border-2 border-black bg-red-600 px-5 font-bold text-white shadow-sm transition-all hover:border-black hover:bg-red-700 hover:text-white disabled:opacity-50"
                >
                  Limpar escalas
                </Button>
                <Button
                  type="button"
                  disabled={!canCalculate || loading}
                  onClick={() => setHasCalculated(true)}
                  className="h-12 min-w-[230px] border-2 border-black bg-green-600 px-6 text-base font-bold text-white shadow-lg shadow-green-600/25 transition-all hover:bg-green-700 hover:text-white hover:shadow-green-700/30 disabled:opacity-50"
                >
                  Calcular Lista de Compra
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-36 text-right">Rendimento base</TableHead>
                    <TableHead className="w-48">Escala</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        Carregando fichas técnicas...
                      </TableCell>
                    </TableRow>
                  ) : fichas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma ficha técnica cadastrada.
                      </TableCell>
                    </TableRow>
                  ) : visibleFichas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        Todos os itens foram removidos desta lista. Use Restaurar removidos para exibir novamente.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleFichas.map((ficha) => {
                      const scaleValue = scalesByFichaId[ficha.id] ?? "";
                      const isActive = toNumber(scaleValue, 0) > 0;

                      return (
                        <TableRow
                          key={ficha.id}
                          className={isActive ? "bg-blue-50/60 dark:bg-blue-950/20" : undefined}
                        >
                          <TableCell>
                            <div className="font-medium">{ficha.nome}</div>
                            {ficha.categoria ? (
                              <div className="text-xs text-muted-foreground">
                                {ficha.categoria}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatQuantity(ficha.rendimento)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="Digite"
                                value={scaleValue}
                                onChange={(event) => handleScaleChange(ficha.id, event)}
                                className="h-9"
                              />
                              <button
                                type="button"
                                aria-label={`Remover ${ficha.nome} da lista rápida`}
                                title="Remover item desta lista"
                                onClick={() => removeFichaFromList(ficha.id)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-sm font-semibold text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                              >
                                X
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              Receitas com escala vazia ou zero não entram no cálculo. Você pode
              digitar livremente valores inteiros ou decimais, como 1, 2, 10 ou 33,5.
              Use o X para remover uma receita desta lista sem apagar a ficha técnica cadastrada.
            </p>
          </div>
        </CardContent>
      </Card>

      {hasCalculated ? (
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Lista de Compras</CardTitle>
              <CardDescription>
                {shoppingList.length} ingrediente(s) consolidado(s) em {groupedShoppingList.length} categoria(s),
                com {selectedFichas.length} receita(s) selecionada(s).
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={shoppingList.length === 0}
                onClick={exportCsv}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={shoppingList.length === 0}
                onClick={handlePrint}
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {shoppingList.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum ingrediente encontrado para as fichas com escala informada.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Receitas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedShoppingList.map(([categoria, items]) => (
                      <Fragment key={categoria}>
                        <TableRow className="bg-slate-100 dark:bg-slate-900">
                          <TableCell colSpan={4} className="font-semibold uppercase">
                            {categoria}
                          </TableCell>
                        </TableRow>
                        {items.map((item) => (
                          <TableRow key={item.key}>
                            <TableCell className="font-medium">{item.nome}</TableCell>
                            <TableCell className="text-right">
                              {formatQuantity(item.quantidade)}
                            </TableCell>
                            <TableCell>{item.unidade}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.receitas.join(", ")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
