"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type ProductCatalog = {
  id: string;
  name: string;
  unit: string;
  category: string;
  normalizedName: string;
};

type ShoppingListCategory = {
  label: string;
  items: Array<{
    id: string;
    name: string;
    unit: string;
  }>;
};

const SHOPPING_CATEGORY_LABELS = [
  "SECOS",
  "BEBIDAS",
  "HORTIFRUTI",
  "LATICÍNIOS",
  "AÇOUGUE (CARNES)",
  "FRUTOS DO MAR (PESCADOS)",
  "DESCARTÁVEIS",
  "EMBALAGENS",
  "PRODUTOS DE LIMPEZA",
] as const;

const glassCard =
  "rounded-2xl border border-white/40 bg-white/60 p-5 shadow-xl shadow-slate-900/10 backdrop-blur-xl";

function normalizeText(value: string) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function csvEscape(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function getProductNameFromRaw(product: any) {
  return String(
    product?.name ??
      product?.product_name ??
      product?.productName ??
      product?.ingredient_name ??
      product?.description ??
      product?.title ??
      ""
  ).trim();
}

function getProductUnitFromRaw(product: any) {
  return String(
    product?.default_unit_label ??
      product?.unit_label ??
      product?.unitLabel ??
      product?.purchase_unit ??
      product?.purchaseUnit ??
      product?.unit ??
      product?.unidade ??
      product?.measurement_unit ??
      product?.measurementUnit ??
      "UN"
  )
    .trim()
    .toUpperCase();
}

function getProductCategoryFromRaw(product: any) {
  return String(
    product?.sector_category ??
      product?.category ??
      product?.product_type ??
      product?.categoria ??
      product?.group_name ??
      product?.groupName ??
      product?.metadata?.sector_category ??
      product?.metadata?.category ??
      ""
  ).trim();
}

function resolveShoppingCategory(value: string) {
  const normalized = normalizeText(value);

  if (!normalized) return "";
  if (normalized.includes("seco")) return "SECOS";
  if (normalized.includes("bebida") || normalized.includes("bar")) return "BEBIDAS";
  if (
    normalized.includes("hortifruti") ||
    normalized.includes("horti fruti") ||
    normalized.includes("hortali") ||
    normalized.includes("legume") ||
    normalized.includes("verdura") ||
    normalized.includes("fruta")
  ) {
    return "HORTIFRUTI";
  }
  if (
    normalized.includes("laticinio") ||
    normalized.includes("lacteo") ||
    normalized.includes("leite") ||
    normalized.includes("queijo")
  ) {
    return "LATICÍNIOS";
  }
  if (
    normalized.includes("acougue") ||
    normalized.includes("carne") ||
    normalized.includes("carnes")
  ) {
    return "AÇOUGUE (CARNES)";
  }
  if (
    normalized.includes("frutos do mar") ||
    normalized.includes("pescado") ||
    normalized.includes("peixe") ||
    normalized.includes("camarao") ||
    normalized.includes("marisco")
  ) {
    return "FRUTOS DO MAR (PESCADOS)";
  }
  if (
    normalized.includes("descartavel") ||
    normalized.includes("descartaveis")
  ) {
    return "DESCARTÁVEIS";
  }
  if (normalized.includes("embalagem") || normalized.includes("embalagens")) {
    return "EMBALAGENS";
  }
  if (
    normalized.includes("limpeza") ||
    normalized.includes("higiene") ||
    normalized.includes("saneante")
  ) {
    return "PRODUTOS DE LIMPEZA";
  }

  return "";
}

export default function ListasDeComprasPage() {
  const [products, setProducts] = useState<ProductCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProductsCatalog = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/products/catalog", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Não foi possível carregar o catálogo de produtos.");
      }

      const result = await response.json();
      const list = Array.isArray(result)
        ? result
        : Array.isArray(result?.products)
          ? result.products
          : Array.isArray(result?.data)
            ? result.data
            : Array.isArray(result?.items)
              ? result.items
              : [];

      const mappedProducts = list
        .map((product: any) => {
          const name = getProductNameFromRaw(product);
          const rawCategory = getProductCategoryFromRaw(product);
          const category = resolveShoppingCategory(rawCategory);

          return {
            id: String(product.id ?? product.product_id ?? product.productId ?? name),
            name,
            unit: getProductUnitFromRaw(product) || "UN",
            category,
            normalizedName: normalizeText(name),
          };
        })
        .filter(
          (product: ProductCatalog) =>
            product.id && product.name && product.normalizedName && product.category
        );

      setProducts(mappedProducts);
    } catch (err: any) {
      console.error("Erro ao carregar listas de compras:", err);
      setError(err?.message ?? "Não foi possível carregar a lista de compras.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProductsCatalog();
  }, [loadProductsCatalog]);

  const groupedShoppingList = useMemo<ShoppingListCategory[]>(() => {
    return SHOPPING_CATEGORY_LABELS.map((label) => {
      const seen = new Set<string>();
      const items = products
        .filter((product) => product.category === label)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .filter((product) => {
          const key = `${product.normalizedName}|${product.unit}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((product) => ({
          id: product.id,
          name: product.name,
          unit: product.unit,
        }));

      return { label, items };
    });
  }, [products]);

  const totalItems = useMemo(
    () => groupedShoppingList.reduce((sum, group) => sum + group.items.length, 0),
    [groupedShoppingList]
  );

  const handleExportCsv = useCallback(() => {
    const rows = [["Categoria / Produto", "Unidade de medida", "Anotações"]];

    groupedShoppingList.forEach((group) => {
      rows.push([group.label, "", ""]);
      group.items.forEach((item) => {
        rows.push([item.name, item.unit, ""]);
      });
    });

    const csvContent = rows
      .map((row) => row.map((cell) => csvEscape(cell)).join(";"))
      .join("\n");

    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lista-de-compras.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [groupedShoppingList]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-100 p-6 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          body {
            background: #ffffff !important;
          }

          .screen-only {
            display: none !important;
          }

          .print-sheet {
            border: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            padding: 0 !important;
          }

          table {
            font-size: 10px !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          th,
          td {
            border: 1px solid #cbd5e1 !important;
            padding: 5px 7px !important;
          }

          .notes-cell {
            height: 24px !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6 print:max-w-none print:space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:block">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700 print:hidden">
              Engenharia
            </p>
            <h1 className="text-2xl font-bold text-slate-950 print:text-xl">Listas de Compras</h1>
            <p className="mt-1 text-sm text-slate-600 print:text-xs">
              Lista imprimível gerada a partir dos produtos ativos do catálogo,
              separada por categoria e pronta para anotações manuais.
            </p>
          </div>

          <div className="screen-only flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              Imprimir A4
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Exportar CSV
            </button>
            <Link
              href="/engenharia"
              className="rounded-xl bg-white/80 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:bg-white"
            >
              Voltar para Engenharia
            </Link>
          </div>
        </div>

        {loading ? (
          <div className={glassCard}>
            <p className="text-sm text-slate-600">Carregando catálogo de produtos...</p>
          </div>
        ) : error ? (
          <div className={glassCard}>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <>
            <div className="screen-only grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className={glassCard}>
                <div className="text-sm text-slate-600">Itens listados</div>
                <div className="mt-2 text-3xl font-bold text-slate-950">{totalItems}</div>
              </div>
              <div className={glassCard}>
                <div className="text-sm text-slate-600">Categorias exibidas</div>
                <div className="mt-2 text-3xl font-bold text-slate-950">
                  {SHOPPING_CATEGORY_LABELS.length}
                </div>
              </div>
              <div className={glassCard}>
                <div className="text-sm text-slate-600">Origem dos dados</div>
                <div className="mt-2 text-lg font-bold text-slate-950">
                  Catálogo de produtos ativo
                </div>
              </div>
            </div>

            <div className={`${glassCard} print-sheet`}>
              <div className="mb-4 flex flex-col gap-1 print:mb-2">
                <h2 className="text-xl font-bold text-slate-950 print:text-lg">Lista de Compras</h2>
                <p className="text-sm text-slate-600 print:text-xs">
                  Categorias: Secos, Bebidas, Hortifruti, Laticínios, Açougue
                  (Carnes), Frutos do Mar (Pescados), Descartáveis, Embalagens e
                  Produtos de Limpeza.
                </p>
              </div>

              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[760px] border-collapse text-sm print:min-w-0">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-left text-slate-800">
                      <th className="w-[56%] px-3 py-3">Categoria / Produto</th>
                      <th className="w-[16%] px-3 py-3">Unidade de medida</th>
                      <th className="w-[28%] px-3 py-3">Anotações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedShoppingList.map((group) => (
                      <Fragment key={group.label}>
                        <tr className="border-b border-slate-200 bg-slate-900 text-white">
                          <td className="px-3 py-2 font-extrabold uppercase" colSpan={3}>
                            {group.label}
                          </td>
                        </tr>
                        {group.items.length === 0 ? (
                          <tr className="border-b border-slate-200 bg-white/40">
                            <td className="px-3 py-3 text-slate-500" colSpan={3}>
                              Nenhum produto ativo encontrado nesta categoria.
                            </td>
                          </tr>
                        ) : (
                          group.items.map((item) => (
                            <tr key={`${group.label}-${item.id}`} className="border-b border-slate-200 bg-white/45">
                              <td className="px-3 py-3 font-semibold text-slate-950">
                                {item.name}
                              </td>
                              <td className="px-3 py-3 text-slate-800">{item.unit || "UN"}</td>
                              <td className="notes-cell px-3 py-3 text-slate-800">&nbsp;</td>
                            </tr>
                          ))
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
