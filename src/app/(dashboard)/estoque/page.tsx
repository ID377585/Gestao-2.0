"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Coins,
  Gauge,
  Package,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
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
  ReferenceLine,
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
type MovementKind = "entrada" | "consumo" | "ajuste";
type MovementReasonLabel = "Entrada" | "Consumo" | "Ajuste" | "Sem variação";
type RiskLevel = "alto" | "medio" | "baixo" | "normal";
type AbcClass = "A" | "B" | "C";

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

type MovementMonthBuckets = {
  totalQty: number;
  entryQty: number;
  consumptionQty: number;
  adjustmentQty: number;
  totalValue: number;
  entryValue: number;
  consumptionValue: number;
  adjustmentValue: number;
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
  variationPercent: number | null;
  mainReason: MovementReasonLabel;
  reasonBreakdown: string;
  currentEntryQty: number;
  currentConsumptionQty: number;
  currentAdjustmentQty: number;
  previousEntryQty: number;
  previousConsumptionQty: number;
  previousAdjustmentQty: number;
};

type ProductMovementAgg = {
  lastMovementAt: Date | null;
  totalMovementQty: number;
  totalMovementValue: number;
  entries30Qty: number;
  entries30Value: number;
  consumption30Qty: number;
  consumption30Value: number;
  adjustments30Qty: number;
  adjustments30Value: number;
  consumptionCurrentMonthQty: number;
  consumptionCurrentMonthValue: number;
  consumptionPreviousMonthQty: number;
  consumptionPreviousMonthValue: number;
};

type StockAnalyticsRow = {
  stockId: string;
  productId: string;
  productName: string;
  sku: string;
  productType: string;
  productTypeLabel: string;
  sector: string;
  unit: string;
  location: string;
  currentQty: number;
  minQty: number;
  medQty: number;
  maxQty: number;
  unitCost: number;
  stockValue: number;
  entries30Qty: number;
  entries30Value: number;
  consumption30Qty: number;
  consumption30Value: number;
  adjustments30Qty: number;
  adjustments30Value: number;
  avgDailyConsumption: number;
  coverageDays: number | null;
  turnover30: number;
  lastMovementAt: Date | null;
  daysWithoutMovement: number | null;
  productionSuggestionQty: number;
  productionSuggestionReason: string;
  productionAction: string;
  riskLevel: RiskLevel;
  abnormalConsumptionPercent: number | null;
  abnormalConsumptionLabel: string;
  consumptionCurrentMonthQty: number;
  consumptionCurrentMonthValue: number;
  consumptionPreviousMonthQty: number;
  consumptionPreviousMonthValue: number;
};

type AbcStockRow = StockAnalyticsRow & {
  abcClass: AbcClass;
  participationPercent: number;
  cumulativePercent: number;
};

type AbcSummaryBucket = {
  items: number;
  value: number;
  percent: number;
};

type PredictionAlertRow = {
  id: string;
  severity: "alto" | "medio" | "baixo";
  productName: string;
  sku: string;
  title: string;
  metric: string;
  action: string;
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
const MONTH_DIFF_POSITIVE_COLOR = "#10b981";
const MONTH_DIFF_NEGATIVE_COLOR = "#ef4444";

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

function getRiskBadgeClass(risk: RiskLevel) {
  if (risk === "alto") return "bg-red-600 text-white hover:bg-red-600";
  if (risk === "medio") return "bg-yellow-500 text-white hover:bg-yellow-500";
  if (risk === "baixo") return "bg-sky-600 text-white hover:bg-sky-600";
  return "bg-green-600 text-white hover:bg-green-600";
}

function getSeverityBadgeClass(severity: PredictionAlertRow["severity"]) {
  if (severity === "alto") return "bg-red-600 text-white hover:bg-red-600";
  if (severity === "medio") return "bg-yellow-500 text-white hover:bg-yellow-500";
  return "bg-sky-600 text-white hover:bg-sky-600";
}

function getAbcBadgeClass(abcClass: AbcClass) {
  if (abcClass === "A") return "bg-red-600 text-white hover:bg-red-600";
  if (abcClass === "B") return "bg-yellow-500 text-white hover:bg-yellow-500";
  return "bg-emerald-600 text-white hover:bg-emerald-600";
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

function formatPercent(
  value: number | null | undefined,
  options: { showSignal?: boolean; fallback?: string } = {}
) {
  const safe = Number(value ?? Number.NaN);
  if (!Number.isFinite(safe)) return options.fallback ?? "—";

  const signal = options.showSignal && safe > 0 ? "+" : "";
  return `${signal}${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(safe)}%`;
}

function formatRatio(value: number | null | undefined) {
  const safe = Number(value ?? 0);
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(safe) ? safe : 0)}x`;
}

function formatDays(value: number | null | undefined) {
  const safe = Number(value ?? Number.NaN);
  if (!Number.isFinite(safe)) return "Sem giro";

  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: safe < 10 ? 1 : 0,
  }).format(Math.max(0, safe))} dias`;
}

function formatDateLabel(value: Date | null | undefined) {
  if (!value) return "Sem registro";
  return value.toLocaleDateString("pt-BR");
}

function formatSignedQty(value: number | null | undefined) {
  const safe = Number(value ?? 0);
  return `${safe > 0 ? "+" : ""}${formatQty(safe)}`;
}

function formatSignedCurrency(value: number | null | undefined) {
  const safe = Number(value ?? 0);
  return `${safe > 0 ? "+" : ""}${formatCurrency(safe)}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function subtractDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

function parseDateValue(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isDateInRange(value: unknown, start: Date, end: Date) {
  const date = parseDateValue(value);
  if (!date) return false;
  return date >= start && date <= end;
}

function differenceInDays(later: Date, earlier: Date) {
  const dayMs = 1000 * 60 * 60 * 24;
  const startLater = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  const startEarlier = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.max(0, Math.floor((startLater.getTime() - startEarlier.getTime()) / dayMs));
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

function getProductTypeLabel(value: string | null | undefined) {
  const type = String(value ?? "").toUpperCase();
  if (type === "INSU") return "Insumo";
  if (type === "PREP") return "Pré-preparo";
  if (type === "PROD") return "Produto";
  return type || "—";
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

function normalizeMovementText(movement: RecentStockMovementRow) {
  const data = movement as any;
  const keys = [
    "type",
    "movement_type",
    "movementType",
    "kind",
    "reason",
    "reason_label",
    "reasonLabel",
    "source",
    "origin",
    "description",
    "note",
    "notes",
    "reference_type",
    "referenceType",
    "operation",
    "category",
  ];

  return keys
    .map((key) => data?.[key])
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function getMovementProductId(movement: RecentStockMovementRow) {
  const data = movement as any;
  return String(data?.product_id ?? data?.productId ?? data?.product?.id ?? "").trim();
}

function getMovementCreatedAt(movement: RecentStockMovementRow) {
  const data = movement as any;
  return data?.created_at ?? data?.createdAt ?? data?.date ?? data?.movement_date ?? null;
}

function getMovementSignedQty(movement: RecentStockMovementRow) {
  const data = movement as any;
  const raw = data?.qty ?? data?.quantity ?? data?.amount_qty ?? data?.delta_qty ?? data?.delta ?? 0;
  const qty = Number(raw ?? 0);
  return Number.isFinite(qty) ? qty : 0;
}

function getMovementKind(movement: RecentStockMovementRow): MovementKind {
  const text = normalizeMovementText(movement);

  if (
    text.includes("AJUST") ||
    text.includes("ADJUST") ||
    text.includes("INVENT") ||
    text.includes("PERDA") ||
    text.includes("QUEBRA") ||
    text.includes("VENCIMENTO") ||
    text.includes("DIVERGEN")
  ) {
    return "ajuste";
  }

  if (
    text.includes("CONSUM") ||
    text.includes("SAIDA") ||
    text.includes("VENDA") ||
    text.includes("BAIXA") ||
    text.includes("CMV") ||
    text.includes("OUT") ||
    text.includes("EXIT") ||
    text.includes("RETIRADA")
  ) {
    return "consumo";
  }

  if (
    text.includes("ENTRADA") ||
    text.includes("COMPRA") ||
    text.includes("RECEB") ||
    text.includes("INBOUND") ||
    text.includes("ADD") ||
    text.includes("INCLUSAO") ||
    text.includes("PRODUCAO") ||
    text.includes("PRODUCTION")
  ) {
    return "entrada";
  }

  return getMovementSignedQty(movement) < 0 ? "consumo" : "entrada";
}

function createEmptyBuckets(): MovementMonthBuckets {
  return {
    totalQty: 0,
    entryQty: 0,
    consumptionQty: 0,
    adjustmentQty: 0,
    totalValue: 0,
    entryValue: 0,
    consumptionValue: 0,
    adjustmentValue: 0,
  };
}

function createEmptyMovementAgg(): ProductMovementAgg {
  return {
    lastMovementAt: null,
    totalMovementQty: 0,
    totalMovementValue: 0,
    entries30Qty: 0,
    entries30Value: 0,
    consumption30Qty: 0,
    consumption30Value: 0,
    adjustments30Qty: 0,
    adjustments30Value: 0,
    consumptionCurrentMonthQty: 0,
    consumptionCurrentMonthValue: 0,
    consumptionPreviousMonthQty: 0,
    consumptionPreviousMonthValue: 0,
  };
}

function addMovementToBucket(bucket: MovementMonthBuckets, kind: MovementKind, qty: number, value: number) {
  bucket.totalQty += qty;
  bucket.totalValue += value;

  if (kind === "entrada") {
    bucket.entryQty += qty;
    bucket.entryValue += value;
  } else if (kind === "consumo") {
    bucket.consumptionQty += qty;
    bucket.consumptionValue += value;
  } else {
    bucket.adjustmentQty += qty;
    bucket.adjustmentValue += value;
  }
}

function getVariationPercent(current: number, previous: number) {
  if (previous > 0) return ((current - previous) / previous) * 100;
  if (current > 0) return 100;
  return 0;
}

function getMainVariationReason(current: MovementMonthBuckets, previous: MovementMonthBuckets): MovementReasonLabel {
  const candidates: Array<{ label: MovementReasonLabel; diff: number }> = [
    { label: "Entrada", diff: current.entryQty - previous.entryQty },
    { label: "Consumo", diff: current.consumptionQty - previous.consumptionQty },
    { label: "Ajuste", diff: current.adjustmentQty - previous.adjustmentQty },
  ];

  const winner = candidates.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
  return Math.abs(winner?.diff ?? 0) > 0 ? winner.label : "Sem variação";
}

function getReasonBreakdown(current: MovementMonthBuckets, previous: MovementMonthBuckets) {
  return [
    `Entrada ${formatSignedQty(current.entryQty - previous.entryQty)}`,
    `Consumo ${formatSignedQty(current.consumptionQty - previous.consumptionQty)}`,
    `Ajuste ${formatSignedQty(current.adjustmentQty - previous.adjustmentQty)}`,
  ].join(" • ");
}

function getRiskLevel({
  currentQty,
  minQty,
  maxQty,
  coverageDays,
}: {
  currentQty: number;
  minQty: number;
  maxQty: number;
  coverageDays: number | null;
}): RiskLevel {
  if (minQty > 0 && currentQty < minQty) return "alto";
  if (coverageDays !== null && coverageDays <= 3) return "alto";
  if (coverageDays !== null && coverageDays <= 7) return "medio";
  if (maxQty > 0 && currentQty > maxQty) return "baixo";
  return "normal";
}

function getRiskLabel(risk: RiskLevel) {
  if (risk === "alto") return "Alto";
  if (risk === "medio") return "Médio";
  if (risk === "baixo") return "Baixo";
  return "Normal";
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
  children?: ReactNode;
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

function MonthDiffTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: MovementDiffRow & { name: string } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="max-w-[320px] rounded-2xl border border-white/20 bg-slate-950/85 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-xl">
      <div className="mb-1 font-semibold">{row.productName}</div>
      <div>Dif. Qtd: {formatSignedQty(row.diffQty)}</div>
      <div>Dif. R$: {formatSignedCurrency(row.diffValue)}</div>
      <div>% variação: {formatPercent(row.variationPercent, { showSignal: true })}</div>
      <div>Motivo dominante: {row.mainReason}</div>
      <div className="mt-1 text-white/70">{row.reasonBreakdown}</div>
    </div>
  );
}

function MonthDiffBarChart({ data }: { data: MovementDiffRow[] }) {
  const chartData = data.slice(0, 12).map((row) => ({
    ...row,
    name: row.productName.length > 26 ? `${row.productName.slice(0, 26)}…` : row.productName,
  }));

  if (chartData.length === 0) {
    return (
      <div className={`${GLASS_INNER_CLASS} mb-4 p-6`}>
        <p className="text-sm text-muted-foreground">
          Sem dados suficientes para montar o gráfico de diferença mensal.
        </p>
      </div>
    );
  }

  return (
    <div className={`${GLASS_INNER_CLASS} mb-4 p-4`}>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Top variações em R$</div>
          <div className="text-xs text-muted-foreground">
            Barras positivas indicam aumento e negativas indicam redução contra o mês anterior.
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Motivo dominante calculado por entrada, consumo ou ajuste.
        </div>
      </div>

      <div className="h-[420px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 42, left: 8, bottom: 8 }}
            barCategoryGap={10}
          >
            <CartesianGrid
              stroke="rgba(148,163,184,0.18)"
              strokeDasharray="3 3"
              horizontal={false}
            />
            <XAxis
              type="number"
              tickFormatter={(value) => formatCurrency(Number(value))}
              fontSize={12}
              tick={{ fill: "currentColor" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={160}
              fontSize={12}
              tick={{ fill: "currentColor" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<MonthDiffTooltip />} cursor={{ fill: "rgba(255,255,255,0.08)" }} />
            <ReferenceLine x={0} stroke="rgba(100,116,139,0.45)" strokeDasharray="4 4" />
            <Bar dataKey="diffValue" radius={[10, 10, 10, 10]} maxBarSize={30}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`${entry.productId}-${index}`}
                  fill={entry.diffValue >= 0 ? MONTH_DIFF_POSITIVE_COLOR : MONTH_DIFF_NEGATIVE_COLOR}
                  fillOpacity={0.88}
                />
              ))}
              <LabelList
                dataKey="diffValue"
                position="right"
                formatter={(value) => formatCurrency(Number(value ?? 0))}
                className="fill-slate-700 dark:fill-slate-200"
                fontSize={11}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
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
      className="w-full"
    >
      <div className={`${GLASS_INNER_CLASS} p-4`}>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative h-[430px] min-w-0 rounded-3xl border border-white/20 bg-white/20 p-3 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
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

  const stockIntelligence = useMemo(() => {
    const now = new Date();
    const last30DaysStart = subtractDays(now, 30);
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthBase = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthStart = startOfMonth(previousMonthBase);
    const previousMonthEnd = endOfMonth(previousMonthBase);

    const stockByProductId = new Map<string, EnrichedStockRow>();

    for (const row of enrichedStock) {
      const productId = String(row.product?.id ?? "").trim();
      if (!productId) continue;
      stockByProductId.set(productId, row);
    }

    const movementByProduct = new Map<string, ProductMovementAgg>();

    const ensureAgg = (productId: string) => {
      const current = movementByProduct.get(productId);
      if (current) return current;

      const created = createEmptyMovementAgg();
      movementByProduct.set(productId, created);
      return created;
    };

    for (const movement of recentMovements) {
      const productId = getMovementProductId(movement);
      if (!productId) continue;

      const movementDate = parseDateValue(getMovementCreatedAt(movement));
      const absQty = Math.abs(getMovementSignedQty(movement));
      const safeQty = Number.isFinite(absQty) ? absQty : 0;
      if (safeQty <= 0) continue;

      const stockRow = stockByProductId.get(productId);
      const unitCost = getProductUnitCost(stockRow?.product);
      const movementValue = safeQty * unitCost;
      const kind = getMovementKind(movement);
      const agg = ensureAgg(productId);

      if (movementDate && (!agg.lastMovementAt || movementDate > agg.lastMovementAt)) {
        agg.lastMovementAt = movementDate;
      }

      agg.totalMovementQty += safeQty;
      agg.totalMovementValue += movementValue;

      if (movementDate && movementDate >= last30DaysStart && movementDate <= now) {
        if (kind === "entrada") {
          agg.entries30Qty += safeQty;
          agg.entries30Value += movementValue;
        } else if (kind === "consumo") {
          agg.consumption30Qty += safeQty;
          agg.consumption30Value += movementValue;
        } else {
          agg.adjustments30Qty += safeQty;
          agg.adjustments30Value += movementValue;
        }
      }

      if (movementDate && isDateInRange(movementDate, currentMonthStart, currentMonthEnd) && kind === "consumo") {
        agg.consumptionCurrentMonthQty += safeQty;
        agg.consumptionCurrentMonthValue += movementValue;
      }

      if (movementDate && isDateInRange(movementDate, previousMonthStart, previousMonthEnd) && kind === "consumo") {
        agg.consumptionPreviousMonthQty += safeQty;
        agg.consumptionPreviousMonthValue += movementValue;
      }
    }

    const rows: StockAnalyticsRow[] = enrichedStock.map((row) => {
      const productId = String(row.product?.id ?? row.id).trim();
      const productType = String(row.meta?.product_type ?? row.product?.product_type ?? "").toUpperCase();
      const currentQty = Number(row.quantity ?? 0);
      const safeCurrentQty = Number.isFinite(currentQty) ? currentQty : 0;
      const minQty = Number(row.min_qty ?? 0);
      const medQty = Number(row.med_qty ?? 0);
      const maxQty = Number(row.max_qty ?? 0);
      const unitCost = getProductUnitCost(row.product);
      const stockValue = safeCurrentQty * unitCost;
      const agg = movementByProduct.get(productId) ?? createEmptyMovementAgg();
      const avgDailyConsumption = agg.consumption30Qty / 30;
      const coverageDays = avgDailyConsumption > 0 ? safeCurrentQty / avgDailyConsumption : null;
      const turnover30 = stockValue > 0 ? agg.consumption30Value / stockValue : 0;
      const daysWithoutMovement = agg.lastMovementAt ? differenceInDays(now, agg.lastMovementAt) : null;
      const targetCoverageQty = avgDailyConsumption * 7;
      let targetQty = Math.max(medQty, minQty * 1.25, targetCoverageQty);

      if (maxQty > 0) {
        targetQty = Math.min(targetQty, maxQty);
      }

      const productionSuggestionQty = Math.max(0, targetQty - safeCurrentQty);
      const productionAction = productType === "INSU" ? "Reposição/compra" : "Produzir";

      let productionSuggestionReason = "Sem sugestão";
      if (productionSuggestionQty > 0 && minQty > 0 && safeCurrentQty < minQty) {
        productionSuggestionReason = "Saldo abaixo do mínimo";
      } else if (productionSuggestionQty > 0 && coverageDays !== null && coverageDays <= 7) {
        productionSuggestionReason = "Ruptura futura em até 7 dias";
      } else if (productionSuggestionQty > 0 && medQty > 0 && safeCurrentQty < medQty) {
        productionSuggestionReason = "Saldo abaixo do ideal/médio";
      } else if (productionSuggestionQty > 0) {
        productionSuggestionReason = "Reposição para cobertura de 7 dias";
      }

      const riskLevel = getRiskLevel({
        currentQty: safeCurrentQty,
        minQty: Number.isFinite(minQty) ? minQty : 0,
        maxQty: Number.isFinite(maxQty) ? maxQty : 0,
        coverageDays,
      });

      const abnormalConsumptionPercent = getVariationPercent(
        agg.consumptionCurrentMonthQty,
        agg.consumptionPreviousMonthQty
      );

      let abnormalConsumptionLabel = "Dentro do padrão";
      if (agg.consumptionPreviousMonthQty === 0 && agg.consumptionCurrentMonthQty > 0) {
        abnormalConsumptionLabel = "Novo consumo no mês";
      } else if (agg.consumptionPreviousMonthQty > 0 && agg.consumptionCurrentMonthQty === 0) {
        abnormalConsumptionLabel = "Consumo zerado no mês";
      } else if (abnormalConsumptionPercent >= 50) {
        abnormalConsumptionLabel = "Consumo acima do padrão";
      } else if (abnormalConsumptionPercent <= -50) {
        abnormalConsumptionLabel = "Consumo abaixo do padrão";
      }

      return {
        stockId: row.id,
        productId,
        productName: row.product?.name ?? "Produto sem vínculo",
        sku: row.product?.sku ?? "—",
        productType,
        productTypeLabel: getProductTypeLabel(productType),
        sector: normalizeSectorName(row.meta?.sector_category),
        unit: row.unit_label ?? row.product?.default_unit_label ?? "",
        location: row.location ?? "—",
        currentQty: safeCurrentQty,
        minQty: Number.isFinite(minQty) ? minQty : 0,
        medQty: Number.isFinite(medQty) ? medQty : 0,
        maxQty: Number.isFinite(maxQty) ? maxQty : 0,
        unitCost,
        stockValue,
        entries30Qty: agg.entries30Qty,
        entries30Value: agg.entries30Value,
        consumption30Qty: agg.consumption30Qty,
        consumption30Value: agg.consumption30Value,
        adjustments30Qty: agg.adjustments30Qty,
        adjustments30Value: agg.adjustments30Value,
        avgDailyConsumption,
        coverageDays,
        turnover30,
        lastMovementAt: agg.lastMovementAt,
        daysWithoutMovement,
        productionSuggestionQty,
        productionSuggestionReason,
        productionAction,
        riskLevel,
        abnormalConsumptionPercent,
        abnormalConsumptionLabel,
        consumptionCurrentMonthQty: agg.consumptionCurrentMonthQty,
        consumptionCurrentMonthValue: agg.consumptionCurrentMonthValue,
        consumptionPreviousMonthQty: agg.consumptionPreviousMonthQty,
        consumptionPreviousMonthValue: agg.consumptionPreviousMonthValue,
      };
    });

    const totalStockValue = rows.reduce((acc, row) => acc + row.stockValue, 0);
    const totalConsumption30Value = rows.reduce((acc, row) => acc + row.consumption30Value, 0);
    const totalConsumptionCurrentMonthValue = rows.reduce((acc, row) => acc + row.consumptionCurrentMonthValue, 0);
    const totalMovement30Qty = rows.reduce(
      (acc, row) => acc + row.entries30Qty + row.consumption30Qty + row.adjustments30Qty,
      0
    );
    const totalAdjustments30Qty = rows.reduce((acc, row) => acc + row.adjustments30Qty, 0);
    const turnover30 = totalStockValue > 0 ? totalConsumption30Value / totalStockValue : 0;
    const coverageDaysByValue =
      totalConsumption30Value > 0 ? totalStockValue / (totalConsumption30Value / 30) : null;
    const stockAccuracy =
      totalMovement30Qty > 0
        ? Math.max(0, Math.min(100, 100 - (totalAdjustments30Qty / totalMovement30Qty) * 100))
        : null;

    const abcSummary: Record<AbcClass, AbcSummaryBucket> = {
      A: { items: 0, value: 0, percent: 0 },
      B: { items: 0, value: 0, percent: 0 },
      C: { items: 0, value: 0, percent: 0 },
    };

    let cumulativeValue = 0;
    const abcRows: AbcStockRow[] = [...rows]
      .filter((row) => row.stockValue > 0)
      .sort((a, b) => b.stockValue - a.stockValue || a.productName.localeCompare(b.productName, "pt-BR"))
      .map((row) => {
        cumulativeValue += row.stockValue;
        const participationPercent = totalStockValue > 0 ? (row.stockValue / totalStockValue) * 100 : 0;
        const cumulativePercent = totalStockValue > 0 ? (cumulativeValue / totalStockValue) * 100 : 0;
        const abcClass: AbcClass = cumulativePercent <= 80 ? "A" : cumulativePercent <= 95 ? "B" : "C";

        abcSummary[abcClass].items += 1;
        abcSummary[abcClass].value += row.stockValue;

        return {
          ...row,
          abcClass,
          participationPercent,
          cumulativePercent,
        };
      });

    abcSummary.A.percent = totalStockValue > 0 ? (abcSummary.A.value / totalStockValue) * 100 : 0;
    abcSummary.B.percent = totalStockValue > 0 ? (abcSummary.B.value / totalStockValue) * 100 : 0;
    abcSummary.C.percent = totalStockValue > 0 ? (abcSummary.C.value / totalStockValue) * 100 : 0;

    const highTurnoverRows = [...rows]
      .filter((row) => row.turnover30 > 0)
      .sort((a, b) => b.turnover30 - a.turnover30 || b.consumption30Value - a.consumption30Value)
      .slice(0, 15);

    const lowCoverageRows = [...rows]
      .filter((row) => row.coverageDays !== null && row.avgDailyConsumption > 0)
      .sort((a, b) => Number(a.coverageDays ?? 999999) - Number(b.coverageDays ?? 999999))
      .slice(0, 15);

    const immobilizedRows = [...rows]
      .filter((row) => row.stockValue > 0)
      .sort((a, b) => b.stockValue - a.stockValue || b.currentQty - a.currentQty)
      .slice(0, 15);

    const noMovementRowsAll = [...rows]
      .filter((row) => row.currentQty > 0 && (row.daysWithoutMovement === null || row.daysWithoutMovement >= 30))
      .sort((a, b) => {
        const aDays = a.daysWithoutMovement ?? 999999;
        const bDays = b.daysWithoutMovement ?? 999999;
        return bDays - aDays || b.stockValue - a.stockValue;
      });

    const noMovementRows = noMovementRowsAll.slice(0, 15);

    const productionSuggestionsAll = [...rows]
      .filter((row) => row.productionSuggestionQty > 0)
      .sort(
        (a, b) =>
          Number(a.coverageDays ?? 999999) - Number(b.coverageDays ?? 999999) ||
          b.productionSuggestionQty * b.unitCost - a.productionSuggestionQty * a.unitCost
      );

    const productionSuggestions = productionSuggestionsAll.slice(0, 15);

    const abnormalConsumptionRows = [...rows]
      .filter(
        (row) =>
          row.consumptionCurrentMonthQty > 0 ||
          row.consumptionPreviousMonthQty > 0
      )
      .filter((row) => Math.abs(row.abnormalConsumptionPercent ?? 0) >= 50)
      .sort(
        (a, b) =>
          Math.abs(b.abnormalConsumptionPercent ?? 0) - Math.abs(a.abnormalConsumptionPercent ?? 0) ||
          b.consumptionCurrentMonthValue - a.consumptionCurrentMonthValue
      )
      .slice(0, 15);

    const adjustmentRankingRows = [...rows]
      .filter((row) => row.adjustments30Qty > 0)
      .sort((a, b) => b.adjustments30Value - a.adjustments30Value || b.adjustments30Qty - a.adjustments30Qty)
      .slice(0, 12);

    const predictiveAlerts: PredictionAlertRow[] = [];

    for (const row of rows) {
      if (row.riskLevel === "alto") {
        predictiveAlerts.push({
          id: `${row.productId}-ruptura-alta`,
          severity: "alto",
          productName: row.productName,
          sku: row.sku,
          title: "Risco alto de ruptura",
          metric: row.coverageDays !== null ? formatDays(row.coverageDays) : `Saldo ${formatQty(row.currentQty)} ${row.unit}`,
          action: row.productionSuggestionQty > 0
            ? `${row.productionAction} ${formatQty(row.productionSuggestionQty)} ${row.unit}`
            : "Revisar saldo mínimo e consumo",
        });
      } else if (row.riskLevel === "medio") {
        predictiveAlerts.push({
          id: `${row.productId}-ruptura-media`,
          severity: "medio",
          productName: row.productName,
          sku: row.sku,
          title: "Ruptura provável em curto prazo",
          metric: formatDays(row.coverageDays),
          action: row.productionSuggestionQty > 0
            ? `${row.productionAction} ${formatQty(row.productionSuggestionQty)} ${row.unit}`
            : "Acompanhar próxima baixa",
        });
      }

      if (row.maxQty > 0 && row.currentQty > row.maxQty) {
        predictiveAlerts.push({
          id: `${row.productId}-excesso`,
          severity: "baixo",
          productName: row.productName,
          sku: row.sku,
          title: "Excesso acima do máximo",
          metric: `Excedente ${formatQty(row.currentQty - row.maxQty)} ${row.unit}`,
          action: "Bloquear compra/produção até reduzir saldo",
        });
      }

      if (row.adjustments30Qty > 0 && row.adjustments30Qty >= Math.max(1, row.consumption30Qty * 0.2)) {
        predictiveAlerts.push({
          id: `${row.productId}-ajuste`,
          severity: row.adjustments30Value >= row.stockValue * 0.1 ? "alto" : "medio",
          productName: row.productName,
          sku: row.sku,
          title: "Acuracidade em atenção",
          metric: `Ajustes 30d: ${formatQty(row.adjustments30Qty)} ${row.unit}`,
          action: "Conferir inventário, perdas e ficha técnica",
        });
      }

      if (
        row.stockValue > 0 &&
        (row.daysWithoutMovement === null || row.daysWithoutMovement >= 60)
      ) {
        predictiveAlerts.push({
          id: `${row.productId}-parado`,
          severity: "baixo",
          productName: row.productName,
          sku: row.sku,
          title: "Produto parado com valor imobilizado",
          metric: row.daysWithoutMovement === null ? "Sem registro recente" : `${row.daysWithoutMovement} dias sem movimentação`,
          action: "Revisar compra, cardápio, produção ou baixa",
        });
      }

      if (Math.abs(row.abnormalConsumptionPercent ?? 0) >= 100 && row.consumptionCurrentMonthQty > 0) {
        predictiveAlerts.push({
          id: `${row.productId}-consumo-fora-padrao`,
          severity: "medio",
          productName: row.productName,
          sku: row.sku,
          title: "Consumo fora do padrão",
          metric: formatPercent(row.abnormalConsumptionPercent, { showSignal: true }),
          action: "Validar venda, produção, baixa manual e perdas",
        });
      }
    }

    const severityOrder: Record<PredictionAlertRow["severity"], number> = {
      alto: 0,
      medio: 1,
      baixo: 2,
    };

    predictiveAlerts.sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity] ||
        a.productName.localeCompare(b.productName, "pt-BR")
    );

    return {
      rows,
      totalStockValue,
      totalConsumption30Value,
      totalConsumptionCurrentMonthValue,
      avgDailyCmv: totalConsumption30Value / 30,
      turnover30,
      coverageDaysByValue,
      stockAccuracy,
      totalMovement30Qty,
      totalAdjustments30Qty,
      abcRows,
      abcSummary,
      highTurnoverRows,
      lowCoverageRows,
      immobilizedRows,
      noMovementRows,
      noMovementRowsTotal: noMovementRowsAll.length,
      productionSuggestions,
      productionSuggestionsTotal: productionSuggestionsAll.length,
      abnormalConsumptionRows,
      adjustmentRankingRows,
      predictiveAlerts: predictiveAlerts.slice(0, 14),
    };
  }, [enrichedStock, recentMovements]);

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

    const currentByProduct = new Map<string, MovementMonthBuckets>();
    const previousByProduct = new Map<string, MovementMonthBuckets>();

    const ensureBucket = (map: Map<string, MovementMonthBuckets>, productId: string) => {
      const current = map.get(productId);
      if (current) return current;
      const created = createEmptyBuckets();
      map.set(productId, created);
      return created;
    };

    for (const movement of recentMovements) {
      const productId = getMovementProductId(movement);
      if (!productId) continue;

      const qty = Math.abs(getMovementSignedQty(movement));
      const safeQty = Number.isFinite(qty) ? qty : 0;
      if (safeQty <= 0) continue;

      const kind = getMovementKind(movement);
      const price = productById.get(productId)?.price ?? 0;
      const value = safeQty * price;
      const createdAt = getMovementCreatedAt(movement);

      if (isDateInRange(createdAt, currentMonthStart, currentMonthEnd)) {
        addMovementToBucket(ensureBucket(currentByProduct, productId), kind, safeQty, value);
      } else if (isDateInRange(createdAt, previousMonthStart, previousMonthEnd)) {
        addMovementToBucket(ensureBucket(previousByProduct, productId), kind, safeQty, value);
      }
    }

    const productIds = new Set([
      ...Array.from(currentByProduct.keys()),
      ...Array.from(previousByProduct.keys()),
    ]);

    const allRows: MovementDiffRow[] = Array.from(productIds)
      .map((productId) => {
        const product = productById.get(productId);
        const current = currentByProduct.get(productId) ?? createEmptyBuckets();
        const previous = previousByProduct.get(productId) ?? createEmptyBuckets();
        const currentQty = current.totalQty;
        const previousQty = previous.totalQty;
        const currentValue = current.totalValue;
        const previousValue = previous.totalValue;
        const diffQty = currentQty - previousQty;
        const diffValue = currentValue - previousValue;

        return {
          productId,
          productName: product?.name ?? "Produto não encontrado",
          sku: product?.sku ?? "—",
          currentQty,
          previousQty,
          diffQty,
          currentValue,
          previousValue,
          diffValue,
          variationPercent: getVariationPercent(currentQty, previousQty),
          mainReason: getMainVariationReason(current, previous),
          reasonBreakdown: getReasonBreakdown(current, previous),
          currentEntryQty: current.entryQty,
          currentConsumptionQty: current.consumptionQty,
          currentAdjustmentQty: current.adjustmentQty,
          previousEntryQty: previous.entryQty,
          previousConsumptionQty: previous.consumptionQty,
          previousAdjustmentQty: previous.adjustmentQty,
        };
      })
      .filter((row) => row.currentQty > 0 || row.previousQty > 0)
      .sort(
        (a, b) =>
          Math.abs(b.diffValue) - Math.abs(a.diffValue) ||
          Math.abs(b.diffQty) - Math.abs(a.diffQty) ||
          a.productName.localeCompare(b.productName, "pt-BR")
      );

    const currentMonthQty = allRows.reduce((acc, row) => acc + row.currentQty, 0);
    const previousMonthQty = allRows.reduce((acc, row) => acc + row.previousQty, 0);
    const currentMonthValue = allRows.reduce((acc, row) => acc + row.currentValue, 0);
    const previousMonthValue = allRows.reduce((acc, row) => acc + row.previousValue, 0);

    return {
      rows: allRows.slice(0, 20),
      currentMonthQty,
      previousMonthQty,
      currentMonthValue,
      previousMonthValue,
      diffQtyTotal: currentMonthQty - previousMonthQty,
      diffValueTotal: currentMonthValue - previousMonthValue,
      variationPercentTotal: getVariationPercent(currentMonthQty, previousMonthQty),
    };
  }, [recentMovements, enrichedStock]);

  const insumosChartData = useMemo(
    () => buildChartData(enrichedStock, ["INSU"]),
    [enrichedStock]
  );

  const immobilizedChartData = useMemo<ChartDatum[]>(
    () =>
      stockIntelligence.immobilizedRows.slice(0, 12).map((row) => ({
        name: row.productName,
        qty: row.currentQty,
        value: row.stockValue,
      })),
    [stockIntelligence.immobilizedRows]
  );

  const giroChartData = useMemo<ChartDatum[]>(
    () =>
      stockIntelligence.highTurnoverRows.slice(0, 12).map((row) => ({
        name: row.productName,
        qty: row.turnover30,
        value: row.turnover30,
      })),
    [stockIntelligence.highTurnoverRows]
  );

  const coverageChartData = useMemo<ChartDatum[]>(
    () =>
      stockIntelligence.lowCoverageRows.slice(0, 12).map((row) => ({
        name: row.productName,
        qty: row.coverageDays ?? 0,
        value: row.coverageDays ?? 0,
      })),
    [stockIntelligence.lowCoverageRows]
  );

  const cmvChartData = useMemo<ChartDatum[]>(
    () =>
      stockIntelligence.rows
        .filter((row) => row.consumption30Value > 0)
        .sort((a, b) => b.consumption30Value - a.consumption30Value)
        .slice(0, 12)
        .map((row) => ({
          name: row.productName,
          qty: row.consumption30Qty,
          value: row.consumption30Value,
        })),
    [stockIntelligence.rows]
  );

  const abcChartData = useMemo<ChartDatum[]>(
    () => [
      {
        name: "Classe A",
        qty: stockIntelligence.abcSummary.A.items,
        value: stockIntelligence.abcSummary.A.value,
      },
      {
        name: "Classe B",
        qty: stockIntelligence.abcSummary.B.items,
        value: stockIntelligence.abcSummary.B.value,
      },
      {
        name: "Classe C",
        qty: stockIntelligence.abcSummary.C.items,
        value: stockIntelligence.abcSummary.C.value,
      },
    ].filter((item) => item.value > 0 || item.qty > 0),
    [stockIntelligence.abcSummary]
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
            <ConsolidatedStockPieChart
              data={consolidatedStockPieData}
              totalQuantity={metrics.saldoTotal}
              totalAmount={metrics.valorTotal}
              unclassified={metrics.consolidatedByUnit.outros}
            />

            <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
              <DashboardTableShell
                title="Alertas preditivos (IA simples)"
                description="Sinais automáticos gerados por saldo, cobertura, ruptura futura, ajustes, excesso, produto parado e consumo fora do padrão."
                empty={stockIntelligence.predictiveAlerts.length === 0}
                emptyState={
                  <p className="text-sm text-muted-foreground">
                    Nenhum alerta preditivo identificado com os dados atuais.
                  </p>
                }
                footer={
                  <p className="text-xs text-muted-foreground">
                    A regra é simples e auditável: usa saldo atual, limites, consumo recente, ajustes, cobertura e histórico recente de movimentações.
                  </p>
                }
              >
                <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Sinal</TableHead>
                        <TableHead>Métrica</TableHead>
                        <TableHead>Ação sugerida</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockIntelligence.predictiveAlerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>
                            <Badge className={getSeverityBadgeClass(alert.severity)}>
                              {alert.severity === "alto" ? "Alta" : alert.severity === "medio" ? "Média" : "Baixa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{alert.productName}</TableCell>
                          <TableCell>{alert.sku}</TableCell>
                          <TableCell>{alert.title}</TableCell>
                          <TableCell>{alert.metric}</TableCell>
                          <TableCell>{alert.action}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </DashboardTableShell>
            </div>

            <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
              <DashboardTableShell
                title="Dif. mês anterior vs atual (Qtd)"
                description="Listagem dos produtos que tiveram diferença entre o mês anterior e o mês atual, agora com gráfico, motivo dominante da variação e percentual de variação."
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
                      {formatQty(monthComparison.previousMonthQty)} • Dif.:{" "}
                      {formatSignedQty(monthComparison.diffQtyTotal)} • Var.:{" "}
                      {formatPercent(monthComparison.variationPercentTotal, { showSignal: true })}
                    </span>
                    <span className="font-semibold">
                      Total diferença em R$: {formatSignedCurrency(monthComparison.diffValueTotal)}
                    </span>
                  </div>
                }
              >
                <MonthDiffBarChart data={monthComparison.rows} />

                <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Qtd Atual</TableHead>
                        <TableHead className="text-right">Qtd Anterior</TableHead>
                        <TableHead className="text-right">Dif. Qtd</TableHead>
                        <TableHead className="text-right">Dif. R$</TableHead>
                        <TableHead className="text-right">% Var.</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Quebra da variação</TableHead>
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
                              {formatSignedQty(row.diffQty)}
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
                              {formatSignedCurrency(row.diffValue)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                (row.variationPercent ?? 0) > 0
                                  ? "text-emerald-600 font-semibold"
                                  : (row.variationPercent ?? 0) < 0
                                    ? "text-red-600 font-semibold"
                                    : ""
                              }
                            >
                              {formatPercent(row.variationPercent, { showSignal: true })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                row.mainReason === "Entrada"
                                  ? "bg-emerald-600 text-white hover:bg-emerald-600"
                                  : row.mainReason === "Consumo"
                                    ? "bg-sky-600 text-white hover:bg-sky-600"
                                    : row.mainReason === "Ajuste"
                                      ? "bg-yellow-500 text-white hover:bg-yellow-500"
                                      : "bg-slate-600 text-white hover:bg-slate-600"
                              }
                            >
                              {row.mainReason}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.reasonBreakdown}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </DashboardTableShell>
            </div>

            <div className="[&>div>div]:rounded-3xl [&>div>div]:border [&>div>div]:border-white/20 [&>div>div]:bg-white/10 [&>div>div]:backdrop-blur-xl [&>div>div]:shadow-[0_8px_32px_rgba(15,23,42,0.12)] dark:[&>div>div]:border-white/10 dark:[&>div>div]:bg-white/5">
              <DashboardStatGrid
                items={[
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
                ]}
              />
            </div>

            <div className="[&>div>div]:rounded-3xl [&>div>div]:border [&>div>div]:border-white/20 [&>div>div]:bg-white/10 [&>div>div]:backdrop-blur-xl [&>div>div]:shadow-[0_8px_32px_rgba(15,23,42,0.12)] dark:[&>div>div]:border-white/10 dark:[&>div>div]:bg-white/5">
              <DashboardStatGrid
                items={[
                  {
                    title: "Giro de estoque (30 dias)",
                    value: loading ? "…" : formatRatio(stockIntelligence.turnover30),
                    description: "CMV estimado dos últimos 30 dias dividido pelo valor imobilizado.",
                    icon: <Activity className="h-4 w-4" />,
                  },
                  {
                    title: "Acuracidade estimada",
                    value: loading
                      ? "…"
                      : stockIntelligence.stockAccuracy === null
                        ? "Sem base"
                        : formatPercent(stockIntelligence.stockAccuracy),
                    description: "Estimativa por volume de ajustes/inventário sobre movimentações dos últimos 30 dias.",
                    icon: <Gauge className="h-4 w-4" />,
                    valueClassName:
                      stockIntelligence.stockAccuracy !== null && stockIntelligence.stockAccuracy < 95
                        ? "text-yellow-600"
                        : "text-emerald-600",
                  },
                  {
                    title: "Cobertura de estoque",
                    value: loading ? "…" : formatDays(stockIntelligence.coverageDaysByValue),
                    description: "Dias de cobertura financeira: valor em estoque / CMV médio diário.",
                    icon: <CalendarClock className="h-4 w-4" />,
                  },
                  {
                    title: "Valor imobilizado",
                    value: loading ? "…" : formatCurrency(stockIntelligence.totalStockValue),
                    description: "Valor financeiro parado em estoque pelo saldo atual.",
                    icon: <Wallet className="h-4 w-4" />,
                  },
                ]}
              />
            </div>

            <div className="[&>div>div]:rounded-3xl [&>div>div]:border [&>div>div]:border-white/20 [&>div>div]:bg-white/10 [&>div>div]:backdrop-blur-xl [&>div>div]:shadow-[0_8px_32px_rgba(15,23,42,0.12)] dark:[&>div>div]:border-white/10 dark:[&>div>div]:bg-white/5">
              <DashboardStatGrid
                items={[
                  {
                    title: "CMV em tempo real",
                    value: loading ? "…" : formatCurrency(stockIntelligence.totalConsumptionCurrentMonthValue),
                    description: "Consumo valorizado do mês atual pelas movimentações classificadas como consumo.",
                    icon: <Coins className="h-4 w-4" />,
                  },
                  {
                    title: "Curva ABC - Classe A",
                    value: loading
                      ? "…"
                      : `${stockIntelligence.abcSummary.A.items} itens`,
                    description: `${formatPercent(stockIntelligence.abcSummary.A.percent)} do valor imobilizado está na classe A.`,
                    icon: <BarChart3 className="h-4 w-4" />,
                  },
                  {
                    title: "Produtos sem movimentação",
                    value: loading ? "…" : stockIntelligence.noMovementRowsTotal,
                    description: "Itens com saldo e sem movimento há 30 dias ou sem registro recente.",
                    icon: <RotateCcw className="h-4 w-4" />,
                  },
                  {
                    title: "Sugestões de produção/reposição",
                    value: loading ? "…" : stockIntelligence.productionSuggestionsTotal,
                    description: "Itens com sugestão calculada por ruptura futura, mínimo, médio e cobertura.",
                    icon: <Zap className="h-4 w-4" />,
                  },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <HorizontalStockChart
                title="Insumos por setor em R$"
                description="Gráfico horizontal com valor total em estoque por setor de insumos."
                data={insumosChartData}
                valueKey="value"
                formatValue={(value) => formatCurrency(value)}
              />

              <HorizontalStockChart
                title="Valor imobilizado por produto"
                description="Ranking dos produtos com maior capital parado no estoque atual."
                data={immobilizedChartData}
                valueKey="value"
                formatValue={(value) => formatCurrency(value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <HorizontalStockChart
                title="Giro de estoque por produto"
                description="Ranking de giro: consumo valorizado dos últimos 30 dias / valor em estoque."
                data={giroChartData}
                valueKey="qty"
                formatValue={(value) => formatRatio(value)}
              />

              <HorizontalStockChart
                title="Cobertura de estoque (dias)"
                description="Produtos com menor cobertura estimada pelo consumo médio diário dos últimos 30 dias."
                data={coverageChartData}
                valueKey="qty"
                formatValue={(value) => formatDays(value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <HorizontalStockChart
                title="CMV em tempo real por produto"
                description="Consumo valorizado dos últimos 30 dias por custo/preço unitário."
                data={cmvChartData}
                valueKey="value"
                formatValue={(value) => formatCurrency(value)}
              />

              <HorizontalStockChart
                title="Curva ABC de estoque"
                description="Distribuição do valor imobilizado por classe A, B e C."
                data={abcChartData}
                valueKey="value"
                formatValue={(value) => formatCurrency(value)}
              />
            </div>

            <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
              <DashboardTableShell
                title="Ranking de giro e cobertura"
                description="Produtos com maior giro recente e a respectiva cobertura em dias para apoiar compra, produção e reposição."
                empty={stockIntelligence.highTurnoverRows.length === 0 && stockIntelligence.lowCoverageRows.length === 0}
                emptyState={
                  <p className="text-sm text-muted-foreground">
                    Não há consumo recente classificado para calcular giro e cobertura.
                  </p>
                }
              >
                <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Giro 30d</TableHead>
                        <TableHead className="text-right">Cobertura</TableHead>
                        <TableHead className="text-right">Consumo 30d</TableHead>
                        <TableHead className="text-right">CMV 30d</TableHead>
                        <TableHead className="text-right">Valor em estoque</TableHead>
                        <TableHead>Risco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockIntelligence.highTurnoverRows.map((row) => (
                        <TableRow key={row.stockId}>
                          <TableCell className="font-medium">{row.productName}</TableCell>
                          <TableCell>{row.sku}</TableCell>
                          <TableCell className="text-right font-semibold">{formatRatio(row.turnover30)}</TableCell>
                          <TableCell className="text-right">{formatDays(row.coverageDays)}</TableCell>
                          <TableCell className="text-right">{formatQty(row.consumption30Qty)} {row.unit}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.consumption30Value)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.stockValue)}</TableCell>
                          <TableCell>
                            <Badge className={getRiskBadgeClass(row.riskLevel)}>
                              {getRiskLabel(row.riskLevel)}
                            </Badge>
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
                  title="Curva ABC de estoque"
                  description="Classificação dos itens por participação no valor imobilizado: A até 80%, B até 95%, C restante."
                  empty={stockIntelligence.abcRows.length === 0}
                  emptyState={
                    <p className="text-sm text-muted-foreground">
                      Não há valor em estoque suficiente para montar a curva ABC.
                    </p>
                  }
                  footer={
                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <span>A: {stockIntelligence.abcSummary.A.items} itens • {formatCurrency(stockIntelligence.abcSummary.A.value)} • {formatPercent(stockIntelligence.abcSummary.A.percent)}</span>
                      <span>B: {stockIntelligence.abcSummary.B.items} itens • {formatCurrency(stockIntelligence.abcSummary.B.value)} • {formatPercent(stockIntelligence.abcSummary.B.percent)}</span>
                      <span>C: {stockIntelligence.abcSummary.C.items} itens • {formatCurrency(stockIntelligence.abcSummary.C.value)} • {formatPercent(stockIntelligence.abcSummary.C.percent)}</span>
                    </div>
                  }
                >
                  <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ABC</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Valor estoque</TableHead>
                          <TableHead className="text-right">% item</TableHead>
                          <TableHead className="text-right">% acum.</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockIntelligence.abcRows.slice(0, 20).map((row) => (
                          <TableRow key={row.stockId}>
                            <TableCell>
                              <Badge className={getAbcBadgeClass(row.abcClass)}>{row.abcClass}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{row.productName}</TableCell>
                            <TableCell>{row.sku}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.stockValue)}</TableCell>
                            <TableCell className="text-right">{formatPercent(row.participationPercent)}</TableCell>
                            <TableCell className="text-right">{formatPercent(row.cumulativePercent)}</TableCell>
                            <TableCell className="text-right">{formatQty(row.currentQty)} {row.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </DashboardTableShell>
              </div>

              <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
                <DashboardTableShell
                  title="Produtos sem movimentação"
                  description="Itens com saldo parado há 30 dias ou sem registro recente de movimentação."
                  empty={stockIntelligence.noMovementRows.length === 0}
                  emptyState={
                    <p className="text-sm text-muted-foreground">
                      Nenhum produto com saldo parado identificado no período analisado.
                    </p>
                  }
                >
                  <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead className="text-right">Valor parado</TableHead>
                          <TableHead>Última mov.</TableHead>
                          <TableHead className="text-right">Dias sem mov.</TableHead>
                          <TableHead>Setor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockIntelligence.noMovementRows.map((row) => (
                          <TableRow key={row.stockId}>
                            <TableCell className="font-medium">{row.productName}</TableCell>
                            <TableCell>{row.sku}</TableCell>
                            <TableCell className="text-right">{formatQty(row.currentQty)} {row.unit}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.stockValue)}</TableCell>
                            <TableCell>{formatDateLabel(row.lastMovementAt)}</TableCell>
                            <TableCell className="text-right">
                              {row.daysWithoutMovement === null ? "Sem registro" : `${row.daysWithoutMovement} dias`}
                            </TableCell>
                            <TableCell>{row.sector}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </DashboardTableShell>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
                <DashboardTableShell
                  title="Sugestão de produção inteligente"
                  description="Sugestão baseada em ruptura futura, saldo mínimo, estoque médio e cobertura de 7 dias."
                  empty={stockIntelligence.productionSuggestions.length === 0}
                  emptyState={
                    <p className="text-sm text-muted-foreground">
                      Nenhuma sugestão de produção ou reposição necessária com os dados atuais.
                    </p>
                  }
                >
                  <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead className="text-right">Consumo/dia</TableHead>
                          <TableHead className="text-right">Cobertura</TableHead>
                          <TableHead className="text-right">Sugerido</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockIntelligence.productionSuggestions.map((row) => (
                          <TableRow key={row.stockId}>
                            <TableCell className="font-medium">{row.productName}</TableCell>
                            <TableCell>{row.productionAction}</TableCell>
                            <TableCell className="text-right">{formatQty(row.currentQty)} {row.unit}</TableCell>
                            <TableCell className="text-right">{formatQty(row.avgDailyConsumption)} {row.unit}</TableCell>
                            <TableCell className="text-right">{formatDays(row.coverageDays)}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">
                              {formatQty(row.productionSuggestionQty)} {row.unit}
                            </TableCell>
                            <TableCell>{row.productionSuggestionReason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </DashboardTableShell>
              </div>

              <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
                <DashboardTableShell
                  title="Consumo fora do padrão"
                  description="Comparativo do consumo do mês atual contra o mês anterior, destacando variações iguais ou superiores a 50%."
                  empty={stockIntelligence.abnormalConsumptionRows.length === 0}
                  emptyState={
                    <p className="text-sm text-muted-foreground">
                      Nenhum consumo fora do padrão identificado no comparativo mensal.
                    </p>
                  }
                >
                  <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Consumo atual</TableHead>
                          <TableHead className="text-right">Consumo anterior</TableHead>
                          <TableHead className="text-right">% Var.</TableHead>
                          <TableHead className="text-right">CMV atual</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockIntelligence.abnormalConsumptionRows.map((row) => (
                          <TableRow key={row.stockId}>
                            <TableCell className="font-medium">{row.productName}</TableCell>
                            <TableCell>{row.sku}</TableCell>
                            <TableCell className="text-right">{formatQty(row.consumptionCurrentMonthQty)} {row.unit}</TableCell>
                            <TableCell className="text-right">{formatQty(row.consumptionPreviousMonthQty)} {row.unit}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  (row.abnormalConsumptionPercent ?? 0) > 0
                                    ? "text-emerald-600 font-semibold"
                                    : "text-red-600 font-semibold"
                                }
                              >
                                {formatPercent(row.abnormalConsumptionPercent, { showSignal: true })}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(row.consumptionCurrentMonthValue)}</TableCell>
                            <TableCell>{row.abnormalConsumptionLabel}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </DashboardTableShell>
              </div>
            </div>

            <div className={`${GLASS_CARD_CLASS} rounded-3xl`}>
              <DashboardTableShell
                title="Acuracidade de estoque - ajustes e divergências"
                description="Ranking dos produtos com maior volume de ajustes nos últimos 30 dias para orientar inventário, perdas e revisão de ficha técnica."
                empty={stockIntelligence.adjustmentRankingRows.length === 0}
                emptyState={
                  <p className="text-sm text-muted-foreground">
                    Nenhum ajuste ou divergência recente identificado nas movimentações analisadas.
                  </p>
                }
                footer={
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Acuracidade estimada: {stockIntelligence.stockAccuracy === null ? "Sem base" : formatPercent(stockIntelligence.stockAccuracy)}
                    </span>
                    <span>
                      Ajustes 30d: {formatQty(stockIntelligence.totalAdjustments30Qty)} de {formatQty(stockIntelligence.totalMovement30Qty)} movimentados
                    </span>
                  </div>
                }
              >
                <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Ajustes 30d</TableHead>
                        <TableHead className="text-right">Valor ajuste</TableHead>
                        <TableHead className="text-right">Consumo 30d</TableHead>
                        <TableHead className="text-right">Impacto</TableHead>
                        <TableHead>Local</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockIntelligence.adjustmentRankingRows.map((row) => {
                        const impact = row.consumption30Qty > 0 ? (row.adjustments30Qty / row.consumption30Qty) * 100 : 100;

                        return (
                          <TableRow key={row.stockId}>
                            <TableCell className="font-medium">{row.productName}</TableCell>
                            <TableCell>{row.sku}</TableCell>
                            <TableCell className="text-right">{formatQty(row.adjustments30Qty)} {row.unit}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.adjustments30Value)}</TableCell>
                            <TableCell className="text-right">{formatQty(row.consumption30Qty)} {row.unit}</TableCell>
                            <TableCell className="text-right">{formatPercent(impact)}</TableCell>
                            <TableCell>{row.location}</TableCell>
                          </TableRow>
                        );
                      })}
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
                  <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
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
                  <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
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
                <div className={`${GLASS_INNER_CLASS} overflow-x-auto p-1`}>
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
                              {getProductTypeLabel(row.meta?.product_type)}
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