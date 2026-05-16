"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { listTechnicalSheets } from "@/app/(dashboard)/dashboard/fichas-tecnicas/actions";

type ProductCatalog = {
  id: string;
  name: string;
  brand: string;
  normalizedName: string;
};

type IngredienteFicha = {
  id: string;
  productId: string | null;
  nome: string;
  quantidadeUso: number;
  unidadeUso: string;
  precoCompra: number;
  marca: string;
  custoIngrediente: number;
};

type FichaTecnica = {
  id: string;
  nome: string;
  categoria: string;
  setor: string;
  rendimento: number;
  pesoPorcao: number;
  custoTotal: number;
  custoPorPorcao: number;
  cmvAlvo: number;
  precoVenda: number;
  ativo: boolean;
  alergênicos: string;
  armazenamento: string;
  shelfLifeFrozen: string;
  shelfLifeRefrigerated: string;
  shelfLifeRoomTemp: string;
  ingredientes: IngredienteFicha[];
};

const PIE_COLORS = ["#16a34a", "#2563eb", "#7c3aed", "#f97316"];

const RED_GRADIENT = [
  "bg-red-700 text-white border-red-700",
  "bg-red-600 text-white border-red-600",
  "bg-red-500 text-white border-red-500",
  "bg-red-400 text-white border-red-400",
  "bg-red-300 text-red-950 border-red-300",
  "bg-red-200 text-red-950 border-red-200",
  "bg-red-100 text-red-950 border-red-100",
  "bg-red-50 text-red-950 border-red-100",
  "bg-red-50/70 text-red-950 border-red-100",
  "bg-white/70 text-red-950 border-red-100",
];

const BLUE_GRADIENT = [
  "bg-blue-700 text-white border-blue-700",
  "bg-blue-600 text-white border-blue-600",
  "bg-blue-500 text-white border-blue-500",
  "bg-blue-400 text-white border-blue-400",
  "bg-blue-300 text-blue-950 border-blue-300",
  "bg-blue-200 text-blue-950 border-blue-200",
  "bg-blue-100 text-blue-950 border-blue-100",
  "bg-blue-50 text-blue-950 border-blue-100",
  "bg-blue-50/70 text-blue-950 border-blue-100",
  "bg-white/70 text-blue-950 border-blue-100",
];

const ORANGE_GRADIENT = [
  "bg-orange-700 text-white border-orange-700",
  "bg-orange-600 text-white border-orange-600",
  "bg-orange-500 text-white border-orange-500",
  "bg-orange-400 text-white border-orange-400",
  "bg-orange-300 text-orange-950 border-orange-300",
  "bg-orange-200 text-orange-950 border-orange-200",
  "bg-orange-100 text-orange-950 border-orange-100",
  "bg-orange-50 text-orange-950 border-orange-100",
  "bg-orange-50/70 text-orange-950 border-orange-100",
  "bg-white/70 text-orange-950 border-orange-100",
];

const glassCard =
  "scroll-reveal print-card rounded-2xl border border-white/40 bg-white/55 p-5 shadow-xl shadow-slate-900/10 backdrop-blur-xl transition-all duration-700 ease-out";

const metricCard =
  "scroll-reveal print-card rounded-2xl border border-white/45 bg-white/60 p-5 shadow-lg shadow-slate-900/10 backdrop-blur-xl transition-all duration-700 ease-out";

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPesoPorcao(value: number) {
  const peso = Number.isFinite(Number(value)) ? Number(value) : 0;

  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(peso)} Gramas a Porção`;
}

function normalizeText(value: string) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeSector(value: string) {
  const normalized = String(value ?? "").trim();
  return normalized || "Sem setor";
}

function normalizeBrand(value: string) {
  const brand = String(value ?? "").trim();
  const normalized = normalizeText(brand);

  if (!brand) return "";
  if (normalized === "sem marca") return "";
  if (normalized === "null") return "";
  if (normalized === "undefined") return "";
  if (normalized === "-") return "";
  if (normalized === "nao informado") return "";
  if (normalized === "não informado") return "";

  return brand;
}

function getProductBrandFromRaw(product: any) {
  return normalizeBrand(
    product?.brand ??
      product?.brand_name ??
      product?.brandName ??
      product?.marca ??
      product?.manufacturer ??
      product?.manufacturer_name ??
      product?.supplier_brand ??
      product?.supplierBrand ??
      product?.supplier?.brand ??
      product?.supplier?.brand_name ??
      product?.supplier?.name ??
      product?.fornecedor ??
      product?.vendor ??
      product?.vendor_name ??
      product?.catalog_brand ??
      product?.product_brand ??
      product?.metadata?.brand ??
      product?.metadata?.marca ??
      ""
  );
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

function getIngredientProductId(ing: any) {
  return (
    ing.product_id ??
    ing.productId ??
    ing.catalog_product_id ??
    ing.catalogProductId ??
    ing.catalog_id ??
    ing.catalogId ??
    ing.product?.id ??
    ing.products?.id ??
    ing.ingredient_id ??
    ing.ingredientId ??
    ing.raw_material_id ??
    ing.rawMaterialId ??
    null
  );
}

function getIngredientName(ing: any) {
  return String(
    ing.ingredient_name ??
      ing.name ??
      ing.product_name ??
      ing.productName ??
      ing.product?.name ??
      ing.products?.name ??
      ing.product?.product_name ??
      ing.products?.product_name ??
      ""
  ).trim();
}

function findProductByIngredientName(
  ingredientName: string,
  productMapByName: Map<string, ProductCatalog>,
  productsList: ProductCatalog[]
) {
  const normalizedIngredientName = normalizeText(ingredientName);

  if (!normalizedIngredientName) return undefined;

  const exactMatch = productMapByName.get(normalizedIngredientName);

  if (exactMatch) return exactMatch;

  return productsList.find((product) => {
    if (!product.normalizedName) return false;

    return (
      product.normalizedName === normalizedIngredientName ||
      product.normalizedName.includes(normalizedIngredientName) ||
      normalizedIngredientName.includes(product.normalizedName)
    );
  });
}

function getIngredientBrand(ing: any, produtoCatalogo?: ProductCatalog) {
  return (
    normalizeBrand(produtoCatalogo?.brand ?? "") ||
    normalizeBrand(ing.brand) ||
    normalizeBrand(ing.product_brand) ||
    normalizeBrand(ing.productBrand) ||
    normalizeBrand(ing.product?.brand) ||
    normalizeBrand(ing.products?.brand) ||
    normalizeBrand(ing.product?.brand_name) ||
    normalizeBrand(ing.products?.brand_name) ||
    normalizeBrand(ing.product?.brandName) ||
    normalizeBrand(ing.products?.brandName) ||
    normalizeBrand(ing.marca) ||
    normalizeBrand(ing.product?.marca) ||
    normalizeBrand(ing.products?.marca) ||
    normalizeBrand(ing.manufacturer) ||
    normalizeBrand(ing.product?.manufacturer) ||
    normalizeBrand(ing.products?.manufacturer) ||
    "Sem marca"
  );
}

function isEmpratamento(value: string) {
  return normalizeText(value) === "empratamento";
}

function isPrePreparo(value: string) {
  const normalized = normalizeText(value);
  return normalized === "pre-preparo" || normalized === "pre preparo";
}

function isSetor(value: string, setor: string) {
  return normalizeText(value) === normalizeText(setor);
}

function buildCustoPorPorcaoChart(items: FichaTecnica[]) {
  return items
    .map((item) => ({
      nome: item.nome || "Sem nome",
      custoPorPorcao: Number(item.custoPorPorcao || 0),
    }))
    .sort((a, b) => b.custoPorPorcao - a.custoPorPorcao);
}

function isResfriado(value: string) {
  const normalized = normalizeText(value);
  return normalized.includes("resfri") || normalized.includes("refrig");
}

function hasValidAllergens(value: string) {
  const normalized = normalizeText(value);

  if (!normalized) return false;
  if (normalized === "nao contem") return false;
  if (normalized === "nao contém") return false;
  if (normalized === "sem alergênicos") return false;
  if (normalized === "sem alergenicos") return false;
  if (normalized === "nenhum") return false;

  return true;
}

function calcularCMV(custoPorPorcao: number, precoVenda: number) {
  if (!precoVenda || precoVenda <= 0) return 0;
  return (custoPorPorcao / precoVenda) * 100;
}

function parseShelfLifeDays(value: string) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getIngredienteMaisCaro(ficha: FichaTecnica) {
  return [...ficha.ingredientes].sort(
    (a, b) => b.custoIngrediente - a.custoIngrediente
  )[0];
}

function collectCurrentStyles() {
  const styleTags = Array.from(document.querySelectorAll("style"))
    .map((style) => style.outerHTML)
    .join("\n");

  const stylesheetLinks = Array.from(
    document.querySelectorAll('link[rel="stylesheet"]')
  )
    .map((link) => {
      const href = (link as HTMLLinkElement).href;
      return href ? `<link rel="stylesheet" href="${href}" />` : "";
    })
    .join("\n");

  return `${stylesheetLinks}\n${styleTags}`;
}

function getDashboardPrintStyles() {
  return `
    <style>
      @page {
        size: A4 landscape;
        margin: 6mm;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: Arial, Helvetica, sans-serif;
      }

      body {
        padding: 0;
      }

      .print-root {
        width: 100% !important;
        min-height: auto !important;
        overflow: visible !important;
        padding: 0 !important;
        background: linear-gradient(135deg, #ecfdf5, #f0f9ff, #f5f3ff) !important;
      }

      .print-root > .pointer-events-none,
      .print-root > .absolute {
        display: none !important;
      }

      .no-print {
        display: none !important;
      }

      .scroll-reveal {
        opacity: 1 !important;
        transform: none !important;
        scale: 1 !important;
      }

      .relative.z-10 {
        display: block !important;
        width: 100% !important;
      }

      .print-page {
        display: block !important;
        width: 100% !important;
        min-height: 185mm !important;
        break-after: page !important;
        page-break-after: always !important;
        padding: 0 !important;
      }

      .print-page:last-of-type {
        break-after: auto !important;
        page-break-after: auto !important;
      }

      .print-break-before {
        break-before: page !important;
        page-break-before: always !important;
      }

      .print-card {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        box-shadow: none !important;
        border: 1px solid rgba(15, 23, 42, 0.16) !important;
        background: rgba(255, 255, 255, 0.9) !important;
        backdrop-filter: none !important;
      }

      .print-table-card {
        break-inside: auto !important;
        page-break-inside: auto !important;
      }

      .recharts-wrapper,
      .recharts-responsive-container,
      .recharts-surface,
      svg {
        max-width: 100% !important;
      }

      .overflow-x-auto {
        overflow: visible !important;
      }

      .print-chart-large {
        height: 112mm !important;
        overflow: visible !important;
      }

      .print-chart-large > div {
        width: 100% !important;
        height: 112mm !important;
      }

      .print-chart-large .recharts-wrapper,
      .print-chart-large .recharts-responsive-container,
      .print-chart-large svg {
        width: 100% !important;
        height: 100% !important;
      }

      .print-chart-medium {
        height: 70mm !important;
        overflow: visible !important;
      }

      .print-chart-medium > div {
        width: 100% !important;
        height: 70mm !important;
      }

      .print-chart-medium .recharts-wrapper,
      .print-chart-medium .recharts-responsive-container,
      .print-chart-medium svg {
        width: 100% !important;
        height: 100% !important;
      }

      .print-grid-3 {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 5mm !important;
      }

      .print-grid-2 {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 5mm !important;
      }

      table {
        width: 100% !important;
        border-collapse: collapse !important;
        break-inside: auto !important;
        page-break-inside: auto !important;
      }

      thead {
        display: table-header-group !important;
      }

      tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      .print-table {
        min-width: 0 !important;
        font-size: 8.4px !important;
      }

      .print-table th,
      .print-table td {
        padding: 3px 5px !important;
      }

      .grid {
        display: grid;
      }

      .space-y-6 > :not([hidden]) ~ :not([hidden]) {
        margin-top: 1.5rem;
      }

      .space-y-3 > :not([hidden]) ~ :not([hidden]) {
        margin-top: 0.75rem;
      }

      @media print {
        html,
        body {
          width: auto !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
        }

        .print-root {
          overflow: visible !important;
        }
      }
    </style>
  `;
}

export default function EngenhariaDashboardPage() {
  const pageRef = useRef<HTMLDivElement | null>(null);

  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [products, setProducts] = useState<ProductCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const productById = useMemo(() => {
    return new Map(
      products
        .filter((product) => product.id)
        .map((product) => [product.id, product])
    );
  }, [products]);

  const productByName = useMemo(() => {
    return new Map(
      products
        .filter((product) => product.normalizedName)
        .map((product) => [product.normalizedName, product])
    );
  }, [products]);

  const handlePrint = useCallback(() => {
    const source = pageRef.current;

    if (!source) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank", "width=1440,height=900");

    if (!printWindow) {
      window.print();
      return;
    }

    const styles = collectCurrentStyles();
    const printStyles = getDashboardPrintStyles();
    const content = source.outerHTML;

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Dados de Engenharia de Cardápio</title>
          <base href="${window.location.origin}" />
          ${styles}
          ${printStyles}
        </head>
        <body>
          ${content}
          <script>
            let alreadyPrinted = false;

            function printDashboard() {
              if (alreadyPrinted) return;
              alreadyPrinted = true;

              window.focus();

              setTimeout(function () {
                window.print();
              }, 700);
            }

            window.addEventListener("load", function () {
              setTimeout(printDashboard, 900);
            });

            setTimeout(printDashboard, 1800);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, []);

  const loadProductsCatalog = useCallback(async () => {
    try {
      const response = await fetch("/api/products/catalog", {
        cache: "no-store",
      });

      if (!response.ok) return [];

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

      return list
        .map((product: any) => {
          const name = getProductNameFromRaw(product);

          return {
            id: String(product.id ?? product.product_id ?? product.productId ?? ""),
            name,
            brand: getProductBrandFromRaw(product),
            normalizedName: normalizeText(name),
          };
        })
        .filter((product: ProductCatalog) => product.id && product.normalizedName);
    } catch (err) {
      console.error("Erro ao carregar catálogo de produtos:", err);
      return [];
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [fichasRes, productsRes] = await Promise.all([
        listTechnicalSheets(),
        loadProductsCatalog(),
      ]);

      setProducts(productsRes);

      const typedProductsRes = productsRes as ProductCatalog[];

      const productMapById = new Map(
        typedProductsRes.map((p: ProductCatalog) => [p.id, p])
      );

      const productMapByName = new Map(
        typedProductsRes.map((p: ProductCatalog) => [p.normalizedName, p])
      );

      setFichas(
        (fichasRes ?? []).map((item: any) => {
          const rendimento = Number(item.yield_portions ?? 0);
          const custoTotal = Number(item.total_cost ?? 0);
          const custoPorPorcao =
            Number(item.cost_per_portion ?? 0) > 0
              ? Number(item.cost_per_portion ?? 0)
              : rendimento > 0
                ? custoTotal / rendimento
                : custoTotal;

          const ingredientes: IngredienteFicha[] = Array.isArray(item.ingredients)
            ? item.ingredients.map((ing: any) => {
                const rawProductId = getIngredientProductId(ing);
                const productId = rawProductId ? String(rawProductId) : null;
                const nome = getIngredientName(ing);

                const produtoCatalogo =
                  (productId ? productMapById.get(productId) : null) ??
                  findProductByIngredientName(
                    nome,
                    productMapByName,
                    typedProductsRes
                  );

                return {
                  id: String(ing.id ?? ""),
                  productId,
                  nome,
                  quantidadeUso: Number(ing.usage_quantity ?? 0),
                  unidadeUso: String(ing.usage_unit ?? "UN"),
                  precoCompra: Number(ing.purchase_price ?? 0),
                  marca: getIngredientBrand(ing, produtoCatalogo),
                  custoIngrediente: Number(ing.final_cost ?? 0),
                };
              })
            : [];

          return {
  id: String(item.id),
  nome: String(item.name ?? ""),
  categoria: String(item.category ?? "").trim(),
  setor: normalizeSector(String(item.sector ?? "")),
  rendimento,
  pesoPorcao: Number(item.portion_weight ?? 0),
  custoTotal,
  custoPorPorcao,
  cmvAlvo: Number(item.profit_margin_percent ?? 0),
  precoVenda: Number(item.sale_price ?? 0),
  ativo: item.active !== false,
  alergênicos: String(item.allergens ?? "").trim(),
  armazenamento: String(item.storage_instructions ?? "").trim(),
  shelfLifeFrozen: String(item.shelf_life_frozen ?? "").trim(),
  shelfLifeRefrigerated: String(item.shelf_life_refrigerated ?? "").trim(),
  shelfLifeRoomTemp: String(item.shelf_life_room_temp ?? "").trim(),
  ingredientes,
};
        })
      );
    } catch (err) {
      console.error("Erro ao carregar dashboard de engenharia:", err);
      setError("Não foi possível carregar o dashboard de engenharia.");
    } finally {
      setLoading(false);
    }
  }, [loadProductsCatalog]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const elements = Array.from(root.querySelectorAll(".scroll-reveal"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add(
            "translate-y-0",
            "opacity-100",
            "scale-100"
          );
          entry.target.classList.remove(
            "translate-y-8",
            "opacity-0",
            "scale-[0.98]"
          );
        });
      },
      { threshold: 0.12 }
    );

    elements.forEach((element) => {
      element.classList.add("translate-y-8", "opacity-0", "scale-[0.98]");
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [loading, error, fichas.length]);

  const fichasAtivas = useMemo(
    () => fichas.filter((item) => item.ativo !== false),
    [fichas]
  );

  const fichasEmpratamento = useMemo(
    () => fichasAtivas.filter((item) => isEmpratamento(item.categoria)),
    [fichasAtivas]
  );

  const fichasPrePreparo = useMemo(
    () => fichasAtivas.filter((item) => isPrePreparo(item.categoria)),
    [fichasAtivas]
  );

  const metrics = useMemo(() => {
    const total = fichasAtivas.length;

    const custoTotalMedio =
      total > 0
        ? fichasAtivas.reduce((sum, item) => sum + item.custoTotal, 0) / total
        : 0;

    const fichasComRendimento = fichasAtivas.filter(
      (item) => item.rendimento > 0
    );

    const custoPorPorcaoMedio =
      fichasComRendimento.length > 0
        ? fichasComRendimento.reduce(
            (sum, item) => sum + item.custoPorPorcao,
            0
          ) / fichasComRendimento.length
        : 0;

    const semRendimento = fichasAtivas.filter(
      (item) => item.rendimento <= 0
    ).length;

    const semCusto = fichasAtivas.filter((item) => item.custoTotal <= 0).length;

    const cmvMedio =
      total > 0
        ? fichasAtivas.reduce(
            (sum, item) =>
              sum + calcularCMV(item.custoPorPorcao, item.precoVenda),
            0
          ) / total
        : 0;

    const cmvAlvoMedio =
      total > 0
        ? fichasAtivas.reduce((sum, item) => sum + item.cmvAlvo, 0) / total
        : 0;

    return {
      total,
      custoTotalMedio,
      custoPorPorcaoMedio,
      semRendimento,
      semCusto,
      cmvMedio,
      cmvAlvoMedio,
    };
  }, [fichasAtivas]);

  const topMaisCaras = useMemo(() => {
    return [...fichasEmpratamento]
      .sort((a, b) => b.custoTotal - a.custoTotal)
      .slice(0, 10);
  }, [fichasEmpratamento]);

  const topMaisVantajosas = useMemo(() => {
    return [...fichasEmpratamento]
      .filter((item) => item.rendimento > 0 && item.custoPorPorcao > 0)
      .sort((a, b) => a.custoPorPorcao - b.custoPorPorcao)
      .slice(0, 10);
  }, [fichasEmpratamento]);

  const rankingEmpratamentoMaisCarasPorIngrediente = useMemo(() => {
  return [...fichasEmpratamento]
    .map((ficha) => ({
      ficha,
      ingrediente: getIngredienteMaisCaro(ficha),
    }))
    .filter(({ ingrediente }) => {
      return Boolean(ingrediente) && Number(ingrediente?.custoIngrediente || 0) > 0;
    })
    .sort(
      (a, b) =>
        Number(b.ingrediente?.custoIngrediente || 0) -
        Number(a.ingrediente?.custoIngrediente || 0)
    );
}, [fichasEmpratamento]);

  const alergênicosChart = useMemo(() => {
    return fichasEmpratamento
      .filter((item) => hasValidAllergens(item.alergênicos))
      .map((item) => ({
        nome: item.nome || "Sem nome",
        alergênicos: item.alergênicos,
        quantidade: item.alergênicos
          .split(",")
          .map((alergênico) => alergênico.trim())
          .filter(Boolean).length,
      }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 20);
  }, [fichasEmpratamento]);

  const shelfLifeCritico = useMemo(() => {
    return fichasPrePreparo
      .filter((ficha) => isResfriado(ficha.armazenamento))
      .map((ficha) => ({
        ficha,
        dias: parseShelfLifeDays(ficha.shelfLifeRefrigerated),
      }))
      .filter((item) => item.dias >= 1 && item.dias <= 7)
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 30);
  }, [fichasPrePreparo]);

  const fichasAtencao = useMemo(() => {
    return [...fichasAtivas]
      .filter(
        (item) =>
          item.rendimento <= 0 ||
          item.custoTotal <= 0 ||
          item.custoPorPorcao <= 0
      )
      .slice(0, 10);
  }, [fichasAtivas]);

  const porSetor = useMemo(() => {
    const grouped = fichasAtivas.reduce<Record<string, number>>((acc, item) => {
      const key = normalizeSector(item.setor);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([setor, quantidade]) => ({ setor, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [fichasAtivas]);

  const custoPorSetor = useMemo(() => {
    const grouped = fichasAtivas.reduce<
      Record<
        string,
        { quantidade: number; custoTotal: number; custoPorPorcao: number }
      >
    >((acc, item) => {
      const key = normalizeSector(item.setor);

      if (!acc[key]) {
        acc[key] = { quantidade: 0, custoTotal: 0, custoPorPorcao: 0 };
      }

      acc[key].quantidade += 1;
      acc[key].custoTotal += item.custoTotal;
      acc[key].custoPorPorcao += item.custoPorPorcao;

      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([setor, data]) => ({
        setor,
        quantidade: data.quantidade,
        custoTotalMedio:
          data.quantidade > 0 ? data.custoTotal / data.quantidade : 0,
        custoPorPorcaoMedio:
          data.quantidade > 0 ? data.custoPorPorcao / data.quantidade : 0,
      }))
      .sort((a, b) => b.custoTotalMedio - a.custoTotalMedio);
  }, [fichasAtivas]);

  const porCategoria = useMemo(() => {
    const grouped = fichasAtivas.reduce<Record<string, number>>((acc, item) => {
      const key = item.categoria?.trim() || "Sem categoria";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([categoria, quantidade]) => ({ categoria, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [fichasAtivas]);

  const cmvChart = useMemo(
    () => [
      {
        indicador: "CMV médio",
        valor: Number(metrics.cmvMedio.toFixed(1)),
      },
      {
        indicador: "CMV alvo",
        valor: Number(metrics.cmvAlvoMedio.toFixed(1)),
      },
    ],
    [metrics.cmvMedio, metrics.cmvAlvoMedio]
  );

  const pratosQuentesChart = useMemo(() => {
    return buildCustoPorPorcaoChart(
      fichasEmpratamento.filter((item) => isSetor(item.setor, "Cozinha"))
    );
  }, [fichasEmpratamento]);

  const sobremesasChart = useMemo(() => {
    return buildCustoPorPorcaoChart(
      fichasEmpratamento.filter((item) => isSetor(item.setor, "Confeitaria"))
    );
  }, [fichasEmpratamento]);

  const drinksBebidasChart = useMemo(() => {
    return buildCustoPorPorcaoChart(
      fichasEmpratamento.filter((item) => isSetor(item.setor, "Bar"))
    );
  }, [fichasEmpratamento]);

  const armazenamentoChart = useMemo(() => {
    const grouped = fichasAtivas.reduce<Record<string, number>>((acc, item) => {
      const normalized = normalizeText(item.armazenamento);
      let key = "Não informado";

      if (normalized.includes("congel")) key = "Congelado";
      else if (normalized.includes("resfri") || normalized.includes("refrig"))
        key = "Resfriado";
      else if (normalized.includes("ambiente")) key = "Temp. Ambiente";

      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return ["Congelado", "Resfriado", "Temp. Ambiente", "Não informado"]
      .map((tipo) => ({
        tipo,
        quantidade: grouped[tipo] ?? 0,
      }))
      .filter((item) => item.quantidade > 0);
  }, [fichasAtivas]);

  const renderCustoPorPorcaoChart = (
    chartData: typeof pratosQuentesChart,
    title: string,
    description: string,
    emptyMessage: string
  ) => (
    <div className={glassCard}>
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-slate-600">{emptyMessage}</p>
      ) : (
        <div className="print-chart-large h-[420px] w-full overflow-x-auto">
          <div
            style={{
              width: Math.max(chartData.length * 90, 900),
              height: 420,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 24, left: 24, bottom: 90 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="nome"
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                  height={100}
                  tick={{
                    fontSize: 11,
                    fontWeight: 800,
                    fill: "#0f172a",
                  }}
                />
                <YAxis
                  tickFormatter={(value) => formatMoney(Number(value))}
                  tick={{ fontSize: 12, fill: "#0f172a" }}
                />
                <Tooltip
                  formatter={(value) => [
                    formatMoney(Number(value)),
                    "Custo por porção",
                  ]}
                  labelFormatter={(label) => `Ficha: ${label}`}
                />
                <Bar
                  dataKey="custoPorPorcao"
                  name="Custo por porção"
                  radius={[8, 8, 0, 0]}
                  fill="#16a34a"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={pageRef}
      className="print-root relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-100 p-6"
    >
      <div className="pointer-events-none absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute right-[-120px] top-40 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-140px] left-1/3 h-96 w-96 rounded-full bg-violet-300/30 blur-3xl" />

      <div className="relative z-10 space-y-6">
        <div className="scroll-reveal flex flex-col gap-3 transition-all duration-700 ease-out md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Dados de Engenharia de Cardápio
            </h1>
            <p className="text-sm text-slate-600">
              Visão executiva das fichas técnicas com foco em custo, rendimento,
              CMV e distribuição por setor.
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-xl"
            >
              Imprimir
            </button>

            <Link
              href="/dashboard/fichas-tecnicas"
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              Fichas técnicas
            </Link>
          </div>
        </div>

        {loading ? (
          <div className={glassCard}>
            <p className="text-sm text-slate-600">Carregando dashboard...</p>
          </div>
        ) : error ? (
          <div className={glassCard}>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <>
            <section className="print-page space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className={metricCard}>
                  <div className="text-sm text-slate-600">
                    Fichas técnicas cadastradas
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-950">
                    {metrics.total}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Total de receitas ativas registradas no sistema.
                  </p>
                </div>

                <div className={metricCard}>
                  <div className="text-sm text-slate-600">Custo total médio</div>
                  <div className="mt-2 text-2xl font-bold text-slate-950">
                    {formatMoney(metrics.custoTotalMedio)}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Média do custo total por ficha técnica.
                  </p>
                </div>

                <div className={metricCard}>
                  <div className="text-sm text-slate-600">
                    Custo por porção médio
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-950">
                    {formatMoney(metrics.custoPorPorcaoMedio)}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Indicador útil para precificação e margem.
                  </p>
                </div>

                <div className={metricCard}>
                  <div className="text-sm text-slate-600">Fichas com atenção</div>
                  <div className="mt-2 text-2xl font-bold text-slate-950">
                    {metrics.semRendimento + metrics.semCusto}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Fichas sem rendimento ou sem custo calculado.
                  </p>
                </div>
              </div>

              <div className="print-grid-3 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className={glassCard}>
                  <h2 className="mb-1 text-lg font-semibold text-slate-950">
                    Fichas por categoria
                  </h2>
                  <p className="mb-4 text-sm text-slate-600">
                    Quantidade de fichas cadastradas em cada categoria.
                  </p>

                  <div className="print-chart-medium h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={porCategoria}
                        margin={{ top: 10, right: 16, left: 0, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="categoria"
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                          height={60}
                          tick={{
                            fontSize: 11,
                            fontWeight: 700,
                            fill: "#0f172a",
                          }}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => [
                            formatNumber(Number(value), 0),
                            "Fichas",
                          ]}
                        />
                        <Bar
                          dataKey="quantidade"
                          name="Fichas"
                          radius={[8, 8, 0, 0]}
                          fill="#2563eb"
                        >
                          <LabelList
                            dataKey="quantidade"
                            position="top"
                            formatter={(value: unknown) => formatNumber(Number(value), 0)}
                            style={{
                              fill: "#0f172a",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={glassCard}>
                  <h2 className="mb-1 text-lg font-semibold text-slate-950">
                    CMV médio x alvo
                  </h2>
                  <p className="mb-4 text-sm text-slate-600">
                    Participação visual entre CMV médio atual e CMV alvo médio.
                  </p>

                  <div className="print-chart-medium h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={cmvChart}
                          dataKey="valor"
                          nameKey="indicador"
                          cx="50%"
                          cy="48%"
                          outerRadius={78}
                          innerRadius={42}
                          paddingAngle={4}
                          label={({ name, value }) =>
                            `${name}: ${formatNumber(Number(value), 1)}%`
                          }
                        >
                          {cmvChart.map((entry, index) => (
                            <Cell
                              key={`cmv-cell-${entry.indicador}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [
                            `${formatNumber(Number(value), 1)}%`,
                            "Percentual",
                          ]}
                        />
                        <Legend verticalAlign="bottom" height={32} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={glassCard}>
                  <h2 className="mb-1 text-lg font-semibold text-slate-950">
                    Qtd de Fichas ativas por Setor
                  </h2>
                  <p className="mb-4 text-sm text-slate-600">
                    Distribuição operacional das fichas por setor.
                  </p>

                  <div className="print-chart-medium h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={porSetor}
                        margin={{ top: 10, right: 16, left: 0, bottom: 50 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="setor"
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                          height={70}
                          tick={{
                            fontSize: 11,
                            fontWeight: 700,
                            fill: "#0f172a",
                          }}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => [
                            formatNumber(Number(value), 0),
                            "Fichas",
                          ]}
                        />
                        <Bar
                          dataKey="quantidade"
                          name="Fichas"
                          radius={[8, 8, 0, 0]}
                          fill="#7c3aed"
                        >
                          <LabelList
                            dataKey="quantidade"
                            position="top"
                            formatter={(value: unknown) => formatNumber(Number(value), 0)}
                            style={{
                              fill: "#0f172a",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>

            <section className="print-page print-break-before space-y-6">
              {renderCustoPorPorcaoChart(
                pratosQuentesChart,
                "Custos por porção — Pratos Quentes",
                "Comparativo em reais do custo por porção das fichas de Empratamento do setor Cozinha.",
                "Nenhuma ficha de Empratamento do setor Cozinha encontrada."
              )}

              {renderCustoPorPorcaoChart(
                sobremesasChart,
                "Custos por porção — Sobremesas",
                "Comparativo em reais do custo por porção das fichas de Empratamento do setor Confeitaria.",
                "Nenhuma ficha de Empratamento do setor Confeitaria encontrada."
              )}

              {renderCustoPorPorcaoChart(
                drinksBebidasChart,
                "Custos por porção — Drinks e Bebidas",
                "Comparativo em reais do custo por porção das fichas de Empratamento do setor Bar.",
                "Nenhuma ficha de Empratamento do setor Bar encontrada."
              )}

              <div className="print-grid-2 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className={glassCard}>
                  <h2 className="mb-4 text-lg font-semibold text-slate-950">
                    Receitas mais caras — Empratamento
                  </h2>

                  {topMaisCaras.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      Nenhuma ficha de Empratamento encontrada.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {topMaisCaras.map((item, index) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border px-4 py-3 shadow-sm ${
                            RED_GRADIENT[index] ??
                            RED_GRADIENT[RED_GRADIENT.length - 1]
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-bold">
                                {index + 1}. {item.nome || "-"}
                              </div>
                              <div className="mt-1 text-xs opacity-85">
                                {item.setor || "Sem setor"} •{" "}
                                {item.categoria || "Sem categoria"} • rendimento{" "}
                                {formatNumber(item.rendimento)}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-extrabold">
                                {formatMoney(item.custoTotal)}
                              </div>
                              <div className="text-xs font-semibold opacity-90">
                                {formatPesoPorcao(item.pesoPorcao)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={glassCard}>
                  <h2 className="mb-4 text-lg font-semibold text-slate-950">
                    Receitas mais vantajosas — Empratamento
                  </h2>

                  {topMaisVantajosas.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      Nenhuma ficha de Empratamento encontrada.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {topMaisVantajosas.map((item, index) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border px-4 py-3 shadow-sm ${
                            BLUE_GRADIENT[index] ??
                            BLUE_GRADIENT[BLUE_GRADIENT.length - 1]
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-bold">
                                {index + 1}. {item.nome || "-"}
                              </div>
                              <div className="mt-1 text-xs opacity-85">
                                {item.setor || "Sem setor"} •{" "}
                                {item.categoria || "Sem categoria"} • rendimento{" "}
                                {formatNumber(item.rendimento)}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-extrabold">
                                {formatMoney(item.custoPorPorcao)}
                              </div>
                              <div className="text-xs font-semibold opacity-90">
                                {formatPesoPorcao(item.pesoPorcao)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="print-page print-break-before space-y-6">
              <div className="print-grid-2 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className={glassCard}>
                  <h2 className="mb-4 text-lg font-semibold text-slate-950">
                    Custo médio por setor
                  </h2>

                  {custoPorSetor.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      Nenhum setor encontrado.
                    </p>
                  ) : (
                    <div className="print-chart-medium h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={custoPorSetor}
                          layout="vertical"
                          margin={{ top: 10, right: 100, left: 70, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis
                            type="number"
                            tickFormatter={(value) => formatMoney(Number(value))}
                            tick={{ fontSize: 12, fill: "#0f172a" }}
                          />
                          <YAxis
                            type="category"
                            dataKey="setor"
                            width={90}
                            tick={{
                              fontSize: 12,
                              fontWeight: 700,
                              fill: "#0f172a",
                            }}
                          />
                          <Tooltip
                            formatter={(value) => [
                              formatMoney(Number(value)),
                              "Custo médio",
                            ]}
                          />
                          <Bar
                            dataKey="custoTotalMedio"
                            name="Custo médio"
                            radius={[0, 8, 8, 0]}
                            fill="#dc2626"
                          >
                            <LabelList
                              dataKey="custoTotalMedio"
                              position="right"
                              formatter={(value: unknown) => formatMoney(Number(value))}
                              style={{
                                fill: "#0f172a",
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className={glassCard}>
                  <h2 className="mb-4 text-lg font-semibold text-slate-950">
                    Fichas que precisam de atenção
                  </h2>

                  {fichasAtencao.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      Nenhuma ficha com inconsistência encontrada.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {fichasAtencao.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-white/40 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl"
                        >
                          <div className="font-medium text-slate-950">
                            {item.nome || "-"}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {item.setor || "Sem setor"} •{" "}
                            {item.categoria || "Sem categoria"} • rendimento{" "}
                            {formatNumber(item.rendimento)} • custo total{" "}
                            {formatMoney(item.custoTotal)} • custo por porção{" "}
                            {formatMoney(item.custoPorPorcao)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={`${glassCard} print-table-card`}>
                <h2 className="mb-1 text-lg font-semibold text-slate-950">
                  Ranking - Fichas de Empratamento mais caras devido ao Ingrediente utilizado
                </h2>
                <p className="mb-4 text-sm text-slate-600">
                  Ranking pelo custo proporcional do ingrediente utilizado na receita,
  exibindo o ingrediente mais caro com marca buscada no catálogo de produtos.
                </p>

                <div className="overflow-x-auto">
                  <table className="print-table min-w-[1100px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/50 text-left text-slate-700">
                        <th className="px-3 py-3">#</th>
                        <th className="px-3 py-3">Nome da Ficha</th>
                        <th className="px-3 py-3">Ingrediente mais caro</th>
                        <th className="px-3 py-3">Qtd</th>
                        <th className="px-3 py-3">Unidade</th>
                        <th className="px-3 py-3">Marca</th>
                        <th className="px-3 py-3 text-right">Preço de Custo</th>
                        <th className="px-3 py-3 text-right">Custo Qtd. Utilizada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingEmpratamentoMaisCarasPorIngrediente.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-3 py-6 text-center text-slate-600"
                          >
                            Nenhuma ficha de Empratamento com custo por porção
                            superior a R$ 1,00 encontrada.
                          </td>
                        </tr>
                      ) : (
                        rankingEmpratamentoMaisCarasPorIngrediente.map(
                          ({ ficha, ingrediente }, index) => {
                            const produtoCatalogo =
                              (ingrediente?.productId
                                ? productById.get(ingrediente.productId)
                                : null) ??
                              findProductByIngredientName(
                                ingrediente?.nome ?? "",
                                productByName,
                                products
                              );

                            const marcaFinal =
                              normalizeBrand(produtoCatalogo?.brand ?? "") ||
                              normalizeBrand(ingrediente?.marca ?? "") ||
                              "Sem marca";

                            return (
                              <tr
                                key={ficha.id}
                                className="border-b border-white/30 bg-white/25"
                              >
                                <td className="px-3 py-3 font-bold">
                                  {index + 1}
                                </td>
                                <td className="px-3 py-3 font-semibold">
                                  {ficha.nome || "-"}
                                </td>
                                <td className="px-3 py-3">
                                  {ingrediente?.nome || "Não informado"}
                                </td>
                                <td className="px-3 py-3">
                                  {formatNumber(
                                    ingrediente?.quantidadeUso ?? 0,
                                    3
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  {ingrediente?.unidadeUso || "-"}
                                </td>
                                <td className="px-3 py-3">{marcaFinal}</td>
                                <td className="px-3 py-3 text-right font-semibold">
                                  {formatMoney(ingrediente?.precoCompra ?? 0)}
                                </td>
                                <td className="px-3 py-3 text-right font-bold text-red-700">
                                  {formatMoney(ingrediente?.custoIngrediente ?? 0)}
                                </td>
                              </tr>
                            );
                          }
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="print-page print-break-before">
              <div className="print-grid-2 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className={glassCard}>
                  <h2 className="mb-1 text-lg font-semibold text-slate-950">
                    Receitas de Empratamento com alergênicos
                  </h2>
                  <p className="mb-4 text-sm text-slate-600">
                    Exibe apenas fichas de Empratamento que possuem alergênicos
                    cadastrados, ignorando “Não contém”.
                  </p>

                  {alergênicosChart.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      Nenhuma ficha de Empratamento com alergênicos encontrada.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {alergênicosChart.map((item, index) => (
                        <div
                          key={item.nome}
                          className={`rounded-xl border px-4 py-3 shadow-sm backdrop-blur-xl ${
                            ORANGE_GRADIENT[index] ??
                            ORANGE_GRADIENT[ORANGE_GRADIENT.length - 1]
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold">
                                {index + 1}. {item.nome}
                              </div>
                              <div className="mt-1 text-xs opacity-85">
                                {item.alergênicos}
                              </div>
                            </div>

                            <div className="rounded-full bg-white/30 px-3 py-1 text-xs font-bold shadow-sm backdrop-blur-xl">
                              {item.quantidade} item
                              {item.quantidade === 1 ? "" : "s"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className={glassCard}>
                    <h2 className="mb-1 text-lg font-semibold text-slate-950">
                      Fichas por tipo de armazenamento
                    </h2>
                    <p className="mb-4 text-sm text-slate-600">
                      Distribuição entre Congelado, Resfriado e Temperatura Ambiente.
                    </p>

                    <div className="print-chart-medium h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={armazenamentoChart}
                            dataKey="quantidade"
                            nameKey="tipo"
                            cx="50%"
                            cy="48%"
                            outerRadius={90}
                            innerRadius={45}
                            paddingAngle={4}
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {armazenamentoChart.map((entry, index) => (
                              <Cell
                                key={`storage-cell-${entry.tipo}`}
                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [
                              formatNumber(Number(value), 0),
                              "Fichas",
                            ]}
                          />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`${glassCard} print-table-card`}>
                    <h2 className="mb-1 text-lg font-semibold text-slate-950">
                      Pré-preparos resfriados com Shelf life crítico
                    </h2>
                    <p className="mb-4 text-sm text-slate-600">
                      Lista apenas fichas técnicas de Pré-preparo cadastradas como
                      Refrigerado, com validade entre 1 e 7 dias.
                    </p>

                    <div className="overflow-x-auto">
                      <table className="print-table min-w-[560px] w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/50 text-left text-slate-700">
                            <th className="px-3 py-3">Nome da Ficha</th>
                            <th className="px-3 py-3">Shelf life resfriado</th>
                            <th className="px-3 py-3">Armazenamento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shelfLifeCritico.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-3 py-6 text-center text-slate-600"
                              >
                                Nenhum Pré-preparo refrigerado com shelf life
                                entre 1 e 7 dias.
                              </td>
                            </tr>
                          ) : (
                            shelfLifeCritico.map(({ ficha, dias }) => (
                              <tr
                                key={ficha.id}
                                className="border-b border-white/30 bg-white/25"
                              >
                                <td className="px-3 py-3 font-semibold">
                                  {ficha.nome || "-"}
                                </td>
                                <td className="px-3 py-3 font-bold text-red-700">
                                  {dias} dia{dias === 1 ? "" : "s"}
                                </td>
                                <td className="px-3 py-3">Refrigerado</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
