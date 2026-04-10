"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export type TechnicalSheetIngredientInput = {
  product_id: string | null;
  ingredient_name: string;
  usage_quantity: number;
  usage_unit: string;
  purchase_price: number;
  purchase_quantity: number;
  purchase_unit: string;
  correction_factor: number;
  cooking_factor: number;
  base_unit_cost: number;
  final_cost: number;
  sort_order: number;
};

export type TechnicalSheetInput = {
  id?: string;
  name: string;
  category: string;
  yield_portions: number;
  portion_weight: number;
  prep_time_minutes: number;
  profit_margin_percent: number;
  sale_price: number;
  total_cost: number;
  cost_per_portion: number;
  preparation_method: string;
  ingredients: TechnicalSheetIngredientInput[];
};

async function getContext() {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any)?.establishment_id as
    | string
    | undefined;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado para o usuário atual.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  return {
    supabase,
    establishmentId,
    userId: user.id,
  };
}

export async function listTechnicalSheets() {
  const { supabase, establishmentId } = await getContext();

  const { data, error } = await supabase
    .from("technical_sheets")
    .select(`
      id,
      establishment_id,
      name,
      category,
      yield_portions,
      portion_weight,
      prep_time_minutes,
      profit_margin_percent,
      sale_price,
      total_cost,
      cost_per_portion,
      preparation_method,
      created_by,
      created_at,
      updated_at,
      ingredients:technical_sheet_ingredients (
        id,
        technical_sheet_id,
        product_id,
        ingredient_name,
        usage_quantity,
        usage_unit,
        purchase_price,
        purchase_quantity,
        purchase_unit,
        correction_factor,
        cooking_factor,
        base_unit_cost,
        final_cost,
        sort_order,
        created_at
      )
    `)
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar fichas técnicas:", error);
    throw new Error("Não foi possível carregar as fichas técnicas.");
  }

  return data ?? [];
}

export async function createTechnicalSheet(input: TechnicalSheetInput) {
  const { supabase, establishmentId, userId } = await getContext();

  if (!input.name?.trim()) throw new Error("Nome da ficha é obrigatório.");
  if (!input.category?.trim()) throw new Error("Categoria é obrigatória.");
  if (!input.ingredients?.length) {
    throw new Error("Adicione pelo menos um ingrediente.");
  }

  const productIds = input.ingredients
    .map((i) => i.product_id)
    .filter(Boolean) as string[];

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, establishment_id")
      .in("id", productIds);

    if (productsError) {
      console.error("Erro ao validar produtos da ficha:", productsError);
      throw new Error("Não foi possível validar os produtos da ficha.");
    }

    const validSet = new Set(
      (products ?? [])
        .filter((p: any) => p.establishment_id === establishmentId)
        .map((p: any) => p.id)
    );

    for (const productId of productIds) {
      if (!validSet.has(productId)) {
        throw new Error("Há ingrediente vinculado a produto inválido para este estabelecimento.");
      }
    }
  }

  const { data: sheet, error: sheetError } = await supabase
    .from("technical_sheets")
    .insert({
      establishment_id: establishmentId,
      name: input.name.trim(),
      category: input.category.trim(),
      yield_portions: input.yield_portions,
      portion_weight: input.portion_weight,
      prep_time_minutes: input.prep_time_minutes,
      profit_margin_percent: input.profit_margin_percent,
      sale_price: input.sale_price,
      total_cost: input.total_cost,
      cost_per_portion: input.cost_per_portion,
      preparation_method: input.preparation_method?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (sheetError || !sheet) {
    console.error("Erro ao criar ficha técnica:", sheetError);
    throw new Error("Não foi possível criar a ficha técnica.");
  }

  const ingredientsPayload = input.ingredients.map((ingredient, index) => ({
    technical_sheet_id: sheet.id,
    product_id: ingredient.product_id || null,
    ingredient_name: ingredient.ingredient_name.trim(),
    usage_quantity: ingredient.usage_quantity,
    usage_unit: ingredient.usage_unit.trim().toUpperCase(),
    purchase_price: ingredient.purchase_price,
    purchase_quantity: ingredient.purchase_quantity,
    purchase_unit: ingredient.purchase_unit.trim().toUpperCase(),
    correction_factor: ingredient.correction_factor,
    cooking_factor: ingredient.cooking_factor,
    base_unit_cost: ingredient.base_unit_cost,
    final_cost: ingredient.final_cost,
    sort_order: ingredient.sort_order ?? index,
  }));

  const { error: ingredientsError } = await supabase
    .from("technical_sheet_ingredients")
    .insert(ingredientsPayload);

  if (ingredientsError) {
    console.error("Erro ao criar ingredientes da ficha técnica:", ingredientsError);
    throw new Error("Ficha criada, mas houve erro ao salvar os ingredientes.");
  }

  revalidatePath("/dashboard/fichas-tecnicas");
  return sheet;
}

export async function updateTechnicalSheet(input: TechnicalSheetInput) {
  const { supabase, establishmentId } = await getContext();

  if (!input.id) throw new Error("ID da ficha não informado.");
  if (!input.name?.trim()) throw new Error("Nome da ficha é obrigatório.");
  if (!input.category?.trim()) throw new Error("Categoria é obrigatória.");
  if (!input.ingredients?.length) {
    throw new Error("Adicione pelo menos um ingrediente.");
  }

  const { data: current, error: currentError } = await supabase
    .from("technical_sheets")
    .select("id, establishment_id")
    .eq("id", input.id)
    .single();

  if (currentError || !current) {
    throw new Error("Ficha técnica não encontrada.");
  }

  if ((current as any).establishment_id !== establishmentId) {
    throw new Error("Ficha técnica não pertence ao estabelecimento atual.");
  }

  const { error: updateError } = await supabase
    .from("technical_sheets")
    .update({
      name: input.name.trim(),
      category: input.category.trim(),
      yield_portions: input.yield_portions,
      portion_weight: input.portion_weight,
      prep_time_minutes: input.prep_time_minutes,
      profit_margin_percent: input.profit_margin_percent,
      sale_price: input.sale_price,
      total_cost: input.total_cost,
      cost_per_portion: input.cost_per_portion,
      preparation_method: input.preparation_method?.trim() || null,
    })
    .eq("id", input.id)
    .eq("establishment_id", establishmentId);

  if (updateError) {
    console.error("Erro ao atualizar ficha técnica:", updateError);
    throw new Error("Não foi possível atualizar a ficha técnica.");
  }

  const { error: deleteIngredientsError } = await supabase
    .from("technical_sheet_ingredients")
    .delete()
    .eq("technical_sheet_id", input.id);

  if (deleteIngredientsError) {
    console.error("Erro ao limpar ingredientes antigos:", deleteIngredientsError);
    throw new Error("Não foi possível atualizar os ingredientes da ficha.");
  }

  const ingredientsPayload = input.ingredients.map((ingredient, index) => ({
    technical_sheet_id: input.id,
    product_id: ingredient.product_id || null,
    ingredient_name: ingredient.ingredient_name.trim(),
    usage_quantity: ingredient.usage_quantity,
    usage_unit: ingredient.usage_unit.trim().toUpperCase(),
    purchase_price: ingredient.purchase_price,
    purchase_quantity: ingredient.purchase_quantity,
    purchase_unit: ingredient.purchase_unit.trim().toUpperCase(),
    correction_factor: ingredient.correction_factor,
    cooking_factor: ingredient.cooking_factor,
    base_unit_cost: ingredient.base_unit_cost,
    final_cost: ingredient.final_cost,
    sort_order: ingredient.sort_order ?? index,
  }));

  const { error: insertIngredientsError } = await supabase
    .from("technical_sheet_ingredients")
    .insert(ingredientsPayload);

  if (insertIngredientsError) {
    console.error("Erro ao recriar ingredientes da ficha:", insertIngredientsError);
    throw new Error("A ficha foi atualizada, mas houve erro ao salvar os ingredientes.");
  }

  revalidatePath("/dashboard/fichas-tecnicas");
}

export async function deleteTechnicalSheet(id: string) {
  const { supabase, establishmentId } = await getContext();

  if (!id) throw new Error("ID da ficha não informado.");

  const { error } = await supabase
    .from("technical_sheets")
    .delete()
    .eq("id", id)
    .eq("establishment_id", establishmentId);

  if (error) {
    console.error("Erro ao excluir ficha técnica:", error);
    throw new Error("Não foi possível excluir a ficha técnica.");
  }

  revalidatePath("/dashboard/fichas-tecnicas");
}