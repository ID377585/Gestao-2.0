"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

const TECHNICAL_SHEET_BUCKET = "technical-sheet-images";

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
  image_url?: string | null;
  image_path?: string | null;

  temperature_celsius?: number | null;
  storage_instructions?: string | null;
  shelf_life_frozen?: string | null;
  shelf_life_refrigerated?: string | null;
  shelf_life_room_temp?: string | null;
  allergens?: string | null;
  source_updated_at?: string | null;
  import_origin?: string | null;
  source_file_name?: string | null;
  source_page_number?: number | null;

  ingredients: TechnicalSheetIngredientInput[];
};

type ImportedRecipe = {
  name: string;
  category: string;
  yield_portions: number;
  portion_weight: number;
  prep_time_minutes: number;
  preparation_method: string;
  temperature_celsius: number | null;
  storage_instructions: string | null;
  shelf_life_frozen: string | null;
  shelf_life_refrigerated: string | null;
  shelf_life_room_temp: string | null;
  allergens: string | null;
  source_updated_at: string | null;
  source_file_name: string | null;
  source_page_number: number | null;
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

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function parseBrazilianDateToIso(value: string | null | undefined) {
  if (!value) return null;
  const m = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeSpaces(value: string) {
  return value
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function shouldIgnoreLine(line: string) {
  const upper = line.toUpperCase().trim();

  if (!upper) return true;

  const ignoredFragments = [
    "INGREDIENTES",
    "MODO DE PREPARO",
    "ATUALIZADA EM",
    "FICOU COM DÚVIDAS",
    "ENTRE EM CONTATO",
    "IVAN ESCOBAR",
    "CONFEITEIRO CHEFE",
    "ARMAZENAMENTO",
    "ALERGÊNICOS",
    "CONTÉM",
    "GRAU DE DIFICULDADE",
    "TEMPERATURA",
    "TEMPO DE PREP",
    "TEMPO COCÇÃO",
    "FATOR COCÇÃO",
    "FATOR CORREÇÃO",
    "RENDIMENTO",
    "PESO DA PORÇÃO",
    "PESO LÍQUIDO",
  ];

  return ignoredFragments.some((fragment) => upper.includes(fragment));
}

function extractTitle(pageText: string) {
  const lines = normalizeSpaces(pageText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const ingredientIndex = lines.findIndex((line) =>
    line.toUpperCase().includes("INGREDIENTES")
  );

  if (ingredientIndex > 0) {
    for (let i = ingredientIndex - 1; i >= 0; i--) {
      const line = lines[i];
      if (!shouldIgnoreLine(line) && /[A-Za-zÀ-ÿ]/.test(line)) {
        return line.trim();
      }
    }
  }

  for (const line of lines) {
    if (!shouldIgnoreLine(line) && /[A-Za-zÀ-ÿ]/.test(line)) {
      return line.trim();
    }
  }

  return "Receita importada";
}

function extractTemperature(pageText: string) {
  const match = pageText.match(/(\d{1,3})\s*º/);
  return match ? toNumber(match[1], 0) : null;
}

function extractPrepTime(pageText: string) {
  const match =
    pageText.match(/TEM\s*PO\s*DE\s*PREP\.[\s\S]{0,50}?(\d{1,4})/i) ||
    pageText.match(/(\d{1,3})\s*º\s*(\d{1,4})\s*Minutos/i);

  if (!match) return 0;

  return match[2] ? toNumber(match[2], 0) : toNumber(match[1], 0);
}

function extractPortionWeight(pageText: string) {
  const matches = [
    ...pageText.matchAll(/(\d+(?:[.,]\d+)?)\s*(GRAMAS|G|KILO|KG)\b/gi),
  ];

  if (!matches.length) return 0;

  const last = matches[matches.length - 1];
  const value = toNumber(last[1], 0);
  const unit = String(last[2] ?? "").toUpperCase();

  if (unit === "KILO" || unit === "KG") {
    return Number((value * 1000).toFixed(2));
  }

  return value;
}

function extractYieldPortions(pageText: string) {
  const candidates = [
    pageText.match(/\b(\d+)\s+Pacotes?\b/i),
    pageText.match(/\b(\d+)\s+PAC\b/i),
    pageText.match(/\b(\d+)\s+Bisnaga\b/i),
    pageText.match(/\b(\d+)\s+BSN\b/i),
    pageText.match(/\b(\d+)\s+assadeiras?\b/i),
  ].filter(Boolean) as RegExpMatchArray[];

  if (!candidates.length) return 1;

  return toNumber(candidates[0][1], 1);
}

function extractUpdatedDate(pageText: string) {
  const match = pageText.match(/Atualizada em:\s*(\d{2}\/\d{2}\/\d{4})/i);
  return match ? parseBrazilianDateToIso(match[1]) : null;
}

function extractStorage(pageText: string) {
  const match = pageText.match(/Armazenamento:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function extractShelfLifeFrozen(pageText: string) {
  const match =
    pageText.match(/Congelamento:\s*(.+)/i) ||
    pageText.match(/Congelado\s*:\s*(.+)/i);

  return match ? match[1].trim() : null;
}

function extractShelfLifeRefrigerated(pageText: string) {
  const match = pageText.match(/Sob refrigeração:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function extractShelfLifeRoomTemp(pageText: string) {
  const match =
    pageText.match(/Temperatura Ambiente:\s*(.+)/i) ||
    pageText.match(/Temp\.\s*Ambiente:\s*(.+)/i);

  return match ? match[1].trim() : null;
}

function extractAllergens(pageText: string) {
  const normalized = normalizeSpaces(pageText);

  if (/N[ÃA]O CONT[ÉE]M/i.test(normalized)) {
    return "NÃO CONTÉM";
  }

  const containsMatch = normalized.match(/Cont[eé]m:\s*(.+)/i);
  if (containsMatch?.[1]) {
    return containsMatch[1].trim();
  }

  return null;
}

function extractPreparationMethod(pageText: string) {
  const normalized = normalizeSpaces(pageText);

  const match = normalized.match(
    /Modo de Preparo:\s*([\s\S]*?)(?:Armazenamento:|Atualizada em:|Alerg[eê]nicos|Cont[eé]m:|Ficou com dúvidas|Confeiteiro Chefe)/i
  );

  return match?.[1]?.trim() || "";
}

function inferUsageUnit(name: string) {
  const upper = name.toUpperCase();

  if (
    upper.includes("OVO") &&
    (upper.includes("UNI") || upper.includes("UNID"))
  ) {
    return "UN";
  }

  return "G";
}

function isIngredientValueLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const hasDigits = /\d/.test(trimmed);
  const mostlyNumbers = /^[0-9.,\sXxA-Za-zº°()-]+$/.test(trimmed);

  return hasDigits && mostlyNumbers;
}

function extractIngredients(pageText: string): TechnicalSheetIngredientInput[] {
  const lines = normalizeSpaces(pageText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const ingredients: TechnicalSheetIngredientInput[] = [];

  let ingredientsStart = lines.findIndex((line) =>
    line.toUpperCase().includes("INGREDIENTES")
  );

  if (ingredientsStart < 0) return ingredients;

  ingredientsStart += 1;

  let ingredientsEnd = lines.findIndex((line, idx) => {
    if (idx <= ingredientsStart) return false;
    return (
      line.toUpperCase().includes("PESO LÍQUIDO") ||
      line.toUpperCase().includes("MODO DE PREPARO")
    );
  });

  if (ingredientsEnd < 0) {
    ingredientsEnd = lines.length;
  }

  const block = lines.slice(ingredientsStart, ingredientsEnd);

  let i = 0;
  while (i < block.length) {
    const current = block[i];

    if (shouldIgnoreLine(current)) {
      i++;
      continue;
    }

    if (/^\d+X(\s+\d+X)*$/i.test(current)) {
      i++;
      continue;
    }

    if (
      current.toUpperCase().includes("PAC") ||
      current.toUpperCase().includes("BSN") ||
      current.toUpperCase().includes("ASSADEIRA")
    ) {
      i++;
      continue;
    }

    const nameParts: string[] = [];

    while (i < block.length && !isIngredientValueLine(block[i])) {
      const line = block[i].trim();
      if (!shouldIgnoreLine(line)) {
        nameParts.push(line);
      }
      i++;
    }

    if (!nameParts.length || i >= block.length) {
      i++;
      continue;
    }

    const valueLine = block[i];
    const numbers = valueLine.match(/\d+(?:[.,]\d+)?/g) ?? [];
    const usageQuantity = numbers.length ? toNumber(numbers[0], 0) : 0;

    const ingredientName = nameParts.join(" ").replace(/\s+/g, " ").trim();

    if (ingredientName) {
      const usageUnit = inferUsageUnit(ingredientName);

      ingredients.push({
        product_id: null,
        ingredient_name: ingredientName,
        usage_quantity: usageQuantity,
        usage_unit: usageUnit,
        purchase_price: 0,
        purchase_quantity: 1,
        purchase_unit: usageUnit,
        correction_factor: 1,
        cooking_factor: 1,
        base_unit_cost: 0,
        final_cost: 0,
        sort_order: ingredients.length,
      });
    }

    i++;
  }

  return ingredients;
}

async function extractPdfPagesText(file: File) {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const doc = await pdfjs.getDocument({
    data: uint8,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const text = textContent.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join("\n");

    pages.push(normalizeSpaces(text));
  }

  return pages;
}

function parsePdfPageToRecipe(
  pageText: string,
  pageNumber: number,
  fileName: string,
  defaultCategory: string
): ImportedRecipe | null {
  const name = extractTitle(pageText);
  const ingredients = extractIngredients(pageText);
  const preparation_method = extractPreparationMethod(pageText);

  if (!name || !ingredients.length) {
    return null;
  }

  return {
    name,
    category: defaultCategory || "Importado PDF",
    yield_portions: extractYieldPortions(pageText),
    portion_weight: extractPortionWeight(pageText),
    prep_time_minutes: extractPrepTime(pageText),
    preparation_method,
    temperature_celsius: extractTemperature(pageText),
    storage_instructions: extractStorage(pageText),
    shelf_life_frozen: extractShelfLifeFrozen(pageText),
    shelf_life_refrigerated: extractShelfLifeRefrigerated(pageText),
    shelf_life_room_temp: extractShelfLifeRoomTemp(pageText),
    allergens: extractAllergens(pageText),
    source_updated_at: extractUpdatedDate(pageText),
    source_file_name: fileName,
    source_page_number: pageNumber,
    ingredients,
  };
}

export async function uploadTechnicalSheetImageAction(formData: FormData) {
  const { supabase, establishmentId, userId } = await getContext();

  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File)) {
    throw new Error("Nenhum arquivo de imagem foi enviado.");
  }

  const file = fileEntry;

  if (!file.type.startsWith("image/")) {
    throw new Error("O arquivo enviado precisa ser uma imagem.");
  }

  const maxSizeInBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeInBytes) {
    throw new Error("A imagem deve ter no máximo 10MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = sanitizeFileName(file.name);
  const filePath = `${establishmentId}/${userId}/${Date.now()}-${safeName || `imagem.${extension}`}`;

  const { error: uploadError } = await supabase.storage
    .from(TECHNICAL_SHEET_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Erro ao enviar imagem da ficha técnica:", uploadError);
    throw new Error(
      `Não foi possível enviar a imagem para o Supabase. ${uploadError.message}`
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from(TECHNICAL_SHEET_BUCKET)
    .getPublicUrl(filePath);

  return {
    imageUrl: publicUrlData.publicUrl,
    imagePath: filePath,
  };
}

export async function deleteTechnicalSheetImageAction(imagePath: string) {
  const { supabase } = await getContext();

  if (!imagePath?.trim()) return;

  const { error } = await supabase.storage
    .from(TECHNICAL_SHEET_BUCKET)
    .remove([imagePath]);

  if (error) {
    console.error("Erro ao excluir imagem da ficha técnica:", error);
  }
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
      image_url,
      image_path,
      temperature_celsius,
      storage_instructions,
      shelf_life_frozen,
      shelf_life_refrigerated,
      shelf_life_room_temp,
      allergens,
      source_updated_at,
      import_origin,
      source_file_name,
      source_page_number,
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
        throw new Error(
          "Há ingrediente vinculado a produto inválido para este estabelecimento."
        );
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
      image_url: input.image_url?.trim() || null,
      image_path: input.image_path?.trim() || null,
      temperature_celsius: input.temperature_celsius ?? null,
      storage_instructions: input.storage_instructions?.trim() || null,
      shelf_life_frozen: input.shelf_life_frozen?.trim() || null,
      shelf_life_refrigerated: input.shelf_life_refrigerated?.trim() || null,
      shelf_life_room_temp: input.shelf_life_room_temp?.trim() || null,
      allergens: input.allergens?.trim() || null,
      source_updated_at: input.source_updated_at || null,
      import_origin: input.import_origin?.trim() || null,
      source_file_name: input.source_file_name?.trim() || null,
      source_page_number: input.source_page_number ?? null,
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
    console.error(
      "Erro ao criar ingredientes da ficha técnica:",
      ingredientsError
    );
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
    .select("id, establishment_id, image_path")
    .eq("id", input.id)
    .single();

  if (currentError || !current) {
    throw new Error("Ficha técnica não encontrada.");
  }

  if ((current as any).establishment_id !== establishmentId) {
    throw new Error("Ficha técnica não pertence ao estabelecimento atual.");
  }

  const currentImagePath = (current as any).image_path as string | null;
  const newImagePath = input.image_path?.trim() || null;

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
      image_url: input.image_url?.trim() || null,
      image_path: newImagePath,
      temperature_celsius: input.temperature_celsius ?? null,
      storage_instructions: input.storage_instructions?.trim() || null,
      shelf_life_frozen: input.shelf_life_frozen?.trim() || null,
      shelf_life_refrigerated: input.shelf_life_refrigerated?.trim() || null,
      shelf_life_room_temp: input.shelf_life_room_temp?.trim() || null,
      allergens: input.allergens?.trim() || null,
      source_updated_at: input.source_updated_at || null,
      import_origin: input.import_origin?.trim() || null,
      source_file_name: input.source_file_name?.trim() || null,
      source_page_number: input.source_page_number ?? null,
    })
    .eq("id", input.id)
    .eq("establishment_id", establishmentId);

  if (updateError) {
    console.error("Erro ao atualizar ficha técnica:", updateError);
    throw new Error("Não foi possível atualizar a ficha técnica.");
  }

  if (currentImagePath && currentImagePath !== newImagePath) {
    const { error: removeOldImageError } = await supabase.storage
      .from(TECHNICAL_SHEET_BUCKET)
      .remove([currentImagePath]);

    if (removeOldImageError) {
      console.error(
        "Erro ao remover imagem antiga da ficha:",
        removeOldImageError
      );
    }
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
    throw new Error(
      "A ficha foi atualizada, mas houve erro ao salvar os ingredientes."
    );
  }

  revalidatePath("/dashboard/fichas-tecnicas");
}

export async function deleteTechnicalSheet(id: string) {
  const { supabase, establishmentId } = await getContext();

  if (!id) throw new Error("ID da ficha não informado.");

  const { data: current, error: currentError } = await supabase
    .from("technical_sheets")
    .select("image_path")
    .eq("id", id)
    .eq("establishment_id", establishmentId)
    .single();

  if (currentError) {
    console.error(
      "Erro ao buscar imagem da ficha antes de excluir:",
      currentError
    );
  }

  const { error } = await supabase
    .from("technical_sheets")
    .delete()
    .eq("id", id)
    .eq("establishment_id", establishmentId);

  if (error) {
    console.error("Erro ao excluir ficha técnica:", error);
    throw new Error("Não foi possível excluir a ficha técnica.");
  }

  const imagePath = (current as any)?.image_path as string | null;
  if (imagePath) {
    const { error: removeImageError } = await supabase.storage
      .from(TECHNICAL_SHEET_BUCKET)
      .remove([imagePath]);

    if (removeImageError) {
      console.error(
        "Erro ao excluir imagem da ficha técnica:",
        removeImageError
      );
    }
  }

  revalidatePath("/dashboard/fichas-tecnicas");
}

export async function importTechnicalSheetsFromPdfAction(formData: FormData) {
  const { supabase, establishmentId, userId } = await getContext();

  const fileEntry = formData.get("file");
  const categoryEntry = formData.get("defaultCategory");

  if (!(fileEntry instanceof File)) {
    throw new Error("Envie um arquivo PDF.");
  }

  const file = fileEntry;

  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("O arquivo enviado precisa ser um PDF.");
  }

  const defaultCategory =
    String(categoryEntry ?? "Importado PDF").trim() || "Importado PDF";

  const pages = await extractPdfPagesText(file);

  const recipes = pages
    .map((pageText, index) =>
      parsePdfPageToRecipe(pageText, index + 1, file.name, defaultCategory)
    )
    .filter(Boolean) as ImportedRecipe[];

  if (!recipes.length) {
    throw new Error("Não foi possível identificar receitas válidas no PDF.");
  }

  const created: Array<{ id: string; name: string; page: number | null }> = [];

  for (const recipe of recipes) {
    const { data: sheet, error: sheetError } = await supabase
      .from("technical_sheets")
      .insert({
        establishment_id: establishmentId,
        name: recipe.name,
        category: recipe.category,
        yield_portions: recipe.yield_portions,
        portion_weight: recipe.portion_weight,
        prep_time_minutes: recipe.prep_time_minutes,
        profit_margin_percent: 0,
        sale_price: 0,
        total_cost: 0,
        cost_per_portion: 0,
        preparation_method: recipe.preparation_method || null,
        image_url: null,
        image_path: null,
        temperature_celsius: recipe.temperature_celsius,
        storage_instructions: recipe.storage_instructions,
        shelf_life_frozen: recipe.shelf_life_frozen,
        shelf_life_refrigerated: recipe.shelf_life_refrigerated,
        shelf_life_room_temp: recipe.shelf_life_room_temp,
        allergens: recipe.allergens,
        source_updated_at: recipe.source_updated_at,
        import_origin: "pdf_canva",
        source_file_name: recipe.source_file_name,
        source_page_number: recipe.source_page_number,
        created_by: userId,
      })
      .select("id, name")
      .single();

    if (sheetError || !sheet) {
      console.error("Erro ao criar ficha importada:", sheetError, recipe);
      throw new Error(`Falha ao criar a ficha "${recipe.name}".`);
    }

    if (recipe.ingredients.length) {
      const payload = recipe.ingredients.map((ingredient, index) => ({
        technical_sheet_id: sheet.id,
        product_id: null,
        ingredient_name: ingredient.ingredient_name.trim(),
        usage_quantity: ingredient.usage_quantity,
        usage_unit: ingredient.usage_unit.trim().toUpperCase(),
        purchase_price: 0,
        purchase_quantity: ingredient.purchase_quantity || 1,
        purchase_unit: ingredient.purchase_unit.trim().toUpperCase(),
        correction_factor: ingredient.correction_factor || 1,
        cooking_factor: ingredient.cooking_factor || 1,
        base_unit_cost: 0,
        final_cost: 0,
        sort_order: index,
      }));

      const { error: ingredientsError } = await supabase
        .from("technical_sheet_ingredients")
        .insert(payload);

      if (ingredientsError) {
        console.error("Erro ao criar ingredientes importados:", ingredientsError);
        throw new Error(
          `A ficha "${recipe.name}" foi criada, mas os ingredientes não foram salvos.`
        );
      }
    }

    created.push({
      id: sheet.id,
      name: recipe.name,
      page: recipe.source_page_number,
    });
  }

  revalidatePath("/dashboard/fichas-tecnicas");

  return {
    ok: true,
    importedCount: created.length,
    recipes: created,
  };
}