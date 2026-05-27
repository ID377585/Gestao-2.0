import pdfParse from "pdf-parse";
import { supabaseAdmin } from "@/lib/supabase/server";
import { assertBillingLimitAvailable } from "@/lib/billing/limits";

type ParsedIngredient = {
  ingredient_name: string;
  usage_quantity: number;
  usage_unit: string;
  purchase_quantity: number;
  purchase_unit: string;
  correction_factor: number;
  cooking_factor: number;
};

type ParsedPage = {
  pageNumber: number;
  title: string | null;
  rawText: string;
  classification: "complete" | "partial" | "assembly" | "template";
  parsed: {
    name: string;
    category: string;
    preparationMethod: string;
    allergens: string | null;
    storageInstructions: string | null;
    shelfLifeFrozen: string | null;
    shelfLifeRefrigerated: string | null;
    shelfLifeRoomTemp: string | null;
    sourceUpdatedAt: string | null;
    temperatureCelsius: number | null;
    prepTimeMinutes: number | null;
    cookingTimeMinutes: number | null;
    cookingFactorGrams: number | null;
    correctionFactorGrams: number | null;
    yieldLabel: string | null;
    portionWeight: number | null;
    portionWeightUnit: string | null;
    ingredients: ParsedIngredient[];
  };
};

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeUnit(value: string | null | undefined, fallback = "G") {
  const unit = String(value ?? "").trim().toUpperCase();
  return unit || fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function extractTitle(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blacklist = new Set([
    "Ingredientes :",
    "Modo de Preparo:",
    "Contém:",
    "Alergênicos",
    "Atualizada em:",
    "Montagem:",
  ]);

  for (const line of lines.slice(0, 30)) {
    if (
      line.length >= 3 &&
      line.length <= 90 &&
      !blacklist.has(line) &&
      !/^1X\b/i.test(line) &&
      !/^PESO L[ÍI]QUIDO/i.test(line) &&
      !/^TE M/i.test(line) &&
      !/^Grau de/i.test(line) &&
      !/^Confeiteiro/i.test(line) &&
      !/^\(?11\)?/.test(line)
    ) {
      return line;
    }
  }

  return null;
}

function extractBetween(text: string, startLabel: string, endLabels: string[]) {
  const startIndex = text.indexOf(startLabel);
  if (startIndex === -1) return "";

  const from = startIndex + startLabel.length;
  const remaining = text.slice(from);

  let endIndex = remaining.length;

  for (const label of endLabels) {
    const idx = remaining.indexOf(label);
    if (idx !== -1 && idx < endIndex) {
      endIndex = idx;
    }
  }

  return remaining.slice(0, endIndex).trim();
}

function extractField(text: string, label: string) {
  const regex = new RegExp(`${label}\\s*:?\\s*(.+)`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim() || null;
}

function extractNumberNear(text: string, label: string) {
  const regex = new RegExp(`${label}[^\\d]*(\\d+(?:[.,]\\d+)?)`, "i");
  const match = text.match(regex);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function extractFirstTemperature(text: string) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*º/);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function isIgnorableIngredientLine(line: string) {
  const upper = line.toUpperCase().trim();
  if (!upper) return true;

  const ignored = [
    "INGREDIENTES",
    "MODO DE PREPARO",
    "ATUALIZADA EM",
    "FICOU COM DÚVIDAS",
    "ENTRE EM CONTATO",
    "IVAN ESCOBAR",
    "CONFEITEIRO CHEFE",
    "ARMAZENAMENTO",
    "ALERGÊNICOS",
    "ALERGENICOS",
    "CONTÉM",
    "CONTEM",
    "GRAU DE DIFICULDADE",
    "TEMPERATURA",
    "TEMPO DE PREP",
    "TEMPO COCCAO",
    "TEMPO COCÇÃO",
    "FATOR COCÇÃO",
    "FATOR COCCAO",
    "FATOR CORREÇÃO",
    "FATOR CORRECAO",
    "RENDIMENTO",
    "PESO DA PORÇÃO",
    "PESO DA PORCAO",
    "PESO LÍQUIDO",
    "PESO LIQUIDO",
    "ASSISTA O",
    "MINUTOS",
    "GRAUS",
  ];

  return ignored.some((fragment) => upper.includes(fragment));
}

function extractIngredientLines(text: string) {
  const beforePreparation =
    extractBetween(text, "Ingredientes :", [
      "Modo de Preparo:",
      "Montagem:",
      "Atualizada em:",
      "Contém:",
      "Alergênicos",
      "Armazenamento:",
    ]) || text;

  const lines = beforePreparation
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^1X\b/i.test(line))
    .filter((line) => !/^\d+X\b/i.test(line))
    .filter((line) => !isIgnorableIngredientLine(line));

  const ingredients: ParsedIngredient[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/\s{2,}/g, " ").trim();

    if (!cleaned) continue;
    if (/^PESO L[ÍI]QUIDO/i.test(cleaned)) continue;
    if (/^Ingredientes/i.test(cleaned)) continue;

    const match = cleaned.match(/^(.*?)(\d+(?:[.,]\d+)?(?:\s+\d+(?:[.,]\d+)?){0,9})\s*$/);

    if (!match) continue;

    const ingredientName = match[1]?.trim();
    const valuesRaw = match[2]?.trim();

    if (!ingredientName || ingredientName.length < 2) continue;

    const values = valuesRaw
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

    const firstQty = values.length > 0 ? toNumber(values[0], 0) : 0;

    ingredients.push({
      ingredient_name: ingredientName,
      usage_quantity: firstQty,
      usage_unit: "G",
      purchase_quantity: firstQty > 0 ? firstQty : 1,
      purchase_unit: "G",
      correction_factor: 1,
      cooking_factor: 1,
    });
  }

  return ingredients;
}

function classifyPage(title: string | null, text: string) {
  const normalized = text.toLowerCase();

  const hasIngredients = normalized.includes("ingredientes");
  const hasPreparation =
    normalized.includes("modo de preparo") || normalized.includes("montagem:");
  const hasStorage = normalized.includes("armazenamento");
  const hasUpdatedAt = normalized.includes("atualizada em");

  const looksAssembly =
    normalized.includes("montagem:") ||
    (title && /empratamento|montagem/i.test(title));

  const extractedPrep = extractBetween(text, "Modo de Preparo:", [
    "Contém:",
    "Alergênicos",
    "Armazenamento:",
    "Atualizada em:",
  ]);

  const extractedMontagem = extractBetween(text, "Montagem:", [
    "Contém:",
    "Alergênicos",
    "Armazenamento:",
    "Atualizada em:",
  ]);

  const prepText = extractedPrep || extractedMontagem;
  const ingredientCount = extractIngredientLines(text).length;

  const looksTemplate =
    ingredientCount <= 2 &&
    prepText.length < 20 &&
    hasIngredients &&
    hasPreparation;

  if (looksAssembly) return "assembly";
  if (looksTemplate) return "template";
  if (
    hasIngredients &&
    hasPreparation &&
    hasStorage &&
    hasUpdatedAt &&
    ingredientCount >= 3
  ) {
    return "complete";
  }
  return "partial";
}

function parsePage(pageNumber: number, pageText: string): ParsedPage {
  const rawText = normalizeText(pageText);
  const title = extractTitle(rawText);

  const preparationMethod =
    extractBetween(rawText, "Modo de Preparo:", [
      "Contém:",
      "Alergênicos",
      "Armazenamento:",
      "Atualizada em:",
    ]) ||
    extractBetween(rawText, "Montagem:", [
      "Contém:",
      "Alergênicos",
      "Armazenamento:",
      "Atualizada em:",
    ]);

  const portionWeight = extractNumberNear(rawText, "PESO DA PORÇÃO");
  const temperatureCelsius = extractFirstTemperature(rawText);
  const prepTimeMinutes = extractNumberNear(rawText, "TE M PO DE PREP");
  const cookingTimeMinutes = extractNumberNear(rawText, "TE M PO COCÇÃO");
  const cookingFactorGrams = extractNumberNear(rawText, "FATOR COCÇÃO");
  const correctionFactorGrams = extractNumberNear(rawText, "FATOR CORREÇÃO");
  const yieldLabel = extractField(rawText, "RENDI M ENTO");
  const ingredients = extractIngredientLines(rawText);

  const parsed = {
    name: title || `Página ${pageNumber}`,
    category: "Importado PDF",
    preparationMethod,
    allergens: extractField(rawText, "Alergênicos"),
    storageInstructions: extractField(rawText, "Armazenamento"),
    shelfLifeFrozen:
      extractField(rawText, "Congelamento") || extractField(rawText, "Congelado"),
    shelfLifeRefrigerated: extractField(rawText, "Sob refrigeração"),
    shelfLifeRoomTemp:
      extractField(rawText, "Temperatura Ambiente") ||
      extractField(rawText, "Temp. Ambiente"),
    sourceUpdatedAt: extractField(rawText, "Atualizada em"),
    temperatureCelsius,
    prepTimeMinutes,
    cookingTimeMinutes,
    cookingFactorGrams,
    correctionFactorGrams,
    yieldLabel,
    portionWeight,
    portionWeightUnit: portionWeight !== null ? "G" : null,
    ingredients,
  };

  const classification = classifyPage(title, rawText);

  return {
    pageNumber,
    title,
    rawText,
    classification,
    parsed,
  };
}

function splitPages(fullText: string) {
  const normalized = fullText.replace(/\r/g, "");
  const pages = normalized
    .split(
      /\n(?=Biscoitti Savoiardi|Café|Creme do Tiramisù|Tiramisù|Zabaione|Mousse de Choc\. Branco e Iogurte|Compota de Tomate Amarelo|Bolo Pão de Ló|Tinta de Chocolate Vermelho|Farofa de Cacau|Farofa de Manjericão|Panna Cotta|Massa Base de Cookies|Cookies - Gotas de Choc\. e Castanha|Sorvete de Leite|Chantilly|Calda de Chocolate|Pomodoro e Cioccolato|Tomate \(Montagem\)|Calda p\/ Bolo)/i
    )
    .map((p) => p.trim())
    .filter(Boolean);

  return pages;
}

export async function processImportJob(params: {
  jobId: string;
  establishmentId: string;
}) {
  const jobId = String(params.jobId ?? "").trim();
  const establishmentId = String(params.establishmentId ?? "").trim();

  if (!jobId || !establishmentId) {
    throw new Error("Job e empresa são obrigatórios para processar a importação.");
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from("import_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("establishment_id", establishmentId)
    .single();

  if (jobError || !job) {
    throw new Error("Job de importação não encontrado para a empresa ativa.");
  }

  const jobEstablishmentId = String(job.establishment_id ?? "");
  if (jobEstablishmentId !== establishmentId) {
    throw new Error("Job de importação não pertence à empresa ativa.");
  }

  const filePath = String(job.file_path ?? "");
  if (!filePath.startsWith(`${establishmentId}/`)) {
    throw new Error("Arquivo de importação não pertence à empresa ativa.");
  }

  await supabaseAdmin
    .from("import_jobs")
    .update({
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("establishment_id", establishmentId);

  await supabaseAdmin.from("import_job_pages").delete().eq("job_id", jobId);

  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from("technical-sheets")
    .download(filePath);

  if (downloadError || !fileData) {
    await supabaseAdmin
      .from("import_jobs")
      .update({
        status: "error",
        errors: [downloadError?.message || "Falha ao baixar PDF do bucket."],
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("establishment_id", establishmentId);

    throw new Error(downloadError?.message || "Falha ao baixar PDF.");
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const parsedPdf = await pdfParse(buffer);
  const pages = splitPages(parsedPdf.text);
  const parsedPages = pages.map((pageText, index) =>
    parsePage(index + 1, pageText)
  );

  const reportRows = parsedPages.map((page) => ({
    job_id: jobId,
    page_number: page.pageNumber,
    title: page.title,
    classification: page.classification,
    status:
      page.classification === "complete" || page.classification === "assembly"
        ? "detected"
        : page.classification === "template"
        ? "ignored"
        : "review",
    technical_sheet_id: null,
    error_message: null,
    raw_text: page.rawText,
    parsed_data: page.parsed,
    updated_at: new Date().toISOString(),
  }));

  if (reportRows.length > 0) {
    const { error: reportInsertError } = await supabaseAdmin
      .from("import_job_pages")
      .insert(reportRows);

    if (reportInsertError) {
      throw new Error(reportInsertError.message);
    }
  }

  const validPages = parsedPages.filter(
    (page) =>
      page.classification === "complete" || page.classification === "assembly"
  );

  let createdRecipes = 0;
  const errors: string[] = [];
  const createdPages: Array<{ pageNumber: number; title: string }> = [];
  const ignoredPages: Array<{
    pageNumber: number;
    title: string | null;
    reason: string;
  }> = [];

  for (const page of parsedPages) {
    if (page.classification === "template") {
      ignoredPages.push({
        pageNumber: page.pageNumber,
        title: page.title,
        reason: "template/incompleta",
      });
    } else if (page.classification === "partial") {
      ignoredPages.push({
        pageNumber: page.pageNumber,
        title: page.title,
        reason: "dados insuficientes",
      });
    }
  }

  for (const page of validPages) {
    try {
      await assertBillingLimitAvailable({
        supabaseAdmin,
        establishmentId,
        kind: "technicalSheets",
      });
    } catch (limitError: any) {
      errors.push(
        `Página ${page.pageNumber}: ${limitError?.message || "Limite de fichas técnicas atingido."}`
      );
      break;
    }

    const sheetPayload = {
      establishment_id: establishmentId,
      created_by: job.created_by || null,
      name: page.parsed.name,
      category:
        page.classification === "assembly"
          ? "Montagem/Empratamento"
          : job.category || page.parsed.category,
      yield_portions: 1,
      portion_weight: page.parsed.portionWeight ?? 0,
      prep_time_minutes: page.parsed.prepTimeMinutes ?? 0,
      profit_margin_percent: 0,
      sale_price: 0,
      total_cost: 0,
      cost_per_portion: 0,
      preparation_method: page.parsed.preparationMethod || "",
      image_url: null,
      image_path: null,
      difficulty_level: null,
      temperature_celsius: page.parsed.temperatureCelsius,
      cooking_time_minutes: page.parsed.cookingTimeMinutes,
      cooking_factor_grams: page.parsed.cookingFactorGrams,
      correction_factor_grams: page.parsed.correctionFactorGrams,
      yield_label: page.parsed.yieldLabel,
      portion_weight_unit: page.parsed.portionWeightUnit ?? "G",
      storage_instructions: page.parsed.storageInstructions,
      shelf_life_frozen: page.parsed.shelfLifeFrozen,
      shelf_life_refrigerated: page.parsed.shelfLifeRefrigerated,
      shelf_life_room_temp: page.parsed.shelfLifeRoomTemp,
      allergens: page.parsed.allergens,
      source_updated_at: page.parsed.sourceUpdatedAt,
      import_origin: "pdf_batch_import",
      source_file_name: job.file_name,
      source_page_number: page.pageNumber,
      video_url: null,
    };

    const { data: createdSheet, error: sheetError } = await supabaseAdmin
      .from("technical_sheets")
      .insert(sheetPayload)
      .select("id")
      .single();

    if (sheetError || !createdSheet) {
      const msg = `Página ${page.pageNumber}: ${sheetError?.message || "Erro ao criar ficha."}`;
      errors.push(msg);

      await supabaseAdmin
        .from("import_job_pages")
        .update({
          status: "error",
          error_message: sheetError?.message || "Erro ao criar ficha.",
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", jobId)
        .eq("page_number", page.pageNumber);

      continue;
    }

    if (page.parsed.ingredients.length > 0) {
      const ingredientsPayload = page.parsed.ingredients.map((ingredient, index) => ({
        technical_sheet_id: createdSheet.id,
        product_id: null,
        ingredient_name: ingredient.ingredient_name.trim(),
        usage_quantity: ingredient.usage_quantity,
        usage_unit: normalizeUnit(ingredient.usage_unit, "G"),
        purchase_price: 0,
        purchase_quantity: ingredient.purchase_quantity || 1,
        purchase_unit: normalizeUnit(ingredient.purchase_unit, "G"),
        correction_factor: ingredient.correction_factor || 1,
        cooking_factor: ingredient.cooking_factor || 1,
        base_unit_cost: 0,
        final_cost: 0,
        sort_order: index,
      }));

      const { error: ingredientsError } = await supabaseAdmin
        .from("technical_sheet_ingredients")
        .insert(ingredientsPayload);

      if (ingredientsError) {
        const msg = `Página ${page.pageNumber}: a ficha foi criada, mas os ingredientes falharam (${ingredientsError.message})`;
        errors.push(msg);

        await supabaseAdmin
          .from("import_job_pages")
          .update({
            status: "error",
            technical_sheet_id: createdSheet.id,
            error_message: ingredientsError.message,
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", jobId)
          .eq("page_number", page.pageNumber);

        continue;
      }
    }

    createdRecipes += 1;
    createdPages.push({
      pageNumber: page.pageNumber,
      title: page.parsed.name,
    });

    await supabaseAdmin
      .from("import_job_pages")
      .update({
        status: "created",
        technical_sheet_id: createdSheet.id,
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", jobId)
      .eq("page_number", page.pageNumber);
  }

  await supabaseAdmin
    .from("import_jobs")
    .update({
      status: errors.length ? "review" : "completed",
      total_pages: parsedPages.length,
      detected_recipes: validPages.length,
      created_recipes: createdRecipes,
      errors,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("establishment_id", establishmentId);

  return {
    totalPages: parsedPages.length,
    detectedRecipes: validPages.length,
    createdRecipes,
    errors,
    createdPages,
    ignoredPages,
    pages: parsedPages.map((page) => ({
      pageNumber: page.pageNumber,
      title: page.title,
      classification: page.classification,
      ingredientsCount: page.parsed.ingredients.length,
    })),
  };
}
