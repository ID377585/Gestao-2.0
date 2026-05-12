"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
              <td>${escapeHtml(item.receitas.join(", "))}</td>
            </tr>
          `
        )
        .join("");

      return `
        <tr class="category-row">
          <td colspan="4">${escapeHtml(categoria)}</td>
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
        <th>Receitas</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || "<tr><td colspan=\"4\">Nenhum item calculado.</td></tr>"}
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
  const [selectedFichaIds, setSelectedFichaIds] = useState<string[]>([]);
  const [scalesByFichaId, setScalesByFichaId] = useState<Record<string, number>>({});
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

  useEffect(() => {
    setScalesByFichaId((prev) => {
      const next: Record<string, number> = {};

      selectedFichaIds.forEach((id) => {
        next[id] = Math.max(0.001, toNumber(prev[id], 1) || 1);
      });

      return next;
    });
  }, [selectedFichaIds]);

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

  const selectedFichas = useMemo(() => {
    const ids = new Set(selectedFichaIds);

    return fichas.filter((ficha) => ids.has(ficha.id));
  }, [fichas, selectedFichaIds]);

  const shoppingList = useMemo(() => {
    const map = new Map<string, ShoppingListItem>();

    selectedFichas.forEach((ficha) => {
      const scale = Math.max(0.001, toNumber(scalesByFichaId[ficha.id], 1) || 1);

      ficha.ingredientes.forEach((ingredient) => {
        const quantidade = Number((ingredient.quantidadeUso * scale).toFixed(3));
        const unidade = String(ingredient.unidadeUso || "UN").toUpperCase();
        const key = `${ingredient.productId || normalizeText(ingredient.nome)}::${unidade}`;
        const categoria = getProductCategory(
          ingredient,
          productsById,
          productsByName,
          products
        );
        const current = map.get(key);

        if (!current) {
          map.set(key, {
            key,
            productId: ingredient.productId,
            nome: ingredient.nome || "Ingrediente sem nome",
            categoria,
            quantidade,
            unidade,
            receitas: [ficha.nome],
          });

          return;
        }

        current.quantidade = Number((current.quantidade + quantidade).toFixed(3));
        if (!current.receitas.includes(ficha.nome)) current.receitas.push(ficha.nome);
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const categoryOrder = a.categoria.localeCompare(b.categoria, "pt-BR");
      if (categoryOrder !== 0) return categoryOrder;

      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [products, productsById, productsByName, scalesByFichaId, selectedFichas]);

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

  const canCalculate = selectedFichaIds.length > 0;

  const handleSelectFichas = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const ids = Array.from(event.currentTarget.selectedOptions).map(
      (option) => option.value
    );

    setSelectedFichaIds(ids);
    setHasCalculated(false);
  };

  const updateScale = (fichaId: string, value: string) => {
    const scale = Math.max(0.001, toNumber(value, 1));

    setScalesByFichaId((prev) => ({
      ...prev,
      [fichaId]: scale,
    }));
  };

  const exportCsv = () => {
    const rows = [
      ["Categoria", "Ingrediente", "Quantidade", "Unidade", "Receitas"],
      ...shoppingList.map((item) => [
        item.categoria,
        item.nome,
        formatQuantity(item.quantidade),
        item.unidade,
        item.receitas.join(", "),
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
            Selecione uma ou mais fichas técnicas, defina a escala de produção e
            gere uma lista de compras consolidada por categoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              <Label htmlFor="produto">Produto</Label>
              <select
                id="produto"
                multiple
                value={selectedFichaIds}
                onChange={handleSelectFichas}
                disabled={loading}
                className="min-h-60 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {fichas.map((ficha) => (
                  <option key={ficha.id} value={ficha.id}>
                    {ficha.nome}
                    {ficha.categoria ? ` — ${ficha.categoria}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Use Ctrl/Cmd ou Shift para selecionar várias receitas.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border bg-slate-50/70 p-4 dark:bg-slate-900/30">
              <div>
                <h3 className="font-semibold">Itens selecionados</h3>
                <p className="text-sm text-muted-foreground">
                  A escala inicia em 1X e multiplica todos os ingredientes da
                  ficha técnica.
                </p>
              </div>

              {selectedFichas.length === 0 ? (
                <div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
                  Nenhum produto selecionado.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedFichas.map((ficha) => (
                    <div
                      key={ficha.id}
                      className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[1fr_120px] sm:items-end"
                    >
                      <div>
                        <p className="font-medium">{ficha.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Rendimento base: {formatQuantity(ficha.rendimento)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`scale-${ficha.id}`}>Escala</Label>
                        <Input
                          id={`scale-${ficha.id}`}
                          type="number"
                          min="0.001"
                          step="0.5"
                          value={scalesByFichaId[ficha.id] ?? 1}
                          onChange={(event) =>
                            updateScale(ficha.id, event.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                className="w-full"
                disabled={!canCalculate || loading}
                onClick={() => setHasCalculated(true)}
              >
                Calcular Lista de Compra
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasCalculated ? (
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Lista de Compras</CardTitle>
              <CardDescription>
                {shoppingList.length} ingrediente(s) consolidado(s) em {groupedShoppingList.length} categoria(s).
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
                Nenhum ingrediente encontrado para as fichas selecionadas.
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
