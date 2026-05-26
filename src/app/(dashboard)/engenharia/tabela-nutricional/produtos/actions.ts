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

export type ProductNutritionEditorResult = {
  items: ProductNutritionEditorItem[];
  error?: string;
};

export type SaveProductNutritionResult = {
  ok: boolean;
  error?: string;
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

function isMissingNutritionTableError(error: unknown) {
  const code = String((error as any)?.code ?? "");
  const message = String((error as any)?.message ?? "").toLowerCase();

  return code === "42P01" || (message.includes("relation") && message.includes("product_nutrition_facts") && message.includes("does not exist"));
}

function isColumnOrSchemaError(error: unknown) {
  const code = String((error as any)?.code ?? "");
  const message = String((error as any)?.message ?? "").toLowerCase();

  return (
    code === "42703" ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

function getFriendlySupabaseError(error: unknown, fallback: string) {
  const code = String((error as any)?.code ?? "");
  const message = String((error as any)?.message ?? "").toLowerCase();

  if (isMissingNutritionTableError(error)) {
    return "A tabela product_nutrition_facts não existe no Supabase. Aplique a migration da Tabela Nutricional.";
  }

  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return "Sem permissão para acessar ou salvar os dados nutricionais neste estabelecimento.";
  }

  if (code === "23503" || message.includes("foreign key")) {
    return "Não foi possível salvar porque o produto ou usuário relacionado não foi encontrado no banco.";
  }

  if (code === "42P10" || message.includes("no unique") || message.includes("on conflict")) {
    return "A tabela nutricional precisa da chave única por estabelecimento/produto. Reaplique a migration da Tabela Nutricional no Supabase.";
  }

  if (isColumnOrSchemaError(error)) {
    return "A estrutura da tabela/produtos no Supabase está diferente do esperado. Atualize a migration ou recarregue o schema cache do Supabase.";
  }

  return fallback;
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

async function assertProductsBelongToEstablishment(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  establishmentId: string,
  productIds: string[],
) {
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));

  if (uniqueProductIds.length === 0) {
    throw new Error("Nenhum produto informado.");
  }

  const { data: products, error } = await supabase
    .from("products")
    .select("id,establishment_id")
    .in("id", uniqueProductIds);

  if (error) {
    console.error("Erro ao validar produtos para nutrição:", error);
    throw new Error(getFriendlySupabaseError(error, "Não foi possível validar os produtos informados."));
  }

  const allowedIds = new Set(
    (products ?? [])
      .filter((product: any) => product.establishment_id === establishmentId)
      .map((product: any) => String(product.id)),
  );

  const invalidIds = uniqueProductIds.filter((productId) => !allowedIds.has(productId));

  if (invalidIds.length > 0) {
    throw new Error(`Há produtos inválidos ou de outro estabelecimento: ${invalidIds.slice(0, 5).join(", ")}`);
  }
}

async function fetchProductsForNutritionEditor(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  establishmentId: string,
) {
  const fullSelect = "id,name,brand,category,sector_category,default_unit_label,allergens";
  const fallbackSelect = "id,name,brand,category";

  let { data, error } = await supabase
    .from("products")
    .select(fullSelect)
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error && isColumnOrSchemaError(error)) {
    console.warn("Consulta de produtos para nutrição falhou com colunas opcionais. Tentando consulta mínima.", error);
    const retry = await supabase
      .from("products")
      .select(fallbackSelect)
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .order("name", { ascending: true });
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("Erro ao carregar produtos para nutrição:", error);
    throw new Error(getFriendlySupabaseError(error, "Não foi possível carregar os produtos."));
  }

  return data ?? [];
}

async function buildProductNutritionEditorItems(): Promise<ProductNutritionEditorItem[]> {
  const { supabase, establishmentId } = await getContext();
  const products = await fetchProductsForNutritionEditor(supabase, establishmentId);
  const productIds = products.map((product: any) => String(product.id));
  const nutritionByProductId = new Map<string, any>();

  if (productIds.length > 0) {
    const { data: nutritionFacts, error: nutritionError } = await supabase
      .from("product_nutrition_facts")
      .select("product_id,calories_kcal,carbohydrates_g,total_sugars_g,added_sugars_g,proteins_g,total_fat_g,saturated_fat_g,trans_fat_g,dietary_fiber_g,sodium_mg,source,notes,updated_at")
      .eq("establishment_id", establishmentId)
      .in("product_id", productIds);

    if (nutritionError) {
      if (isMissingNutritionTableError(nutritionError)) {
        console.warn("Tabela product_nutrition_facts ainda não existe. Produtos serão exibidos como pendentes até aplicar a migration.");
      } else {
        console.error("Erro ao carregar dados nutricionais dos produtos:", nutritionError);
        throw new Error(getFriendlySupabaseError(nutritionError, "Não foi possível carregar os dados nutricionais."));
      }
    } else {
      for (const row of nutritionFacts ?? []) {
        nutritionByProductId.set(String((row as any).product_id), row);
      }
    }
  }

  return products.map((product: any) => {
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

export async function listProductsForNutritionEditor(): Promise<ProductNutritionEditorItem[]> {
  return buildProductNutritionEditorItems();
}

export async function listProductsForNutritionEditorSafe(): Promise<ProductNutritionEditorResult> {
  try {
    const items = await buildProductNutritionEditorItems();
    return { items };
  } catch (error) {
    console.error("Erro inesperado ao carregar editor nutricional:", error);
    return {
      items: [],
      error: error instanceof Error ? error.message : "Não foi possível carregar os produtos para nutrição.",
    };
  }
}

export async function saveProductNutrition(input: ProductNutritionInput): Promise<SaveProductNutritionResult> {
  try {
    const { supabase, establishmentId, userId } = await getContext();

    if (!input.productId) {
      return { ok: false, error: "Produto não informado." };
    }

    await assertProductsBelongToEstablishment(supabase, establishmentId, [input.productId]);

    const nutrition = normalizeNutrition(input);
    const basePayload = {
      establishment_id: establishmentId,
      product_id: input.productId,
      serving_basis: "100g",
      ...nutrition,
      source: input.source?.trim() || null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const payloadWithCreatedBy = {
      ...basePayload,
      created_by: userId,
    };

    let { error } = await supabase
      .from("product_nutrition_facts")
      .upsert(payloadWithCreatedBy, { onConflict: "establishment_id,product_id" });

    if (error && isColumnOrSchemaError(error)) {
      console.warn("Salvamento de nutrição falhou com coluna opcional. Tentando novamente sem created_by.", error);
      const retry = await supabase
        .from("product_nutrition_facts")
        .upsert(basePayload, { onConflict: "establishment_id,product_id" });
      error = retry.error;
    }

    if (error) {
      console.error("Erro ao salvar dados nutricionais:", error);
      return {
        ok: false,
        error: getFriendlySupabaseError(error, "Não foi possível salvar os dados nutricionais do produto."),
      };
    }

    revalidatePath("/engenharia/tabela-nutricional");
    revalidatePath("/engenharia/tabela-nutricional/produtos");
    return { ok: true };
  } catch (error) {
    console.error("Erro inesperado ao salvar dados nutricionais:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível salvar os dados nutricionais do produto.",
    };
  }
}

export async function saveProductNutritionBatch(inputs: ProductNutritionInput[]) {
  const { supabase, establishmentId, userId } = await getContext();

  const cleanInputs = inputs.filter((input) => input.productId);

  if (cleanInputs.length === 0) {
    throw new Error("Nenhuma linha válida para importar.");
  }

  if (cleanInputs.length > 500) {
    throw new Error("Importe no máximo 500 produtos por vez.");
  }

  await assertProductsBelongToEstablishment(
    supabase,
    establishmentId,
    cleanInputs.map((input) => input.productId),
  );

  const now = new Date().toISOString();
  const payload = cleanInputs.map((input) => ({
    establishment_id: establishmentId,
    product_id: input.productId,
    serving_basis: "100g",
    ...normalizeNutrition(input),
    source: input.source?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: userId,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("product_nutrition_facts")
    .upsert(payload, { onConflict: "establishment_id,product_id" });

  if (error) {
    if (isMissingNutritionTableError(error)) {
      throw new Error("A tabela product_nutrition_facts não existe no Supabase. Aplique a migration da Tabela Nutricional.");
    }

    console.error("Erro ao importar dados nutricionais:", error);
    throw new Error(getFriendlySupabaseError(error, "Não foi possível importar os dados nutricionais."));
  }

  revalidatePath("/engenharia/tabela-nutricional");
  revalidatePath("/engenharia/tabela-nutricional/produtos");

  return { importedCount: payload.length };
}
