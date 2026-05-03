"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Package,
  TrendingDown,
  TrendingUp,
  Scale,
  Beef,
  CookingPot,
  Package2,
  DollarSign,
  BarChart3,
  Layers3,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardStatGrid } from "@/components/dashboard/DashboardStatGrid";
import { DashboardTableShell } from "@/components/dashboard/DashboardTableShell";
import {
  getLastClosedInventorySession,
  listCurrentStock,
  listRecentStockMovements,
  seedInitialStockFromProducts,
  type RecentStockMovementRow,
} from "@/app/(dashboard)/dashboard/estoque/actions";

export const dynamic = "force-dynamic";

type StockRow = {
  id: string;
  quantity: number;
  unit_label: string | null;
  min_qty: number | null;
  med_qty: number | null;
  max_qty: number | null;
  location: string | null;
  product: {
    id: string;
    name: string;
    price: number | null;
    sku?: string | null;
    default_unit_label?: string | null;
  } | null;
};

type ProductMetaRow = {
  id: string;
  name?: string | null;
  product_type?: "INSU" | "PREP" | "PROD" | string | null;
  sector_category?: string | null;
  default_unit_label?: string | null;
  price?: number | null;
  is_active?: boolean | null;
};

type EnrichedStockRow = StockRow & {
  meta: {
    product_type: "INSU" | "PREP" | "PROD" | string | null;
    sector_category: string | null;
  } | null;
};

type StatusEstoque = "critico" | "baixo" | "normal";

type ChartDatum = {
  name: string;
  qty: number;
  value: number;
};

type MiniDatum = {
  name: string;
  value: number;
};

const CHART_BAR_COLORS = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#22d3ee",
  "#f97316",
  "#818cf8",
  "#84cc16",
  "#f472b6",
  "#14b8a6",
  "#c084fc",
];

const GLASS_CARD_CLASS =
  "border border-white/20 bg-white/10 shadow-[0_8px_32px_rgba(15,23,42,0.14)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/12 dark:border-white/10 dark:bg-white/5";

const GLASS_INNER_CLASS =
  "rounded-2xl border border-white/20 bg-white/20 backdrop-blur-md dark:border-white/10 dark:bg-white/5";

function getStatusFromRow(row: StockRow): StatusEstoque {
  const quantity = Number(row.quantity ?? 0);
  const min = Number(row.min_qty ?? 0);
  const med = Number(row.med_qty ?? 0);

  if (quantity < min) return "critico";
  if (quantity < med) return "baixo";
  return "normal";
}

function getStatusLabel(status: StatusEstoque) {
  if (status === "critico") return "Crítico";
  if (status === "baixo") return "Baixo";
  return "Normal";
}

function getStatusBadgeClass(status: StatusEstoque) {
  if (status === "critico") return "bg-red-600 text-white hover:bg-red-600";
  if (status === "baixo") return "bg-yellow-500 text-white hover:bg-yellow-500";
  return "bg-green-600 text-white hover:bg-green-600";
}

function formatQty(value: number | null | undefined) {
  const safe = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number.isFinite(safe) ? safe : 0);
}

function formatCurrency(value: number | null | undefined) {
  const safe = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(safe) ? safe : 0);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isDateInRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
}

function formatDelta(current: number, previous: number) {
  const diff = current - previous;
  const signal = diff > 0 ? "+" : "";
  return `${signal}${formatQty(diff)}`;
}

function normalizeSectorName(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  return raw || "Sem setor";
}

function normalizeUnitFamily(value: string | null | undefined) {
  const unit = String(value ?? "").trim().toUpperCase();

  if (unit === "KG" || unit === "G") return "KG";
  if (unit === "UN") return "UNIDADE";
  return "OUTROS";
}

function buildChartData(rows: EnrichedStockRow[], allowedTypes: string[]) {
  const map = new Map<string, ChartDatum>();

  for (const row of rows) {
    const type = String(row.meta?.product_type ?? "").toUpperCase();
    if (!allowedTypes.includes(type)) continue;

    const category = normalizeSectorName(row.meta?.sector_category);
    const current = map.get(category) ?? {
      name: category,
      qty: 0,
      value: 0,
    };

    const qty = Number(row.quantity ?? 0);
    const price = Number(row.product?.price ?? 0);

    current.qty += Number.isFinite(qty) ? qty : 0;
    current.value +=
      (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0);

    map.set(category, current);
  }

  return Array.from(map.values())
    .sort(
      (a, b) =>
        b.value - a.value || b.qty - a.qty || a.name.localeCompare(b.name, "pt-BR")
    )
    .slice(0, 12);
}

async function loadProductsMeta(): Promise<ProductMetaRow[]> {
  const endpoints = ["/api/products/catalog", "/api/products"];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) continue;

      const json = await res.json();

      if (Array.isArray(json)) return json as ProductMetaRow[];
      if (Array.isArray(json?.data)) return json.data as ProductMetaRow[];
      if (Array.isArray(json?.items)) return json.items as ProductMetaRow[];
      if (Array.isArray(json?.products)) return json.products as ProductMetaRow[];
    } catch (error) {
      console.error(`Falha ao consultar ${endpoint}:`, error);
    }
  }

  return [];
}

function getMiniChartColor(index: number) {
  return CHART_BAR_COLORS[index % CHART_BAR_COLORS.length];
}

function GlassPanel({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`${GLASS_CARD_CLASS} rounded-3xl ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MetricBar({
  label,
  value,
  maxValue,
  colorClass,
}: {
  label: string;
  value: number;
  maxValue: number;
  colorClass: string;
}) {
  const percentage = maxValue > 0 ? Math.max(6, (value / maxValue) * 100) : 6;

  return (
    <div className={`${GLASS_INNER_CLASS} p-3`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold">{formatQty(value)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/25 dark:bg-white/10">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
}

function MiniHorizontalBars({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: MiniDatum[];
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);

  return (
    <GlassPanel title={title} description={description}>
      <div className="space-y-3">
        {data.map((item, index) => (
          <MetricBar
            key={item.name}
            label={item.name}
            value={item.value}
            maxValue={maxValue}
            colorClass={index % 2 === 0 ? "bg-blue-500/80" : "bg-emerald-500/80"}
          />
        ))}
      </div>
    </GlassPanel>
  );
}

function CustomGlassTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  formatter: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/20 bg-slate-950/80 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-xl">
      <div className="mb-1 font-medium">{label}</div>
      <div>{formatter(Number(payload[0]?.value ?? 0))}</div>
    </div>
  );
}

function HorizontalStockChart({
  title,
  description,
  data,
  valueKey,
  formatValue,
}: {
  title: string;
  description: string;
  data: ChartDatum[];
  valueKey: "qty" | "value";
  formatValue: (value: number) => string;
}) {
  return (
    <Card
      className={`${GLASS_CARD_CLASS} relative overflow-hidden rounded-3xl before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_34%)] before:pointer-events-none`}
    >
      <CardHeader className="relative z-10">
        <div className="mb-2 flex items-center gap-2 text-sky-700 dark:text-sky-300">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">
            Visual analítico
          </span>
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="relative z-10">
        {data.length === 0 ? (
          <div className={`${GLASS_INNER_CLASS} p-6`}>
            <p className="text-sm text-muted-foreground">
              Não há dados suficientes para montar este gráfico.
            </p>
          </div>
        ) : (
          <div className={`${GLASS_INNER_CLASS} p-4`}>
            <div className="h-[430px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 8, right: 36, left: 8, bottom: 8 }}
                  barCategoryGap={10}
                >
                  <CartesianGrid
                    stroke="rgba(148,163,184,0.18)"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => formatValue(Number(value))}
                    fontSize={12}
                    tick={{ fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={132}
                    fontSize={12}
                    tick={{ fill: "currentColor" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={
                      <CustomGlassTooltip
                        formatter={(value) => formatValue(value)}
                      />
                    }
                    cursor={{ fill: "rgba(255,255,255,0.08)" }}
                  />
                  <Bar
                    dataKey={valueKey}
                    radius={[10, 10, 10, 10]}
                    maxBarSize={30}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        fill={CHART_BAR_COLORS[index % CHART_BAR_COLORS.length]}
                        fillOpacity={0.9}
                      />
                    ))}
                    <LabelList
                      dataKey={valueKey}
                      position="right"
                      formatter={(value) => formatValue(Number(value ?? 0))}
                      className="fill-slate-700 dark:fill-slate-200"
                      fontSize={11}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EstoqueDashboardPage() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [recentMovements, setRecentMovements] = useState<RecentStockMovementRow[]>([]);
  const [productsMeta, setProductsMeta] = useState<ProductMetaRow[]>([]);
  const [lastClosedInventoryAt, setLastClosedInventoryAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        setError("");

        let currentStock = (await listCurrentStock()) as StockRow[];

        if (currentStock.length === 0) {
          try {
            await seedInitialStockFromProducts();
            currentStock = (await listCurrentStock()) as StockRow[];
          } catch (seedError) {
            console.error("Falha ao semear estoque inicial no dashboard:", seedError);
          }
        }

        setStock(currentStock);

        try {
          const movements = (await listRecentStockMovements()) as RecentStockMovementRow[];
          setRecentMovements(movements ?? []);
        } catch (movementError) {
          console.error("Falha ao buscar movimentações recentes:", movementError);
          setRecentMovements([]);
        }

        try {
          const lastClosed = await getLastClosedInventorySession();
          setLastClosedInventoryAt(
            (lastClosed as any)?.finished_at ?? (lastClosed as any)?.started_at ?? null
          );
        } catch (inventoryError) {
          console.error("Falha ao buscar último inventário:", inventoryError);
          setLastClosedInventoryAt(null);
        }

        try {
          const meta = await loadProductsMeta();
          setProductsMeta(meta ?? []);
        } catch (metaError) {
          console.error("Falha ao buscar metadados de produtos:", metaError);
          setProductsMeta([]);
        }
      } catch (err: any) {
        console.error("Erro ao carregar dashboard de estoque:", err);
        setError(err?.message ?? "Erro ao carregar dados do estoque.");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const enrichedStock = useMemo<EnrichedStockRow[]>(() => {
    const byId = new Map<string, ProductMetaRow>();
    for (const item of productsMeta) {
      byId.set(String(item.id), item);
    }

    return stock.map((row) => ({
      ...row,
      meta: row.product?.id
        ? {
            product_type: byId.get(String(row.product.id))?.product_type ?? null,
            sector_category: byId.get(String(row.product.id))?.sector_category ?? null,
          }
        : null,
    }));
  }, [stock, productsMeta]);

  const metrics = useMemo(() => {
    const totalProdutos = enrichedStock.length;
    const produtosSemSaldo = enrichedStock.filter((row) => Number(row.quantity ?? 0) <= 0);
    const produtosCriticos = enrichedStock.filter((row) => getStatusFromRow(row) === "critico");
    const produtosBaixos = enrichedStock.filter((row) => getStatusFromRow(row) === "baixo");
    const produtosAcimaMax = enrichedStock.filter(
      (row) => Number(row.max_qty ?? 0) > 0 && Number(row.quantity ?? 0) > Number(row.max_qty ?? 0)
    );

    const saldoTotal = enrichedStock.reduce(
      (acc, row) => acc + (Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : 0),
      0
    );

    const valorTotal = enrichedStock.reduce((acc, row) => {
      const qty = Number(row.quantity ?? 0);
      const price = Number(row.product?.price ?? 0);
      return acc + (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0);
    }, 0);

    const itensCriticos = [...enrichedStock]
      .filter((row) => getStatusFromRow(row) !== "normal")
      .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
      .slice(0, 10);

    const itensAcimaMax = [...produtosAcimaMax]
      .sort(
        (a, b) =>
          Number(b.quantity ?? 0) -
          Number(b.max_qty ?? 0) -
          (Number(a.quantity ?? 0) - Number(a.max_qty ?? 0))
      )
      .slice(0, 10);

    const produtosMaisCaros = [...enrichedStock]
      .filter((row) => Number(row.quantity ?? 0) > 0 && Number(row.product?.price ?? 0) > 0)
      .sort((a, b) => Number(b.product?.price ?? 0) - Number(a.product?.price ?? 0))
      .slice(0, 10);

    const countByType = {
      INSU: enrichedStock.filter(
        (row) => String(row.meta?.product_type ?? "").toUpperCase() === "INSU"
      ).length,
      PREP: enrichedStock.filter(
        (row) => String(row.meta?.product_type ?? "").toUpperCase() === "PREP"
      ).length,
      PROD: enrichedStock.filter(
        (row) => String(row.meta?.product_type ?? "").toUpperCase() === "PROD"
      ).length,
    };

    const countByUnitFamily = enrichedStock.reduce(
      (acc, row) => {
        const family = normalizeUnitFamily(
          row.product?.default_unit_label ?? row.unit_label ?? ""
        );

        if (family === "KG") acc.kg += 1;
        else if (family === "UNIDADE") acc.un += 1;
        else acc.outros += 1;

        return acc;
      },
      { kg: 0, un: 0, outros: 0 }
    );

    return {
      totalProdutos,
      produtosSemSaldo,
      produtosCriticos,
      produtosBaixos,
      produtosAcimaMax,
      saldoTotal,
      valorTotal,
      itensCriticos,
      itensAcimaMax,
      produtosMaisCaros,
      countByType,
      countByUnitFamily,
    };
  }, [enrichedStock]);

  const monthComparison = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const previousMonthBase = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthStart = startOfMonth(previousMonthBase);
    const previousMonthEnd = endOfMonth(previousMonthBase);

    const priceByProductId = new Map<string, number>();
    for (const row of enrichedStock) {
      if (row.product?.id) {
        priceByProductId.set(String(row.product.id), Number(row.product?.price ?? 0));
      }
    }

    const currentMonthMovements = recentMovements.filter((mv) =>
      isDateInRange(mv.created_at, currentMonthStart, currentMonthEnd)
    );

    const previousMonthMovements = recentMovements.filter((mv) =>
      isDateInRange(mv.created_at, previousMonthStart, previousMonthEnd)
    );

    const currentMonthQty = currentMonthMovements.reduce(
      (acc, mv) => acc + Math.abs(Number(mv.qty ?? 0)),
      0
    );

    const previousMonthQty = previousMonthMovements.reduce(
      (acc, mv) => acc + Math.abs(Number(mv.qty ?? 0)),
      0
    );

    const currentMonthValue = currentMonthMovements.reduce((acc, mv) => {
      const price = priceByProductId.get(String(mv.product_id ?? "")) ?? 0;
      return acc + Math.abs(Number(mv.qty ?? 0)) * price;
    }, 0);

    const previousMonthValue = previousMonthMovements.reduce((acc, mv) => {
      const price = priceByProductId.get(String(mv.product_id ?? "")) ?? 0;
      return acc + Math.abs(Number(mv.qty ?? 0)) * price;
    }, 0);

    return {
      currentMonthQty,
      previousMonthQty,
      currentMonthValue,
      previousMonthValue,
    };
  }, [recentMovements, enrichedStock]);

  const insumosChartData = useMemo(
    () => buildChartData(enrichedStock, ["INSU"]),
    [enrichedStock]
  );

  const prepProdChartData = useMemo(
    () => buildChartData(enrichedStock, ["PREP", "PROD"]),
    [enrichedStock]
  );

  const productTypeMiniData = useMemo<MiniDatum[]>(
    () => [
      { name: "Insumos", value: metrics.countByType.INSU },
      { name: "Pré-preparos", value: metrics.countByType.PREP },
      { name: "Produtos", value: metrics.countByType.PROD },
    ],
    [metrics.countByType]
  );

  const unitMiniData = useMemo<MiniDatum[]>(
    () => [
      { name: "KG / G", value: metrics.countByUnitFamily.kg },
      { name: "UNIDADE", value: metrics.countByUnitFamily.un },
      { name: "Outros", value: metrics.countByUnitFamily.outros },
    ],
    [metrics.countByUnitFamily]
  );

  return (
    <div className="relative space-y-6 overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_22%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_24%),linear-gradient(180deg,rgba(248,250,252,0.82),rgba(241,245,249,0.92))] p-1 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_22%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.86),rgba(15,23,42,0.94))]">
      <div className="space-y-6 rounded-[30px] px-3 py-4 sm:px-5">
        <DashboardPageHeader
          eyebrow="Estoque"
          title="Dashboard de Estoque"
          description="Visão executiva do estoque com indicadores, comparativos mensais, listas, rankings e gráficos."
          actions={
            <>
              <Button asChild variant="outline" className={`${GLASS_CARD_CLASS} rounded-full`}>
                <Link href="/dashboard/entradas">Entradas</Link>
              </Button>
              <Button asChild variant="outline" className={`${GLASS_CARD_CLASS} rounded-full`}>
                <Link href="/dashboard/inventario">Inventário</Link>
              </Button>
              <Button asChild variant="outline" className={`${GLASS_CARD_CLASS} rounded-full`}>
                <Link href="/dashboard/perdas">Perdas</Link>
              </Button>
              <Button asChild className="rounded-full bg-slate-900/90 text-white hover:bg-slate-900 dark:bg-white/90 dark:text-slate-900 dark:hover:bg-white">
                <Link href="/dashboard/estoque">Abrir Estoque</Link>
              </Button>
            </>
          }
        />

        {error ? (
          <DashboardTableShell
            title="Falha no carregamento"
            description="O dashboard não conseguiu montar os indicadores do estoque."
            empty
            emptyState={
              <div className="space-y-3">
                <p className="text-sm text-red-600">{error}</p>
                <p className="text-sm text-muted-foreground">
                  A área operacional continua disponível em{" "}
                  <Link href="/dashboard/estoque" className="underline underline-offset-4">
                    /dashboard/estoque
                  </Link>
                  .
                </p>
              </div>
            }
          >
            <div />
          </DashboardTableShell>
        ) : (
          <>
            <div className="[&>div>div]:rounded-3xl [&>div>div]:border [&>div>div]:border-white/20 [&>div>div]:bg-white/10 [&>div>div]:backdrop-blur-xl [&>div>div]:shadow-[0_8px_32px_rgba(15,23,42,0.12)] dark:[&>div>div]:border-white/10 dark:[&>div>div]:bg-white/5">
              <DashboardStatGrid
                items={[
                  {
                    title: "Produtos monitorados",
                    value: loading ? "…" : metrics.totalProdutos,
                    description: "Itens com saldo e metadados de estoque no estabelecimento.",
                    icon: <Package className="h-4 w-4" />,
                  },
                  {
                    title: "Sem saldo",
                    value: loading ? "…" : metrics.produtosSemSaldo.length,
                    description: "Produtos zerados no saldo atual.",
                    icon: <TrendingDown className="h-4 w-4" />,
                  },
                  {
                    title: "Qtd. Estoque Abaixo da Qtd Mín",
                    value: loading ? "…" : metrics.produtosCriticos.length,
                    description: "Itens com saldo abaixo do mínimo configurado.",
                    icon: <AlertTriangle className="h-4 w-4" />,
                    valueClassName: "text-red-600",
                  },
                  {
                    title: "Último inventário",
                    value: loading
                      ? "…"
                      : lastClosedInventoryAt
                        ? formatDateTime(lastClosedInventoryAt)
                        : "—",
                    description: "Data do último inventário encerrado.",
                    icon: <ClipboardList className="h-4 w-4" />,
                    valueClassName: "text-base sm:text-lg",
                  },
                ]}
              />
            </div>

            <div className="[&>div>div]:rounded-3xl [&>div>div]:border [&>div>div]:border-white/20 [&>div>div]:bg-white/10 [&>div>div]:backdrop-blur-xl [&>div>div]:shadow-[0_8px_32px_rgba(15,23,42,0.12)] dark:[&>div>div]:border-white/10 dark:[&>div>div]:bg-white/5">
              <DashboardStatGrid
                items={[
                  {
                    title: "Saldo consolidado",
                    value: loading ? "…" : formatQty(metrics.saldoTotal),
                    description: "Soma das quantidades atuais de todos os itens monitorados.",
                    icon: <Boxes className="h-4 w-4" />,
                  },
                  {
                    title: "Qtd Estoque abaixo do Ideal",
                    value: loading ? "…" : metrics.produtosBaixos.length,
                    description: "Itens entre o mínimo e o nível médio configurado.",
                    icon: <TrendingDown className="h-4 w-4" />,
                    valueClassName: "text-yellow-600",
                  },
                  {
                    title: "Qtd acima da Qtd Máxima",
                    value: loading ? "…" : metrics.produtosAcimaMax.length,
                    description: "Produtos com saldo acima do máximo configurado.",
                    icon: <TrendingUp className="h-4 w-4" />,
                  },
                  {
                    title: "Valor total em estoque",
                    value: loading ? "…" : formatCurrency(metrics.valorTotal),
                    description: "Valor atual do saldo consolidado do estoque.",
                    icon: <DollarSign className="h-4 w-4" />,
                    valueClassName: "text-base sm:text-lg",
                  },
                ]}
              />
            </div>

            <div className="[&>div>div]:rounded-3xl [&>div>div]:border [&>div>div]:border-white/20 [&>div>div]:bg-white/10 [&>div>div]:backdrop-blur-xl [&>div>div]:shadow-[0_8px_32px_rgba(15,23,42,0.12)] dark:[&>div>div]:border-white/10 dark:[&>div>div]:bg-white/5">
              <DashboardStatGrid
                items={[
                  {
                    title: "Dif. mês anterior vs atual (Qtd)",
                    value: loading
                      ? "…"
                      : formatDelta(
                          monthComparison.currentMonthQty,
                          monthComparison.previousMonthQty
                        ),
                    description: loading
                      ? "Carregando..."
                      : `Atual ${formatQty(monthComparison.currentMonthQty)} • Anterior ${formatQty(monthComparison.previousMonthQty)}`,
                    icon: <Scale className="h-4 w-4" />,
                  },
                  {
                    title: "Dif. mês anterior vs atual (R$)",
                    value: loading
                      ? "…"
                      : formatCurrency(
                          monthComparison.currentMonthValue -
                            monthComparison.previousMonthValue
                        ),
                    description: loading
                      ? "Carregando..."
                      : `Atual ${formatCurrency(monthComparison.currentMonthValue)} • Anterior ${formatCurrency(monthComparison.previousMonthValue)}`,
                    icon: <BarChart3 className="h-4 w-4" />,
                    valueClassName: "text-base sm:text-lg",
                  },
                  {
                    title: "Qtd de itens em KG",
                    value: loading ? "…" : metrics.countByUnitFamily.kg,
                    description: "Produtos cuja unidade principal é KG ou G.",
                    icon: <Scale className="h-4 w-4" />,
                  },
                  {
                    title: "Qtd de itens em Unidade",
                    value: loading ? "…" : metrics.countByUnitFamily.un,
                    description: "Produtos cuja unidade principal é UN.",
                    icon: <Package2 className="h-4 w-4" />,
                  },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <MiniHorizontalBars
                title="Produtos por tipo"
                description="Agora em formato visual, substituindo cards simples por barras de leitura rápida."
                data={productTypeMiniData}
              />

              <MiniHorizontalBars
                title="Unidades de estoque"
                description="Distribuição visual da família de unidades em estoque."
                data={unitMiniData}
              />

              <GlassPanel
                title="Resumo executivo"
                description="Leitura rápida do comportamento atual do estoque."
              >
                <div className="grid grid-cols-1 gap-3">
                  <div className={`${GLASS_INNER_CLASS} flex items-center justify-between p-3`}>
                    <span className="text-sm">Estoque crítico</span>
                    <span className="text-sm font-semibold">
                      {metrics.produtosCriticos.length} item(ns)
                    </span>
                  </div>
                  <div className={`${GLASS_INNER_CLASS} flex items-center justify-between p-3`}>
                    <span className="text-sm">Estoque abaixo do ideal</span>
                    <span className="text-sm font-semibold">
                      {metrics.produtosBaixos.length} item(ns)
                    </span>
                  </div>
                  <div className={`${GLASS_INNER_CLASS} flex items-center justify-between p-3`}>
                    <span className="text-sm">Acima da quantidade máxima</span>
                    <span className="text-sm font-semibold">
                      {metrics.produtosAcimaMax.length} item(ns)
                    </span>
                  </div>
                  <div className={`${GLASS_INNER_CLASS} flex items-center justify-between p-3`}>
                    <span className="text-sm">Produtos sem saldo</span>
                    <span className="text-sm font-semibold">
                      {metrics.produtosSemSaldo.length} item(ns)
                    </span>
                  </div>
                </div>
              </GlassPanel>
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <HorizontalStockChart
                title="Insumos por setor"
                description="Gráfico horizontal com quantidade em estoque por setor de insumos."
                data={insumosChartData}
                valueKey="qty"
                formatValue={(value) => formatQty(value)}
              />

              <HorizontalStockChart
                title="Insumos por setor em R$"
                description="Gráfico horizontal com valor total em estoque por setor de insumos."
                data={insumosChartData}
                valueKey="value"
                formatValue={(value) => formatCurrency(value)}
              />

              <HorizontalStockChart
                title="Produtos e pré-preparos por setor"
                description="Gráfico horizontal com quantidade em estoque por setor produtivo."
                data={prepProdChartData}
                valueKey="qty"
                formatValue={(value) => formatQty(value)}
              />

              <HorizontalStockChart
                title="Produtos e pré-preparos por setor em R$"
                description="Gráfico horizontal com valor total em estoque por setor produtivo."
                data={prepProdChartData}
                valueKey="value"
                formatValue={(value) => formatCurrency(value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
                <DashboardTableShell
                  title="Itens de atenção"
                  description="Produtos com saldo crítico ou baixo, ordenados pelos menores saldos."
                  empty={metrics.itensCriticos.length === 0}
                  emptyState={
                    <p className="text-sm text-muted-foreground">
                      Nenhum item crítico ou baixo no estoque atual.
                    </p>
                  }
                  footer={
                    <p className="text-xs text-muted-foreground">
                      Para ajustar limites, inventário e movimentações, abra a área operacional de estoque.
                    </p>
                  }
                >
                  <div className={`${GLASS_INNER_CLASS} overflow-hidden p-1`}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead className="text-right">Mín.</TableHead>
                          <TableHead className="text-right">Méd.</TableHead>
                          <TableHead>Local</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.itensCriticos.map((row) => {
                          const status = getStatusFromRow(row);
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">
                                {row.product?.name ?? "Produto sem vínculo"}
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusBadgeClass(status)}>
                                  {getStatusLabel(status)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {formatQty(row.quantity)} {row.unit_label ?? ""}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatQty(row.min_qty)} {row.unit_label ?? ""}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatQty(row.med_qty)} {row.unit_label ?? ""}
                              </TableCell>
                              <TableCell>{row.location ?? "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </DashboardTableShell>
              </div>

              <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
                <DashboardTableShell
                  title="Qtd de Produtos em Estoque acima da Qtd Máxima"
                  description="Listagem dos itens com saldo acima do limite máximo configurado."
                  empty={metrics.itensAcimaMax.length === 0}
                  emptyState={
                    <p className="text-sm text-muted-foreground">
                      Nenhum item acima da quantidade máxima configurada.
                    </p>
                  }
                >
                  <div className={`${GLASS_INNER_CLASS} overflow-hidden p-1`}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead className="text-right">Máx.</TableHead>
                          <TableHead className="text-right">Excedente</TableHead>
                          <TableHead>Local</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.itensAcimaMax.map((row) => {
                          const excedente =
                            Number(row.quantity ?? 0) - Number(row.max_qty ?? 0);

                          return (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">
                                {row.product?.name ?? "Produto sem vínculo"}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatQty(row.quantity)} {row.unit_label ?? ""}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatQty(row.max_qty)} {row.unit_label ?? ""}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatQty(excedente)} {row.unit_label ?? ""}
                              </TableCell>
                              <TableCell>{row.location ?? "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </DashboardTableShell>
              </div>
            </div>

            <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
              <DashboardTableShell
                title="Produtos com preço de compra mais caros em estoque"
                description="Ranking dos itens com maior preço unitário de compra entre os produtos com saldo."
                empty={metrics.produtosMaisCaros.length === 0}
                emptyState={
                  <p className="text-sm text-muted-foreground">
                    Nenhum produto com preço de compra disponível para ranking.
                  </p>
                }
              >
                <div className={`${GLASS_INNER_CLASS} overflow-hidden p-1`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Preço unit.</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="text-right">Valor em estoque</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Setor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.produtosMaisCaros.map((row) => {
                        const qty = Number(row.quantity ?? 0);
                        const price = Number(row.product?.price ?? 0);

                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">
                              {row.product?.name ?? "Produto sem vínculo"}
                            </TableCell>
                            <TableCell>{row.product?.sku ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(price)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatQty(qty)} {row.unit_label ?? ""}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(qty * price)}
                            </TableCell>
                            <TableCell>
                              {String(row.meta?.product_type ?? "—")
                                .replace("INSU", "Insumo")
                                .replace("PREP", "Pré-preparo")
                                .replace("PROD", "Produto")}
                            </TableCell>
                            <TableCell>
                              {normalizeSectorName(row.meta?.sector_category)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </DashboardTableShell>
            </div>
          </>
        )}
      </div>
    </div>
  );
}