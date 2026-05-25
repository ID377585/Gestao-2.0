"use server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export type NutritionFacts = {
  calories_kcal: number;
  carbohydrates_g: number;
  total_sugars_g: number;
  added_sugars_g: number;
  proteins_g: number;
  total_fat_g: number;
  saturated_fat_g: number;
  trans_fat_g: number;
  dietary_fiber_g: number;
  sodium_mg: number;
};

export type NutritionLabelRow = {
  key: keyof NutritionFacts;
  label: string;
  unit: "kcal" | "g" | "mg";
  value: number;
  dailyValuePercent: number | null;
};

export type NutritionLabelSheet = {
  id: string;
  name: string;
  category: string;
  sector: string;
  active: boolean;
  yieldPortions: number;
  portionWeight: number;
  portionWeightUnit: string;
  householdMeasure: string | null;
  allergens: string | null;
  storageInstructions: string | null;
  status: "complete" | "partial" | "pending";
  missingNutritionIngredients: string[];
  invalidQuantityIngredients: string[];
  totalRecipeWeightG: number;
  perServing: NutritionFacts;
  per100g: NutritionFacts;
  labelRows: NutritionLabelRow[];
};

export type NutritionSnapshotSummary = {
  id: string;
  technicalSheetId: string;
  createdAt: string;
  status: "complete" | "partial" | "pending";
  servingWeightG: number;
  totalRecipeWeightG: number;
  portions: number;
  caloriesKcal: number;
  sodiumMg: number;
  createdBy: string | null;
};

type IngredientRow = {
  product_id: string | null;
  ingredient_name: string | null;
  usage_quantity: number | null;
  usage_unit: string | null;
};

type SheetRow = {
  id: string;
  name: string | null;
  category: string | null;
  sector: string | null;
  active: boolean | null;
  yield_portions: number | null;
  portion_weight: number | null;
  portion_weight_unit: string | null;
  yield_label: string | null;
  allergens: string | null;
  storage_instructions: string | null;
  ingredients: IngredientRow[] | null;
};

type ProductNutritionRow = NutritionFacts & {
  product_id: string;
};

const ZERO_NUTRITION: NutritionFacts = {
  calories_kcal: 0,
  carbohydrates_g: 0,
  total_sugars_g: 0,
  added_sugars_g: 0,
  proteins_g: 0,
  total_fat_g: 0,
  saturated_fat_g: 0,
  trans_fat_g: 0,
  dietary_fiber_g: 0,
  sodium_mg: 0,
};

const DAILY_VALUES: Partial<Record<keyof NutritionFacts, number>> = {
  calories_kcal: 2000,
  carbohydrates_g: 300,
  added_sugars_g: 50,
  proteins_g: 50,
  total_fat_g: 65,
  saturated_fat_g: 20,
  dietary_fiber_g: 25,
  sodium_mg: 2000,
};

async function getContext() {
  const supabaseAuth = await createSupabaseServerClient();
  const supabase = createSupabaseAdminClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any)?.establishment_id as string | undefined;

  if (!establishmentId) throw new Error("Estabelecimento não encontrado para o usuário atual.");

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !user) throw new Error("Usuário não autenticado.");

  return { supabase, establishmentId, userId: user.id };
}

function isMissingNutritionTableError(error: unknown) {
  const code = String((error as any)?.code ?? "");
  const message = String((error as any)?.message ?? "").toLowerCase();

  return (
    code === "42P01" ||
    message.includes("product_nutrition_facts") ||
    message.includes("technical_sheet_nutrition_snapshots") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toGramQuantity(quantity: number, unit: string | null | undefined) {
  const normalizedUnit = String(unit ?? "G").trim().toUpperCase();
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (["G", "GR", "GRAMA", "GRAMAS"].includes(normalizedUnit)) return quantity;
  if (["KG", "KILO", "QUILO", "QUILOS"].includes(normalizedUnit)) return quantity * 1000;
  if (["MG", "MILIGRAMA", "MILIGRAMAS"].includes(normalizedUnit)) return quantity / 1000;
  if (["ML", "MILILITRO", "MILILITROS"].includes(normalizedUnit)) return quantity;
  if (["L", "LT", "LITRO", "LITROS"].includes(normalizedUnit)) return quantity * 1000;
  return null;
}

function addNutrition(target: NutritionFacts, source: NutritionFacts, multiplier: number) {
  for (const key of Object.keys(ZERO_NUTRITION) as Array<keyof NutritionFacts>) {
    target[key] += toNumber(source[key]) * multiplier;
  }
}

function multiplyNutrition(source: NutritionFacts, multiplier: number) {
  const result = { ...ZERO_NUTRITION };
  addNutrition(result, source, multiplier);
  return result;
}

function roundNutrition(value: number, digits = 1) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeNutritionFacts(row?: ProductNutritionRow | null): NutritionFacts {
  if (!row) return { ...ZERO_NUTRITION };
  return {
    calories_kcal: toNumber(row.calories_kcal),
    carbohydrates_g: toNumber(row.carbohydrates_g),
    total_sugars_g: toNumber(row.total_sugars_g),
    added_sugars_g: toNumber(row.added_sugars_g),
    proteins_g: toNumber(row.proteins_g),
    total_fat_g: toNumber(row.total_fat_g),
    saturated_fat_g: toNumber(row.saturated_fat_g),
    trans_fat_g: toNumber(row.trans_fat_g),
    dietary_fiber_g: toNumber(row.dietary_fiber_g),
    sodium_mg: toNumber(row.sodium_mg),
  };
}

function buildLabelRows(perServing: NutritionFacts): NutritionLabelRow[] {
  const rows: Array<{ key: keyof NutritionFacts; label: string; unit: "kcal" | "g" | "mg" }> = [
    { key: "calories_kcal", label: "Valor energético", unit: "kcal" },
    { key: "carbohydrates_g", label: "Carboidratos", unit: "g" },
    { key: "total_sugars_g", label: "Açúcares totais", unit: "g" },
    { key: "added_sugars_g", label: "Açúcares adicionados", unit: "g" },
    { key: "proteins_g", label: "Proteínas", unit: "g" },
    { key: "total_fat_g", label: "Gorduras totais", unit: "g" },
    { key: "saturated_fat_g", label: "Gorduras saturadas", unit: "g" },
    { key: "trans_fat_g", label: "Gorduras trans", unit: "g" },
    { key: "dietary_fiber_g", label: "Fibra alimentar", unit: "g" },
    { key: "sodium_mg", label: "Sódio", unit: "mg" },
  ];

  return rows.map((row) => {
    const value = row.key === "calories_kcal" || row.key === "sodium_mg" ? roundNutrition(perServing[row.key], 0) : roundNutrition(perServing[row.key], 1);
    const dailyValue = DAILY_VALUES[row.key];
    return { ...row, value, dailyValuePercent: dailyValue ? Math.round((value / dailyValue) * 100) : null };
  });
}

function buildNutritionLabel(sheet: SheetRow, nutritionByProductId: Map<string, ProductNutritionRow>): NutritionLabelSheet {
  const ingredients = sheet.ingredients ?? [];
  const totalRecipeNutrition = { ...ZERO_NUTRITION };
  const missingNutritionIngredients: string[] = [];
  const invalidQuantityIngredients: string[] = [];
  let totalRecipeWeightG = 0;

  for (const ingredient of ingredients) {
    const name = String(ingredient.ingredient_name ?? "Ingrediente sem nome").trim();
    const amountG = toGramQuantity(toNumber(ingredient.usage_quantity), ingredient.usage_unit);
    if (!amountG) {
      invalidQuantityIngredients.push(name);
      continue;
    }
    totalRecipeWeightG += amountG;
    if (!ingredient.product_id) {
      missingNutritionIngredients.push(name);
      continue;
    }
    const nutrition = nutritionByProductId.get(String(ingredient.product_id));
    if (!nutrition) {
      missingNutritionIngredients.push(name);
      continue;
    }
    addNutrition(totalRecipeNutrition, normalizeNutritionFacts(nutrition), amountG / 100);
  }

  const yieldPortions = Math.max(1, toNumber(sheet.yield_portions));
  const registeredPortionWeight = toNumber(sheet.portion_weight);
  const fallbackPortionWeight = totalRecipeWeightG > 0 ? totalRecipeWeightG / yieldPortions : 0;
  const portionWeight = registeredPortionWeight > 0 ? registeredPortionWeight : fallbackPortionWeight;
  const servingMultiplier = totalRecipeWeightG > 0 ? portionWeight / totalRecipeWeightG : 0;
  const perServing = multiplyNutrition(totalRecipeNutrition, servingMultiplier);
  const per100g = totalRecipeWeightG > 0 ? multiplyNutrition(totalRecipeNutrition, 100 / totalRecipeWeightG) : { ...ZERO_NUTRITION };
  const missingCount = missingNutritionIngredients.length + invalidQuantityIngredients.length;
  const status = missingCount === 0 && ingredients.length > 0 ? "complete" : missingCount < ingredients.length ? "partial" : "pending";

  return {
    id: String(sheet.id),
    name: String(sheet.name ?? "Sem nome"),
    category: String(sheet.category ?? "Sem categoria"),
    sector: String(sheet.sector ?? "Sem setor"),
    active: sheet.active !== false,
    yieldPortions,
    portionWeight: roundNutrition(portionWeight, 1),
    portionWeightUnit: String(sheet.portion_weight_unit ?? "g").toLowerCase(),
    householdMeasure: sheet.yield_label,
    allergens: sheet.allergens,
    storageInstructions: sheet.storage_instructions,
    status,
    missingNutritionIngredients: Array.from(new Set(missingNutritionIngredients)).slice(0, 12),
    invalidQuantityIngredients: Array.from(new Set(invalidQuantityIngredients)).slice(0, 12),
    totalRecipeWeightG: roundNutrition(totalRecipeWeightG, 1),
    perServing,
    per100g,
    labelRows: buildLabelRows(perServing),
  };
}

export async function listNutritionLabelSheets(): Promise<NutritionLabelSheet[]> {
  const { supabase, establishmentId } = await getContext();
  const { data: sheets, error: sheetsError } = await supabase
    .from("technical_sheets")
    .select(`id,name,category,sector,active,yield_portions,portion_weight,portion_weight_unit,yield_label,allergens,storage_instructions,ingredients:technical_sheet_ingredients(product_id,ingredient_name,usage_quantity,usage_unit)`)
    .eq("establishment_id", establishmentId)
    .order("name", { ascending: true });

  if (sheetsError) {
    console.error("Erro ao carregar fichas para tabela nutricional:", sheetsError);
    throw new Error("Não foi possível carregar as fichas técnicas para tabela nutricional.");
  }

  const typedSheets = (sheets ?? []) as SheetRow[];
  const productIds = Array.from(new Set(typedSheets.flatMap((sheet) => sheet.ingredients ?? []).map((ingredient) => ingredient.product_id).filter(Boolean).map(String)));
  const nutritionByProductId = new Map<string, ProductNutritionRow>();

  if (productIds.length > 0) {
    const { data: nutritionFacts, error: nutritionError } = await supabase
      .from("product_nutrition_facts")
      .select("product_id,calories_kcal,carbohydrates_g,total_sugars_g,added_sugars_g,proteins_g,total_fat_g,saturated_fat_g,trans_fat_g,dietary_fiber_g,sodium_mg")
      .eq("establishment_id", establishmentId)
      .in("product_id", productIds);

    if (nutritionError) {
      if (isMissingNutritionTableError(nutritionError)) {
        console.warn("Tabela product_nutrition_facts ainda não existe. Exibindo fichas como pendentes até aplicar a migration.");
      } else {
        console.error("Erro ao carregar nutrientes dos produtos:", nutritionError);
        throw new Error("Não foi possível carregar os dados nutricionais dos produtos.");
      }
    } else {
      for (const row of (nutritionFacts ?? []) as ProductNutritionRow[]) nutritionByProductId.set(String(row.product_id), row);
    }
  }

  return typedSheets.filter((sheet) => sheet.active !== false).map((sheet) => buildNutritionLabel(sheet, nutritionByProductId));
}

export async function listNutritionSnapshots(technicalSheetId: string): Promise<NutritionSnapshotSummary[]> {
  const { supabase, establishmentId } = await getContext();

  if (!technicalSheetId) return [];

  const { data, error } = await supabase
    .from("technical_sheet_nutrition_snapshots")
    .select("id,technical_sheet_id,created_at,status,serving_weight_g,total_recipe_weight_g,portions,per_serving,created_by")
    .eq("establishment_id", establishmentId)
    .eq("technical_sheet_id", technicalSheetId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    if (isMissingNutritionTableError(error)) {
      return [];
    }

    console.error("Erro ao carregar snapshots nutricionais:", error);
    throw new Error("Não foi possível carregar o histórico de snapshots nutricionais.");
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    technicalSheetId: String(row.technical_sheet_id),
    createdAt: String(row.created_at),
    status: ["complete", "partial", "pending"].includes(String(row.status)) ? row.status : "pending",
    servingWeightG: toNumber(row.serving_weight_g),
    totalRecipeWeightG: toNumber(row.total_recipe_weight_g),
    portions: toNumber(row.portions),
    caloriesKcal: toNumber(row.per_serving?.calories_kcal),
    sodiumMg: toNumber(row.per_serving?.sodium_mg),
    createdBy: row.created_by ? String(row.created_by) : null,
  }));
}

export async function saveNutritionSnapshot(sheet: NutritionLabelSheet) {
  const { supabase, establishmentId, userId } = await getContext();
  const { error } = await supabase.from("technical_sheet_nutrition_snapshots").insert({
    establishment_id: establishmentId,
    technical_sheet_id: sheet.id,
    serving_weight_g: sheet.portionWeight,
    household_measure: sheet.householdMeasure,
    total_recipe_weight_g: sheet.totalRecipeWeightG,
    portions: sheet.yieldPortions,
    per_serving: sheet.perServing,
    per_100g: sheet.per100g,
    status: sheet.status,
    missing_items: { missingNutritionIngredients: sheet.missingNutritionIngredients, invalidQuantityIngredients: sheet.invalidQuantityIngredients },
    created_by: userId,
  });
  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A migration da Tabela Nutricional ainda não foi aplicada no Supabase.");
    }

    console.error("Erro ao salvar snapshot nutricional:", error);
    throw new Error("Não foi possível salvar o snapshot da tabela nutricional.");
  }
}
