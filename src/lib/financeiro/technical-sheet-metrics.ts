import { supabase } from "@/lib/supabase/client";

export type TechnicalSheetMetric = {
  id: string;
  name: string;
  category: string;
  totalCost: number;
  costPerPortion: number;
  salePrice: number;
  profitMarginPercent: number;
  theoreticalCmvPercent: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TechnicalSheetMetricsSummary = {
  totalSheets: number;
  averageCostPerPortion: number;
  averageSalePrice: number;
  averageTheoreticalCmvPercent: number;
  highestTheoreticalCmv?: {
    id: string;
    name: string;
    value: number;
  };
  lowestMargin?: {
    id: string;
    name: string;
    value: number;
  };
  topCriticalSheets: Array<{
    id: string;
    name: string;
    cmvPercent: number;
    salePrice: number;
    costPerPortion: number;
    marginValue: number;
  }>;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown) {
  return value == null ? "" : String(value);
}

function calculateTheoreticalCmvPercent(costPerPortion: number, salePrice: number) {
  if (!salePrice || salePrice <= 0) return 0;
  return (costPerPortion / salePrice) * 100;
}

function calculateMarginValue(costPerPortion: number, salePrice: number) {
  return salePrice - costPerPortion;
}

export async function listTechnicalSheetMetrics(): Promise<TechnicalSheetMetric[]> {

  try {
    const { data, error } = await supabase
      .from("technical_sheets")
      .select(
        [
          "id",
          "name",
          "category",
          "total_cost",
          "cost_per_portion",
          "sale_price",
          "profit_margin_percent",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .order("name", { ascending: true });

    if (error) {
      console.warn("Não foi possível carregar fichas técnicas para a DRE:", error.message);
      return [];
    }

    if (error) {
  console.error(error);
  return [];
}

      const rows = data as any[];

      return rows.map((row: Record<string, unknown>) => {
      const costPerPortion = toNumber(row.cost_per_portion);
      const salePrice = toNumber(row.sale_price);

      return {
        id: toText(row.id),
        name: toText(row.name),
        category: toText(row.category),
        totalCost: toNumber(row.total_cost),
        costPerPortion,
        salePrice,
        profitMarginPercent: toNumber(row.profit_margin_percent),
        theoreticalCmvPercent: calculateTheoreticalCmvPercent(costPerPortion, salePrice),
        createdAt: row.created_at ? String(row.created_at) : null,
        updatedAt: row.updated_at ? String(row.updated_at) : null,
      };
    });
  } catch (error) {
    console.warn("Falha ao consultar technical_sheets para a DRE:", error);
    return [];
  }
}

export async function getTechnicalSheetMetricsSummary(): Promise<TechnicalSheetMetricsSummary> {
  const sheets = await listTechnicalSheetMetrics();

  if (!sheets.length) {
    return {
      totalSheets: 0,
      averageCostPerPortion: 0,
      averageSalePrice: 0,
      averageTheoreticalCmvPercent: 0,
      topCriticalSheets: [],
    };
  }

  const averageCostPerPortion =
    sheets.reduce((acc, sheet) => acc + sheet.costPerPortion, 0) / sheets.length;

  const averageSalePrice =
    sheets.reduce((acc, sheet) => acc + sheet.salePrice, 0) / sheets.length;

  const averageTheoreticalCmvPercent =
    sheets.reduce((acc, sheet) => acc + sheet.theoreticalCmvPercent, 0) / sheets.length;

  const orderedByCmv = [...sheets].sort(
    (a, b) => b.theoreticalCmvPercent - a.theoreticalCmvPercent
  );

  const orderedByMargin = [...sheets].sort((a, b) => {
    const marginA = calculateMarginValue(a.costPerPortion, a.salePrice);
    const marginB = calculateMarginValue(b.costPerPortion, b.salePrice);
    return marginA - marginB;
  });

  const highestTheoreticalCmv = orderedByCmv[0]
    ? {
        id: orderedByCmv[0].id,
        name: orderedByCmv[0].name,
        value: orderedByCmv[0].theoreticalCmvPercent,
      }
    : undefined;

  const lowestMargin = orderedByMargin[0]
    ? {
        id: orderedByMargin[0].id,
        name: orderedByMargin[0].name,
        value: calculateMarginValue(
          orderedByMargin[0].costPerPortion,
          orderedByMargin[0].salePrice
        ),
      }
    : undefined;

  const topCriticalSheets = orderedByCmv.slice(0, 5).map((sheet) => ({
    id: sheet.id,
    name: sheet.name,
    cmvPercent: sheet.theoreticalCmvPercent,
    salePrice: sheet.salePrice,
    costPerPortion: sheet.costPerPortion,
    marginValue: calculateMarginValue(sheet.costPerPortion, sheet.salePrice),
  }));

  return {
    totalSheets: sheets.length,
    averageCostPerPortion: Number(averageCostPerPortion.toFixed(2)),
    averageSalePrice: Number(averageSalePrice.toFixed(2)),
    averageTheoreticalCmvPercent: Number(averageTheoreticalCmvPercent.toFixed(2)),
    highestTheoreticalCmv,
    lowestMargin,
    topCriticalSheets,
  };
}