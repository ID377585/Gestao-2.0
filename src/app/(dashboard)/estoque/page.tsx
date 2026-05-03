"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Package,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Sparkles,
} from "lucide-react";
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
    standard_cost?: number | null;
    sku?: string | null;
    default_unit_label?: string | null;
    product_type?: "INSU" | "PREP" | "PROD" | string | null;
    sector_category?: string | null;
  } | null;
};

type ProductMetaRow = {
  id: string;
  name?: string | null;
  product_type?: "INSU" | "PREP" | "PROD" | string | null;
  sector_category?: string | null;
  default_unit_label?: string | null;
  price?: number | null;
  standard_cost?: number | null;
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

type StockValuePieDatum = {
  name: string;
  quantity: number;
  amount: number;
  items: number;
  fill: string;
};

type UnitFamily = "KG" | "UNID" | "LT" | "OUTROS";

type ConsolidatedUnitBucket = {
  quantity: number;
  amount: number;
  items: number;
};

type MovementDiffRow = {
  productId: string;
  productName: string;
  sku: string;
  currentQty: number;
  previousQty: number;
  diffQty: number;
  currentValue: number;
  previousValue: number;
  diffValue: number;
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

const PIE_COLORS = ["#60a5fa", "#34d399", "#f59e0b"];

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

function normalizeSectorName(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  return raw || "Sem setor";
}

function getPositiveNumber(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function getProductUnitCost(product: StockRow["product"] | ProductMetaRow | null | undefined) {
  return (
    getPositiveNumber(product?.standard_cost) ||
    getPositiveNumber(product?.price)
  );
}

function getUnitNormalization(value: string | null | undefined): {
  family: UnitFamily;
  quantityFactor: number;
  displayUnit: string;
  sourceUnit: string;
} {
  const unit = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(".", "");

  if (unit === "KG") {
    return { family: "KG", quantityFactor: 1, displayUnit: "KG", sourceUnit: unit };
  }

  if (unit === "G" || unit === "GR" || unit === "GRAMA" || unit === "GRAMAS") {
    return {
      family: "KG",
      quantityFactor: 0.001,
      displayUnit: "KG",
      sourceUnit: unit,
    };
  }

  if (
    unit === "UN" ||
    unit === "UNID" ||
    unit === "UND" ||
    unit === "UNIDADE" ||
    unit === "UNIDADES"
  ) {
    return { family: "UNID", quantityFactor: 1, displayUnit: "UNID", sourceUnit: unit };
  }

  if (unit === "LT" || unit === "L" || unit === "LITRO" || unit === "LITROS") {
    return { family: "LT", quantityFactor: 1, displayUnit: "LT", sourceUnit: unit };
  }

  if (unit === "ML") {
    return {
      family: "LT",
      quantityFactor: 0.001,
      displayUnit: "LT",
      sourceUnit: unit,
    };
  }

  return {
    family: "OUTROS",
    quantityFactor: 1,
    displayUnit: unit || "Sem unidade",
    sourceUnit: unit,
  };
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
    const cost = getProductUnitCost(row.product);

    current.qty += Number.isFinite(qty) ? qty : 0;
    current.value +=
      (Number.isFinite(qty) ? qty : 0) * cost;

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

function CustomGlassTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string;
  formatter: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/20 bg-slate-950/80 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-xl">
      <div className="mb-1 font-medium">{label ?? payload[0]?.name}</div>
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

function ConsolidatedStockTooltip({
  active,
  payload,
  amountBase,
  quantityBase,
}: {
  active?: boolean;
  payload?: Array<{ payload?: StockValuePieDatum & { chartValue: number } }>;
  amountBase: number;
  quantityBase: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  const amountPercent = amountBase > 0 ? (item.amount / amountBase) * 100 : 0;
  const quantityPercent =
    quantityBase > 0 ? (item.quantity / quantityBase) * 100 : 0;

  return (
    <div className="rounded-2xl border border-white/20 bg-slate-950/85 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: item.fill }}
        />
        {item.name}
      </div>
      <div>Quantidade: {formatQty(item.quantity)}</div>
      <div>Valor: {formatCurrency(item.amount)}</div>
      <div>Itens: {item.items}</div>
      <div>
        Participação:{" "}
        {(amountBase > 0 ? amountPercent : quantityPercent)
          .toFixed(1)
          .replace(".", ",")}
        %
      </div>
    </div>
  );
}

function ConsolidatedStockPieChart({
  data,
  totalQuantity,
  totalAmount,
  unclassified,
}: {
  data: StockValuePieDatum[];
  totalQuantity: number;
  totalAmount: number;
  unclassified: ConsolidatedUnitBucket;
}) {
  const amountBase = data.reduce((acc, item) => acc + item.amount, 0);
  const quantityBase = data.reduce((acc, item) => acc + item.quantity, 0);
  const pieData = data
    .map((item) => ({
      ...item,
      chartValue: amountBase > 0 ? item.amount : item.quantity,
    }))
    .filter((item) => item.chartValue > 0);

  const hasChartData = pieData.length > 0;

  return (
    <GlassPanel
      title="Saldo consolidado"
      description="Soma das quantidades atuais e do valor financeiro por unidade monitorada."
      className="xl:col-span-2"
    >
      <div className={`${GLASS_INNER_CLASS} p-4`}>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-[360px] min-w-0 rounded-3xl border border-white/20 bg-white/20 p-3 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={
                      <ConsolidatedStockTooltip
                        amountBase={amountBase}
                        quantityBase={quantityBase}
                      />
                    }
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-slate-700 dark:text-slate-200">
                        {value}
                      </span>
                    )}
                  />
                  <Pie
                    data={pieData}
                    dataKey="chartValue"
                    nameKey="name"
                    innerRadius={82}
                    outerRadius={126}
                    paddingAngle={3}
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth={2}
                    labelLine={false}
                    label={({ name, payload }) =>
                      `${name}: ${formatQty(Number(payload?.quantity ?? 0))}`
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        fill={entry.fill}
                        fillOpacity={0.95}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[330px] items-center justify-center rounded-3xl border border-dashed border-white/30 bg-white/15 text-center dark:border-white/10 dark:bg-white/5">
                <div>
                  <div className="text-sm font-semibold">Sem saldo atual</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    As famílias KG, UNID e LT estão zeradas no estoque monitorado.
                  </div>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="max-w-[190px] rounded-2xl border border-white/35 bg-white/80 px-4 py-3 text-center shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Valor total em estoque
                </div>
                <div className="mt-1 text-xl font-bold">
                  {formatCurrency(totalAmount)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Soma das quantidades atuais: {formatQty(totalQuantity)}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {data.map((item) => {
              const amountPercentage =
                amountBase > 0 ? (item.amount / amountBase) * 100 : 0;
              const quantityPercentage =
                quantityBase > 0 ? (item.quantity / quantityBase) * 100 : 0;
              const barPercentage =
                amountBase > 0 ? amountPercentage : quantityPercentage;

              return (
                <div key={item.name} className={`${GLASS_INNER_CLASS} p-3`}>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="mt-1 h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      <div>
                        <div className="text-sm font-semibold">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.items} item(ns) • qtd atual: {formatQty(item.quantity)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">
                        {formatCurrency(item.amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {barPercentage.toFixed(1).replace(".", ",")}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded-xl bg-white/20 px-2 py-1 dark:bg-white/5">
                      Quantidade:{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatQty(item.quantity)}
                      </span>
                    </div>
                    <div className="rounded-xl bg-white/20 px-2 py-1 dark:bg-white/5">
                      Valor:{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/25 dark:bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, barPercentage))}%`,
                        backgroundColor: item.fill,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            <div className={`${GLASS_INNER_CLASS} p-3`}>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Total geral monitorado
              </div>
              <div className="mt-1 text-2xl font-bold">
                {formatCurrency(totalAmount)}
              </div>
              <div className="text-xs text-muted-foreground">
                Soma financeira calculada por quantidade atual x preço/custo unitário.
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Quantidade total somada: {formatQty(totalQuantity)}
              </div>
            </div>

            {unclassified.items > 0 ? (
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3 text-xs text-amber-950 shadow-sm backdrop-blur-md dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                <div className="font-semibold">Unidades fora do consolidado</div>
                <div className="mt-1">
                  {unclassified.items} item(ns) não entram na pizza KG - R$,
                  UNID - R$ e LT - R$.
                </div>
                <div className="mt-1">
                  Qtd: {formatQty(unclassified.quantity)} • Valor:{" "}
                  {formatCurrency(unclassified.amount)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

export default function EstoqueDashboardPage() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [recentMovements, setRecentMovements] = useState<RecentStockMovementRow[]>([]);
  const [productsMeta, setProductsMeta] = useState<ProductMetaRow[]>([]);
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
            product_type:
              row.product.product_type ??
              byId.get(String(row.product.id))?.product_type ??
              null,
            sector_category:
              row.product.sector_category ??
              byId.get(String(row.product.id))?.sector_category ??
              null,
          }
        : null,
    }));
  }, [stock, productsMeta]);

  const metrics = useMemo(() => {
    const totalProdutos = enrichedStock.length;
    const produtosCriticos = enrichedStock.filter((row) => getStatusFromRow(row) === "critico");
    const produtosBaixos = enrichedStock.filter((row) => getStatusFromRow(row) === "baixo");
    const produtosAcimaMax = enrichedStock.filter(
      (row) => Number(row.max_qty ?? 0) > 0 && Number(row.quantity ?? 0) > Number(row.max_qty ?? 0)
    );

    const valorTotal = enrichedStock.reduce((acc, row) => {
      const qty = Number(row.quantity ?? 0);
      const cost = getProductUnitCost(row.product);
      return acc + (Number.isFinite(qty) ? qty : 0) * cost;
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
      .filter((row) => Number(row.quantity ?? 0) > 0 && getProductUnitCost(row.product) > 0)
      .sort((a, b) => getProductUnitCost(b.product) - getProductUnitCost(a.product))
      .slice(0, 10);

    const consolidatedByUnit = enrichedStock.reduce<{
      kg: ConsolidatedUnitBucket;
      unid: ConsolidatedUnitBucket;
      lt: ConsolidatedUnitBucket;
      outros: ConsolidatedUnitBucket;
    }>(
      (acc, row) => {
        const unitInfo = getUnitNormalization(
          row.product?.default_unit_label ?? row.unit_label ?? ""
        );
        const qty = Number(row.quantity ?? 0);
        const cost = getProductUnitCost(row.product);
        const safeQty = Number.isFinite(qty) ? qty : 0;
        const normalizedQty = safeQty * unitInfo.quantityFactor;
        const amount = safeQty * cost;

        if (unitInfo.family === "KG") {
          acc.kg.quantity += normalizedQty;
          acc.kg.amount += amount;
          acc.kg.items += 1;
        } else if (unitInfo.family === "UNID") {
          acc.unid.quantity += normalizedQty;
          acc.unid.amount += amount;
          acc.unid.items += 1;
        } else if (unitInfo.family === "LT") {
          acc.lt.quantity += normalizedQty;
          acc.lt.amount += amount;
          acc.lt.items += 1;
        } else {
          acc.outros.quantity += normalizedQty;
          acc.outros.amount += amount;
          acc.outros.items += 1;
        }

        return acc;
      },
      {
        kg: { quantity: 0, amount: 0, items: 0 },
        unid: { quantity: 0, amount: 0, items: 0 },
        lt: { quantity: 0, amount: 0, items: 0 },
        outros: { quantity: 0, amount: 0, items: 0 },
      }
    );

    const saldoTotal =
      consolidatedByUnit.kg.quantity +
      consolidatedByUnit.unid.quantity +
      consolidatedByUnit.lt.quantity +
      consolidatedByUnit.outros.quantity;

    return {
      totalProdutos,
      produtosCriticos,
      produtosBaixos,
      produtosAcimaMax,
      saldoTotal,
      valorTotal,
      itensCriticos,
      itensAcimaMax,
      produtosMaisCaros,
      consolidatedByUnit,
    };
  }, [enrichedStock]);

  const monthComparison = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthBase = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthStart = startOfMonth(previousMonthBase);
    const previousMonthEnd = endOfMonth(previousMonthBase);

    const productById = new Map<
      string,
      { name: string; sku: string; price: number }
    >();

    for (const row of enrichedStock) {
      const productId = String(row.product?.id ?? "").trim();
      if (!productId) continue;

	      productById.set(productId, {
	        name: row.product?.name ?? "Produto sem vínculo",
	        sku: row.product?.sku ?? "—",
	        price: getProductUnitCost(row.product),
	      });
    }

    const currentByProduct = new Map<string, number>();
    const previousByProduct = new Map<string, number>();

    for (const movement of recentMovements) {
      const productId = String(movement.product_id ?? "").trim();
      if (!productId) continue;

      const qty = Math.abs(Number(movement.qty ?? 0));
      const safeQty = Number.isFinite(qty) ? qty : 0;
      if (safeQty <= 0) continue;

      if (isDateInRange(movement.created_at, currentMonthStart, currentMonthEnd)) {
        currentByProduct.set(
          productId,
          (currentByProduct.get(productId) ?? 0) + safeQty
        );
      } else if (
        isDateInRange(movement.created_at, previousMonthStart, previousMonthEnd)
      ) {
        previousByProduct.set(
          productId,
          (previousByProduct.get(productId) ?? 0) + safeQty
        );
      }
    }

    const productIds = new Set([
      ...Array.from(currentByProduct.keys()),
      ...Array.from(previousByProduct.keys()),
    ]);

    const rows: MovementDiffRow[] = Array.from(productIds)
      .map((productId) => {
        const product = productById.get(productId);
        const currentQty = currentByProduct.get(productId) ?? 0;
        const previousQty = previousByProduct.get(productId) ?? 0;
        const price = product?.price ?? 0;
        const currentValue = currentQty * price;
        const previousValue = previousQty * price;

        return {
          productId,
          productName: product?.name ?? "Produto não encontrado",
          sku: product?.sku ?? "—",
          currentQty,
          previousQty,
          diffQty: currentQty - previousQty,
          currentValue,
          previousValue,
          diffValue: currentValue - previousValue,
        };
      })
      .filter((row) => row.currentQty > 0 || row.previousQty > 0)
      .sort(
        (a, b) =>
          Math.abs(b.diffValue) - Math.abs(a.diffValue) ||
          Math.abs(b.diffQty) - Math.abs(a.diffQty) ||
          a.productName.localeCompare(b.productName, "pt-BR")
      )
      .slice(0, 20);

    const currentMonthQty = rows.reduce((acc, row) => acc + row.currentQty, 0);
    const previousMonthQty = rows.reduce((acc, row) => acc + row.previousQty, 0);
    const currentMonthValue = rows.reduce((acc, row) => acc + row.currentValue, 0);
    const previousMonthValue = rows.reduce((acc, row) => acc + row.previousValue, 0);

    return {
      rows,
      currentMonthQty,
      previousMonthQty,
      currentMonthValue,
      previousMonthValue,
      diffValueTotal: currentMonthValue - previousMonthValue,
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

  const consolidatedStockPieData = useMemo<StockValuePieDatum[]>(
    () => [
      {
        name: "KG - R$",
        quantity: metrics.consolidatedByUnit.kg.quantity,
        amount: metrics.consolidatedByUnit.kg.amount,
        items: metrics.consolidatedByUnit.kg.items,
        fill: PIE_COLORS[0],
      },
      {
        name: "UNID - R$",
        quantity: metrics.consolidatedByUnit.unid.quantity,
        amount: metrics.consolidatedByUnit.unid.amount,
        items: metrics.consolidatedByUnit.unid.items,
        fill: PIE_COLORS[1],
      },
      {
        name: "LT - R$",
        quantity: metrics.consolidatedByUnit.lt.quantity,
        amount: metrics.consolidatedByUnit.lt.amount,
        items: metrics.consolidatedByUnit.lt.items,
        fill: PIE_COLORS[2],
      },
    ],
    [metrics.consolidatedByUnit]
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
                    title: "Valor total em estoque",
                    value: loading ? "…" : formatCurrency(metrics.valorTotal),
                    description: "Valor atual do saldo consolidado do estoque.",
                    icon: <DollarSign className="h-4 w-4" />,
                    valueClassName: "text-base sm:text-lg",
                  },
                  {
                    title: "Produtos Cadastrados",
                    value: loading ? "…" : metrics.totalProdutos,
                    description: "Itens com saldo e metadados de estoque no estabelecimento.",
                    icon: <Package className="h-4 w-4" />,
                  },
                  {
                    title: "Estoque abaixo do Mínimo",
                    value: loading ? "…" : metrics.produtosCriticos.length,
                    description: "Itens com saldo abaixo do mínimo configurado.",
                    icon: <AlertTriangle className="h-4 w-4" />,
                    valueClassName: "text-red-600",
                  },
                ]}
              />
            </div>

            <div className="[&>div>div]:rounded-3xl [&>div>div]:border [&>div>div]:border-white/20 [&>div>div]:bg-white/10 [&>div>div]:backdrop-blur-xl [&>div>div]:shadow-[0_8px_32px_rgba(15,23,42,0.12)] dark:[&>div>div]:border-white/10 dark:[&>div>div]:bg-white/5">
              <DashboardStatGrid
                items={[
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
                    title: "Dif. mês anterior vs atual (R$)",
                    value: loading ? "…" : formatCurrency(monthComparison.diffValueTotal),
                    description: loading
                      ? "Carregando..."
                      : `Atual ${formatCurrency(monthComparison.currentMonthValue)} • Anterior ${formatCurrency(monthComparison.previousMonthValue)}`,
                    icon: <DollarSign className="h-4 w-4" />,
                    valueClassName: "text-base sm:text-lg",
                  },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <ConsolidatedStockPieChart
                data={consolidatedStockPieData}
                totalQuantity={metrics.saldoTotal}
                totalAmount={metrics.valorTotal}
                unclassified={metrics.consolidatedByUnit.outros}
              />

              <GlassPanel
                title="Resumo executivo"
                description="Leitura rápida do comportamento atual do estoque."
              >
                <div className="grid grid-cols-1 gap-3">
                  <div className={`${GLASS_INNER_CLASS} flex items-center justify-between p-3`}>
                    <span className="text-sm">Estoque abaixo do mínimo</span>
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

            <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
              <DashboardTableShell
                title="Dif. mês anterior vs atual (Qtd)"
                description="Listagem dos produtos que tiveram diferença entre o mês anterior e o mês atual, com quantidade e valor."
                empty={monthComparison.rows.length === 0}
                emptyState={
                  <p className="text-sm text-muted-foreground">
                    Não houve movimentações comparáveis entre o mês atual e o anterior.
                  </p>
                }
                footer={
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Atual: {formatQty(monthComparison.currentMonthQty)} • Anterior:{" "}
                      {formatQty(monthComparison.previousMonthQty)}
                    </span>
                    <span className="font-semibold">
                      Total diferença em R$: {formatCurrency(monthComparison.diffValueTotal)}
                    </span>
                  </div>
                }
              >
                <div className={`${GLASS_INNER_CLASS} overflow-hidden p-1`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Qtd Atual</TableHead>
                        <TableHead className="text-right">Qtd Anterior</TableHead>
                        <TableHead className="text-right">Dif. Qtd</TableHead>
                        <TableHead className="text-right">Dif. R$</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthComparison.rows.map((row) => (
                        <TableRow key={row.productId}>
                          <TableCell className="font-medium">
                            {row.productName}
                          </TableCell>
                          <TableCell>{row.sku}</TableCell>
                          <TableCell className="text-right">
                            {formatQty(row.currentQty)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatQty(row.previousQty)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                row.diffQty > 0
                                  ? "text-emerald-600 font-semibold"
                                  : row.diffQty < 0
                                    ? "text-red-600 font-semibold"
                                    : ""
                              }
                            >
                              {row.diffQty > 0 ? "+" : ""}
                              {formatQty(row.diffQty)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                row.diffValue > 0
                                  ? "text-emerald-600 font-semibold"
                                  : row.diffValue < 0
                                    ? "text-red-600 font-semibold"
                                    : ""
                              }
                            >
                              {row.diffValue > 0 ? "+" : ""}
                              {formatCurrency(row.diffValue)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </DashboardTableShell>
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
	                        const price = getProductUnitCost(row.product);

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
