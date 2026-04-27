import { supabase } from "@/lib/supabase/client";
import { listProductCosts } from "@/lib/financeiro/product-costs";

export type TechnicalSheetIngredientVariance = {
  technicalSheetId: string;
  technicalSheetName: string;
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

export type TechnicalSheetVarianceSummary = {
  totalIngredientsLinked: number;
  totalIngredientsWithRealCost: number;
  averageVariancePercent: number;
  totalPositiveVarianceValue: number;
  totalNegativeVarianceValue: number;
  topIngredientsAboveTheoretical: Array<{
    name: string;
    value: number;
  }>;
  topSheetsByExposure: Array<{
    name: string;
    value: number;
  }>;
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

export async function listTechnicalSheetIngredientVariances(): Promise<
  TechnicalSheetIngredientVariance[]
> {
  const productCosts = await listProductCosts();

  try {
    const { data, error } = await supabase
      .from("technical_sheets")
      .select(
        [
          "id",
          "name",
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
      console.warn("Não foi possível carregar variações das fichas técnicas:", error.message);
      return [];
    }

    const result: TechnicalSheetIngredientVariance[] = [];

    if (error) {
  console.error(error);
  return [];
}

const sheets = data as any[];

    for (const sheet of sheets) {
      const technicalSheetId = toText((sheet as Record<string, unknown>).id);
      const technicalSheetName = toText((sheet as Record<string, unknown>).name);
      const ingredients = Array.isArray((sheet as Record<string, unknown>).ingredients)
        ? ((sheet as Record<string, unknown>).ingredients as Record<string, unknown>[])
        : [];

      for (const ingredient of ingredients) {
        const productIdRaw = ingredient.product_id;
        const productId =
          productIdRaw == null || String(productIdRaw).trim() === ""
            ? null
            : String(productIdRaw);

        const ingredientName = toText(ingredient.ingredient_name);
        const usageQuantity = toNumber(ingredient.usage_quantity);
        const usageUnit = toText(ingredient.usage_unit);
        const theoreticalUnitCost = toNumber(ingredient.base_unit_cost);
        const theoreticalFinalCost = toNumber(ingredient.final_cost);

        const realCostInfo = productId ? productCosts.get(productId) : undefined;
        const realUnitCost = realCostInfo?.unitCost ?? null;
        const realFinalCost =
          realUnitCost != null ? Number((usageQuantity * realUnitCost).toFixed(4)) : null;

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

        result.push({
          technicalSheetId,
          technicalSheetName,
          productId,
          ingredientName,
          usageQuantity,
          usageUnit,
          theoreticalUnitCost,
          theoreticalFinalCost,
          realUnitCost,
          realFinalCost,
          varianceValue,
          variancePercent,
          costSource: realCostInfo?.sourceField ?? null,
        });
      }
    }

    return result;
  } catch (error) {
    console.warn("Falha ao calcular variância das fichas técnicas:", error);
    return [];
  }
}

export async function getTechnicalSheetVarianceSummary(): Promise<TechnicalSheetVarianceSummary> {
  const variances = await listTechnicalSheetIngredientVariances();

  const linked = variances.filter((item) => item.productId);
  const withRealCost = variances.filter((item) => item.realUnitCost != null);

  const averageVariancePercent =
    withRealCost.length > 0
      ? withRealCost.reduce((acc, item) => acc + item.variancePercent, 0) /
        withRealCost.length
      : 0;

  const totalPositiveVarianceValue = withRealCost
    .filter((item) => item.varianceValue > 0)
    .reduce((acc, item) => acc + item.varianceValue, 0);

  const totalNegativeVarianceValue = withRealCost
    .filter((item) => item.varianceValue < 0)
    .reduce((acc, item) => acc + item.varianceValue, 0);

  const ingredientMap = new Map<string, number>();
  const sheetMap = new Map<string, number>();

  for (const item of withRealCost) {
    if (item.varianceValue > 0) {
      ingredientMap.set(
        item.ingredientName,
        (ingredientMap.get(item.ingredientName) ?? 0) + item.varianceValue
      );

      sheetMap.set(
        item.technicalSheetName,
        (sheetMap.get(item.technicalSheetName) ?? 0) + item.varianceValue
      );
    }
  }

  const topIngredientsAboveTheoretical = Array.from(ingredientMap.entries())
    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const topSheetsByExposure = Array.from(sheetMap.entries())
    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    totalIngredientsLinked: linked.length,
    totalIngredientsWithRealCost: withRealCost.length,
    averageVariancePercent: Number(averageVariancePercent.toFixed(2)),
    totalPositiveVarianceValue: Number(totalPositiveVarianceValue.toFixed(2)),
    totalNegativeVarianceValue: Number(totalNegativeVarianceValue.toFixed(2)),
    topIngredientsAboveTheoretical,
    topSheetsByExposure,
  };
}