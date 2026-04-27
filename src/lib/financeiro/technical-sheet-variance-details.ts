import { supabase } from "@/lib/supabase/client";
import { listProductCosts } from "@/lib/financeiro/product-costs";

export type TechnicalSheetVarianceDetailRow = {
  technicalSheetId: string;
  technicalSheetName: string;
  category: string;
  productId: string | null;
  ingredientName: string;
  usageQuantity: number;
  usageUnit: string;
  theoreticalUnitCost: number;
  theoreticalFinalCost: number;
  realUnitCost: number | null;
  realFinalCost: number | null;
  varianceValue: number;
  variancePercent: number;
  costSource: string | null;
};

export type TechnicalSheetVarianceBySheet = {
  technicalSheetId: string;
  technicalSheetName: string;
  category: string;
  ingredientsCount: number;
  ingredientsWithRealCost: number;
  totalTheoreticalCost: number;
  totalRealCost: number;
  totalVarianceValue: number;
  averageVariancePercent: number;
};

export type TechnicalSheetVarianceDetailsResult = {
  rows: TechnicalSheetVarianceDetailRow[];
  bySheet: TechnicalSheetVarianceBySheet[];
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown) {
  return value == null ? "" : String(value);
}

function calculateVariancePercent(theoretical: number, real: number) {
  if (!theoretical || theoretical <= 0) return 0;
  return ((real - theoretical) / theoretical) * 100;
}

export async function getTechnicalSheetVarianceDetails(): Promise<TechnicalSheetVarianceDetailsResult> {
  const productCosts = await listProductCosts();

  try {
    const { data, error } = await supabase
      .from("technical_sheets")
      .select(
        [
          "id",
          "name",
          "category",
          "ingredients(",
          "product_id,",
          "ingredient_name,",
          "usage_quantity,",
          "usage_unit,",
          "base_unit_cost,",
          "final_cost",
          ")",
        ].join("")
      )
      .order("name", { ascending: true });

    if (error) {
      console.warn("Não foi possível carregar detalhes de variância:", error.message);
      return { rows: [], bySheet: [] };
    }

    const rows: TechnicalSheetVarianceDetailRow[] = [];

    if (error) {
  console.error(error);
  return { rows: [], bySheet: [] };
}

    const sheets = data as any[];

for (const sheet of sheets) {
      const rawSheet = sheet as Record<string, unknown>;
      const technicalSheetId = toText(rawSheet.id);
      const technicalSheetName = toText(rawSheet.name);
      const category = toText(rawSheet.category);
      const ingredients = Array.isArray(rawSheet.ingredients)
        ? (rawSheet.ingredients as Record<string, unknown>[])
        : [];

      for (const ingredient of ingredients) {
        const productIdRaw = ingredient.product_id;
        const productId =
          productIdRaw == null || String(productIdRaw).trim() === ""
            ? null
            : String(productIdRaw);

        const usageQuantity = toNumber(ingredient.usage_quantity);
        const theoreticalUnitCost = toNumber(ingredient.base_unit_cost);
        const theoreticalFinalCost = toNumber(ingredient.final_cost);
        const costInfo = productId ? productCosts.get(productId) : undefined;
        const realUnitCost = costInfo?.unitCost ?? null;
        const realFinalCost =
          realUnitCost != null ? Number((realUnitCost * usageQuantity).toFixed(4)) : null;

        const varianceValue =
          realFinalCost != null
            ? Number((realFinalCost - theoreticalFinalCost).toFixed(4))
            : 0;

        const variancePercent =
          realFinalCost != null
            ? Number(
                calculateVariancePercent(theoreticalFinalCost, realFinalCost).toFixed(2)
              )
            : 0;

        rows.push({
          technicalSheetId,
          technicalSheetName,
          category,
          productId,
          ingredientName: toText(ingredient.ingredient_name),
          usageQuantity,
          usageUnit: toText(ingredient.usage_unit),
          theoreticalUnitCost,
          theoreticalFinalCost,
          realUnitCost,
          realFinalCost,
          varianceValue,
          variancePercent,
          costSource: costInfo?.sourceField ?? null,
        });
      }
    }

    const sheetMap = new Map<string, TechnicalSheetVarianceBySheet>();

    for (const row of rows) {
      const current = sheetMap.get(row.technicalSheetId) ?? {
        technicalSheetId: row.technicalSheetId,
        technicalSheetName: row.technicalSheetName,
        category: row.category,
        ingredientsCount: 0,
        ingredientsWithRealCost: 0,
        totalTheoreticalCost: 0,
        totalRealCost: 0,
        totalVarianceValue: 0,
        averageVariancePercent: 0,
      };

      current.ingredientsCount += 1;
      current.totalTheoreticalCost += row.theoreticalFinalCost;
      current.totalVarianceValue += row.varianceValue;

      if (row.realFinalCost != null) {
        current.ingredientsWithRealCost += 1;
        current.totalRealCost += row.realFinalCost;
      }

      sheetMap.set(row.technicalSheetId, current);
    }

    const bySheet = Array.from(sheetMap.values())
      .map((item) => ({
        ...item,
        totalTheoreticalCost: Number(item.totalTheoreticalCost.toFixed(2)),
        totalRealCost: Number(item.totalRealCost.toFixed(2)),
        totalVarianceValue: Number(item.totalVarianceValue.toFixed(2)),
        averageVariancePercent:
          item.totalTheoreticalCost > 0
            ? Number(
                (
                  ((item.totalRealCost - item.totalTheoreticalCost) /
                    item.totalTheoreticalCost) *
                  100
                ).toFixed(2)
              )
            : 0,
      }))
      .sort((a, b) => b.totalVarianceValue - a.totalVarianceValue);

    return {
      rows: rows.sort((a, b) => b.varianceValue - a.varianceValue),
      bySheet,
    };
  } catch (error) {
    console.warn("Falha ao montar drill-down de variância:", error);
    return { rows: [], bySheet: [] };
  }
}