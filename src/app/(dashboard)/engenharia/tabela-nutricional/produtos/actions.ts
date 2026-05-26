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

  if (!establishmentId) throw new Error("Estabelecimento não encontrado para o usuário atual.");

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !user) throw new Error("Usuário não autenticado.");

  return { supabase, establishmentId, userId: user.id };
}

function getErrorCode(error: unknown) {
  return String((error as any)?.code ?? "");
}

function getErrorMessage(error: unknown) {
  return String((error as any)?.message ?? "");
}

function isMissingNutritionTableError(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();
  return code === "42P01" || (message.includes("relation") && message.includes("product_nutrition_facts") && message.includes("does not exist"));
}

function isColumnOrSchemaError(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();
  return code === "42703" || message.includes("column") || message.includes("schema cache") || message.includes("could not find");
}

function getFriendlySupabaseError(error: unknown, fallback: string) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  if (isMissingNutritionTableError(error)) return "A tabela product_nutrition_facts não existe no Supabase. Aplique a migration da Tabela Nutricional.";
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) return "Sem permissão para acessar ou salvar os dados nutricionais neste estabelecimento.";
  if (code === "23503" || message.includes("foreign key")) return "Não foi possível salvar porque o produto ou usuário relacionado não foi encontrado no banco.";
  if (code === "42P10" || message.includes("no unique") || message.includes("on conflict")) return "A tabela nutricional precisa da chave única por estabelecimento/produto. Reaplique a migration da Tabela Nutricional no Supabase.";
  if (isColumnOrSchemaError(error)) return `A estrutura da tabela/produtos no Supabase está diferente do esperado. Detalhe: ${getErrorMessage(error) || "schema incompatível"}.`;

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

function omitKeys<T extends Record<string, any>>(payload: T, keys: string[]) {
  const next = { ...payload };
  keys.forEach((key) => delete next[key]);
  return next;
}

async function assertProductsBelongToEstablishment(supabase: ReturnType<typeof createSupabaseAdminClient>, establishmentId: string, productIds: string[]) {
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));
  if (uniqueProductIds.length === 0) throw new Error("Nenhum produto informado.");

  const { data, error } = await supabase.from("products").select("id,establishment_id").in("id", uniqueProductIds);
  if (error) throw new Error(getFriendlySupabaseError(error, "Não foi possível validar os produtos informados."));

  const allowedIds = new Set((data ?? []).filter((product: any) => product.establishment_id === establishmentId).map((product: any) => String(product.id)));
  const invalidIds = uniqueProductIds.filter((productId) => !allowedIds.has(productId));
  if (invalidIds.length > 0) throw new Error(`Há produtos inválidos ou de outro estabelecimento: ${invalidIds.slice(0, 5).join(", ")}`);
}

async function fetchProductsForNutritionEditor(supabase: ReturnType<typeof createSupabaseAdminClient>, establishmentId: string): Promise<any[]> {
  const attempts = [
    { select: "id,name,brand,category,sector_category,default_unit_label,allergens", active: true },
    { select: "id,name,brand,category", active: true },
    { select: "id,name,brand,category,sector_category,default_unit_label,allergens", active: false },
    { select: "id,name,brand,category", active: false },
  ];

  let lastError: unknown = null;

  for (const attempt of attempts) {
    let query = supabase.from("products").select(attempt.select).eq("establishment_id", establishmentId).order("name", { ascending: true });
    if (attempt.active) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (!error) return (data ?? []) as any[];

    lastError = error;
    if (!isColumnOrSchemaError(error)) break;
    console.warn("Consulta de produtos para nutrição falhou. Tentando fallback.", error);
  }

  throw new Error(getFriendlySupabaseError(lastError, "Não foi possível carregar os produtos."));
}

async function fetchNutritionFactsForProducts(supabase: ReturnType<typeof createSupabaseAdminClient>, establishmentId: string, productIds: string[]) {
  const byProductId = new Map<string, any>();
  if (productIds.length === 0) return byProductId;

  const selects = [
    "product_id,calories_kcal,carbohydrates_g,total_sugars_g,added_sugars_g,proteins_g,total_fat_g,saturated_fat_g,trans_fat_g,dietary_fiber_g,sodium_mg,source,notes,updated_at",
    "product_id,calories_kcal,carbohydrates_g,total_sugars_g,proteins_g,total_fat_g,saturated_fat_g,trans_fat_g,dietary_fiber_g,sodium_mg,source,notes,updated_at",
    "product_id,calories_kcal,carbohydrates_g,proteins_g,total_fat_g,sodium_mg,source,notes,updated_at",
    "product_id,calories_kcal,carbohydrates_g,proteins_g,total_fat_g,sodium_mg",
    "product_id",
  ];

  let lastError: unknown = null;

  for (const select of selects) {
    const { data, error } = await supabase
      .from("product_nutrition_facts")
      .select(select)
      .eq("establishment_id", establishmentId)
      .in("product_id", productIds);

    if (!error) {
      for (const row of data ?? []) byProductId.set(String((row as any).product_id), row);
      return byProductId;
    }

    if (isMissingNutritionTableError(error)) return byProductId;
    lastError = error;
    if (!isColumnOrSchemaError(error)) break;
    console.warn("Consulta de nutrição falhou com schema parcial. Tentando fallback.", error);
  }

  throw new Error(getFriendlySupabaseError(lastError, "Não foi possível carregar os dados nutricionais."));
}

async function buildProductNutritionEditorItems(): Promise<ProductNutritionEditorItem[]> {
  const { supabase, establishmentId } = await getContext();
  const products = await fetchProductsForNutritionEditor(supabase, establishmentId);
  const productIds = products.map((product: any) => String(product.id));
  const nutritionByProductId = await fetchNutritionFactsForProducts(supabase, establishmentId, productIds);

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
    return { items: [], error: error instanceof Error ? error.message : "Não foi possível carregar os produtos para nutrição." };
  }
}

async function upsertNutritionWithSchemaFallback(supabase: ReturnType<typeof createSupabaseAdminClient>, payload: Record<string, any>) {
  const variants = [
    payload,
    omitKeys(payload, ["created_by"]),
    omitKeys(payload, ["created_by", "added_sugars_g"]),
    omitKeys(payload, ["created_by", "added_sugars_g", "serving_basis"]),
    omitKeys(payload, ["created_by", "added_sugars_g", "serving_basis", "total_sugars_g", "saturated_fat_g", "trans_fat_g", "dietary_fiber_g", "source", "notes"]),
  ];

  let lastError: unknown = null;

  for (const variant of variants) {
    const { error } = await supabase.from("product_nutrition_facts").upsert(variant, { onConflict: "establishment_id,product_id" });
    if (!error) return null;
    lastError = error;
    if (!isColumnOrSchemaError(error)) return error;
    console.warn("Salvamento de nutrição falhou com schema parcial. Tentando fallback.", error);
  }

  return lastError;
}

export async function saveProductNutrition(input: ProductNutritionInput): Promise<SaveProductNutritionResult> {
  try {
    const { supabase, establishmentId, userId } = await getContext();
    if (!input.productId) return { ok: false, error: "Produto não informado." };

    await assertProductsBelongToEstablishment(supabase, establishmentId, [input.productId]);

    const payload = {
      establishment_id: establishmentId,
      product_id: input.productId,
      serving_basis: "100g",
      ...normalizeNutrition(input),
      source: input.source?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: userId,
      updated_at: new Date().toISOString(),
    };

    const error = await upsertNutritionWithSchemaFallback(supabase, payload);
    if (error) return { ok: false, error: getFriendlySupabaseError(error, "Não foi possível salvar os dados nutricionais do produto.") };

    revalidatePath("/engenharia/tabela-nutricional");
    revalidatePath("/engenharia/tabela-nutricional/produtos");
    return { ok: true };
  } catch (error) {
    console.error("Erro inesperado ao salvar dados nutricionais:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível salvar os dados nutricionais do produto." };
  }
}

export async function saveProductNutritionBatch(inputs: ProductNutritionInput[]) {
  const { supabase, establishmentId, userId } = await getContext();
  const cleanInputs = inputs.filter((input) => input.productId);
  if (cleanInputs.length === 0) throw new Error("Nenhuma linha válida para importar.");
  if (cleanInputs.length > 500) throw new Error("Importe no máximo 500 produtos por vez.");

  await assertProductsBelongToEstablishment(supabase, establishmentId, cleanInputs.map((input) => input.productId));

  let importedCount = 0;
  const now = new Date().toISOString();

  for (const input of cleanInputs) {
    const payload = {
      establishment_id: establishmentId,
      product_id: input.productId,
      serving_basis: "100g",
      ...normalizeNutrition(input),
      source: input.source?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: userId,
      updated_at: now,
    };

    const error = await upsertNutritionWithSchemaFallback(supabase, payload);
    if (error) throw new Error(getFriendlySupabaseError(error, "Não foi possível importar os dados nutricionais."));
    importedCount += 1;
  }

  revalidatePath("/engenharia/tabela-nutricional");
  revalidatePath("/engenharia/tabela-nutricional/produtos");
  return { importedCount };
}
