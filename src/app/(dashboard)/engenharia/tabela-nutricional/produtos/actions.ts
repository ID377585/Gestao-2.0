"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import type { NutritionFacts } from "../actions";

export type ProductNutritionEditorItem = {
  productId: string;
  name: string;
  brand: string | null;
  category: string | null;
  sectorCategory: string | null;
  defaultUnitLabel: string | null;
  allergens: string | null;
  hasNutrition: boolean;
  nutrition: NutritionFacts;
  source: string | null;
  notes: string | null;
  updatedAt: string | null;
};

export type ProductNutritionInput = NutritionFacts & {
  productId: string;
  source?: string | null;
  notes?: string | null;
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

async function getContext() {
  const supabaseAuth = await createSupabaseServerClient();
  const supabase = createSupabaseAdminClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id as string | undefined;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado para o usuário atual.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  return { supabase, establishmentId, userId: user.id };
}

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeNutrition(input: Partial<NutritionFacts>): NutritionFacts {
  return {
    calories_kcal: toNumber(input.calories_kcal),
    carbohydrates_g: toNumber(input.carbohydrates_g),
    total_sugars_g: toNumber(input.total_sugars_g),
    added_sugars_g: toNumber(input.added_sugars_g),
    proteins_g: toNumber(input.proteins_g),
    total_fat_g: toNumber(input.total_fat_g),
    saturated_fat_g: toNumber(input.saturated_fat_g),
    trans_fat_g: toNumber(input.trans_fat_g),
    dietary_fiber_g: toNumber(input.dietary_fiber_g),
    sodium_mg: toNumber(input.sodium_mg),
  };
}

export async function listProductsForNutritionEditor(): Promise<ProductNutritionEditorItem[]> {
  const { supabase, establishmentId } = await getContext();

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,name,brand,category,sector_category,default_unit_label,allergens")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (productsError) {
    console.error("Erro ao carregar produtos para nutrição:", productsError);
    throw new Error("Não foi possível carregar os produtos.");
  }

  const productIds = (products ?? []).map((product: any) => String(product.id));
  const nutritionByProductId = new Map<string, any>();

  if (productIds.length > 0) {
    const { data: nutritionFacts, error: nutritionError } = await supabase
      .from("product_nutrition_facts")
      .select("product_id,calories_kcal,carbohydrates_g,total_sugars_g,added_sugars_g,proteins_g,total_fat_g,saturated_fat_g,trans_fat_g,dietary_fiber_g,sodium_mg,source,notes,updated_at")
      .eq("establishment_id", establishmentId)
      .in("product_id", productIds);

    if (nutritionError) {
      console.error("Erro ao carregar dados nutricionais dos produtos:", nutritionError);
      throw new Error("Não foi possível carregar os dados nutricionais.");
    }

    for (const row of nutritionFacts ?? []) {
      nutritionByProductId.set(String((row as any).product_id), row);
    }
  }

  return (products ?? []).map((product: any) => {
    const nutrition = nutritionByProductId.get(String(product.id));

    return {
      productId: String(product.id),
      name: String(product.name ?? "Sem nome"),
      brand: product.brand ?? null,
      category: product.category ?? null,
      sectorCategory: product.sector_category ?? null,
      defaultUnitLabel: product.default_unit_label ?? null,
      allergens: product.allergens ?? null,
      hasNutrition: Boolean(nutrition),
      nutrition: nutrition ? normalizeNutrition(nutrition) : { ...ZERO_NUTRITION },
      source: nutrition?.source ?? null,
      notes: nutrition?.notes ?? null,
      updatedAt: nutrition?.updated_at ?? null,
    };
  });
}

export async function saveProductNutrition(input: ProductNutritionInput) {
  const { supabase, establishmentId, userId } = await getContext();

  if (!input.productId) {
    throw new Error("Produto não informado.");
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,establishment_id")
    .eq("id", input.productId)
    .single();

  if (productError || !product || (product as any).establishment_id !== establishmentId) {
    throw new Error("Produto não encontrado para este estabelecimento.");
  }

  const nutrition = normalizeNutrition(input);

  const { error } = await supabase
    .from("product_nutrition_facts")
    .upsert(
      {
        establishment_id: establishmentId,
        product_id: input.productId,
        serving_basis: "100g",
        ...nutrition,
        source: input.source?.trim() || null,
        notes: input.notes?.trim() || null,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "establishment_id,product_id" },
    );

  if (error) {
    console.error("Erro ao salvar dados nutricionais:", error);
    throw new Error("Não foi possível salvar os dados nutricionais do produto.");
  }

  revalidatePath("/engenharia/tabela-nutricional");
  revalidatePath("/engenharia/tabela-nutricional/produtos");
}
