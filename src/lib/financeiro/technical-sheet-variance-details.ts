import { supabase } from "@/lib/supabase/client";
import { listProductCosts } from "@/lib/financeiro/product-costs";
import type { ProductCostInfo } from "@/lib/financeiro/product-costs";

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

type RawTechnicalSheet = {
  id: string;
  name: string;
  category: string;
  ingredients?: RawTechnicalSheetIngredient[];
};

type RawTechnicalSheetIngredient = {
  id?: string;
  technical_sheet_id?: string;
  product_id?: string | null;
  ingredient_name?: string | null;
  usage_quantity?: number | string | null;
  usage_unit?: string | null;
  base_unit_cost?: number | string | null;
  final_cost?: number | string | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown) {
  return value == null ? "" : String(value);
}

function isSafeFallbackError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? "");

  return (
    message.includes("does not exist") ||
    message.includes("Could not find the table") ||
    message.includes("Could not find") ||
    message.includes("relation") ||
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("Não autenticado") ||
    message.includes("Nao autenticado") ||
    message.includes("Usuário não autenticado") ||
    message.includes("Usuario nao autenticado") ||
    message.includes("permission denied") ||
    message.includes("JWT") ||
    message.includes("row-level security")
  );
}

function calculateVariancePercent(theoretical: number, real: number) {
  if (!theoretical || theoretical <= 0) return 0;
  return ((real - theoretical) / theoretical) * 100;
}

async function safeListProductCosts() {
  try {
    return await listProductCosts();
  } catch (error) {
    if (!isSafeFallbackError(error)) {
      console.warn(
        "[dre.drilldown] Não foi possível carregar custos reais dos produtos.",
        error
      );
    }

    return new Map<string, ProductCostInfo>();
  }
}

async function loadTechnicalSheetsWithNestedIngredients() {
  const { data, error } = await supabase
    .from("technical_sheets")
    .select(
      [
        "id",
        "name",
        "category",
        "ingredients(",
        "id,",
        "technical_sheet_id,",
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
    throw error;
  }

  return Array.isArray(data) ? (data as RawTechnicalSheet[]) : [];
}

async function loadTechnicalSheetsWithSeparatedIngredients() {
  const { data: sheetsData, error: sheetsError } = await supabase
    .from("technical_sheets")
    .select("id,name,category")
    .order("name", { ascending: true });

  if (sheetsError) {
    throw sheetsError;
  }

  const sheets = Array.isArray(sheetsData)
    ? (sheetsData as RawTechnicalSheet[])
    : [];

  if (sheets.length === 0) {
    return [];
  }

  const { data: ingredientsData, error: ingredientsError } = await supabase
    .from("technical_sheet_ingredients")
    .select(
      [
        "id",
        "technical_sheet_id",
        "product_id",
        "ingredient_name",
        "usage_quantity",
        "usage_unit",
        "base_unit_cost",
        "final_cost",
      ].join(",")
    );

  if (ingredientsError) {
    throw ingredientsError;
  }

  const ingredients = Array.isArray(ingredientsData)
    ? (ingredientsData as RawTechnicalSheetIngredient[])
    : [];

  const ingredientsBySheet = new Map<string, RawTechnicalSheetIngredient[]>();

  for (const ingredient of ingredients) {
    const sheetId = toText(ingredient.technical_sheet_id);

    if (!sheetId) {
      continue;
    }

    const current = ingredientsBySheet.get(sheetId) ?? [];
    current.push(ingredient);
    ingredientsBySheet.set(sheetId, current);
  }

  return sheets.map((sheet) => ({
    ...sheet,
    ingredients: ingredientsBySheet.get(toText(sheet.id)) ?? [],
  }));
}

async function loadTechnicalSheets() {
  try {
    return await loadTechnicalSheetsWithNestedIngredients();
  } catch (error) {
    if (!isSafeFallbackError(error)) {
      console.warn(
        "[dre.drilldown] Relação technical_sheets -> ingredients indisponível. Tentando tabela separada.",
        error
      );
    }

    try {
      return await loadTechnicalSheetsWithSeparatedIngredients();
    } catch (fallbackError) {
      if (!isSafeFallbackError(fallbackError)) {
        console.warn(
          "[dre.drilldown] Não foi possível carregar fichas técnicas.",
          fallbackError
        );
      }

      return [];
    }
  }
}

function buildRows(params: {
  sheets: RawTechnicalSheet[];
  productCosts: Map<string, ProductCostInfo>;
}) {
  const rows: TechnicalSheetVarianceDetailRow[] = [];

  for (const sheet of params.sheets) {
    const technicalSheetId = toText(sheet.id);
    const technicalSheetName = toText(sheet.name);
    const category = toText(sheet.category);

    const ingredients = Array.isArray(sheet.ingredients)
      ? sheet.ingredients
      : [];

    for (const ingredient of ingredients) {
      const productIdRaw = ingredient.product_id;
      const productId =
        productIdRaw == null || String(productIdRaw).trim() === ""
          ? null
          : String(productIdRaw);

      const usageQuantity = toNumber(ingredient.usage_quantity);
      const theoreticalUnitCost = toNumber(ingredient.base_unit_cost);
      const theoreticalFinalCost =
        toNumber(ingredient.final_cost) ||
        Number((theoreticalUnitCost * usageQuantity).toFixed(4));

      const costInfo = productId ? params.productCosts.get(productId) : undefined;
      const realUnitCost = costInfo?.unitCost ?? null;

      const realFinalCost =
        realUnitCost != null
          ? Number((realUnitCost * usageQuantity).toFixed(4))
          : null;

      const varianceValue =
        realFinalCost != null
          ? Number((realFinalCost - theoreticalFinalCost).toFixed(4))
          : 0;

      const variancePercent =
        realFinalCost != null
          ? Number(
              calculateVariancePercent(
                theoreticalFinalCost,
                realFinalCost
              ).toFixed(2)
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

  return rows;
}

function buildBySheet(rows: TechnicalSheetVarianceDetailRow[]) {
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

  return Array.from(sheetMap.values())
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
}

export async function getTechnicalSheetVarianceDetails(): Promise<TechnicalSheetVarianceDetailsResult> {
  try {
    const [productCosts, sheets] = await Promise.all([
      safeListProductCosts(),
      loadTechnicalSheets(),
    ]);

    const rows = buildRows({
      sheets,
      productCosts,
    }).sort((a, b) => b.varianceValue - a.varianceValue);

    const bySheet = buildBySheet(rows);

    return {
      rows,
      bySheet,
    };
  } catch (error) {
    console.warn("Falha ao montar drill-down de variância:", error);

    return {
      rows: [],
      bySheet: [],
    };
  }
}