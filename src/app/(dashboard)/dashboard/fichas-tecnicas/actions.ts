"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { Buffer } from "node:buffer";

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

export type TechnicalSheetScaleIngredientInput = {
  ingredient_name: string;
  amount: number;
  unit: string;
  sort_order: number;
};

export type TechnicalSheetScaleInput = {
  scale_label: string;
  yield_description: string | null;
  net_weight: number | null;
  sort_order: number;
  ingredients: TechnicalSheetScaleIngredientInput[];
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
  difficulty_level?: string | null;
  temperature_celsius?: number | null;
  cooking_time_minutes?: number | null;
  cooking_factor_grams?: number | null;
  correction_factor_grams?: number | null;
  yield_label?: string | null;
  portion_weight_unit?: string | null;
  storage_instructions?: string | null;
  shelf_life_frozen?: string | null;
  shelf_life_refrigerated?: string | null;
  shelf_life_room_temp?: string | null;
  allergens?: string | null;
  source_updated_at?: string | null;
  import_origin?: string | null;
  source_file_name?: string | null;
  source_page_number?: number | null;
  video_url?: string | null;
  ingredients: TechnicalSheetIngredientInput[];
  scales?: TechnicalSheetScaleInput[];
};

type ImportedRecipe = {
  name: string;
  category: string;
  yield_portions: number;
  portion_weight: number;
  prep_time_minutes: number;
  preparation_method: string;
  difficulty_level: string | null;
  temperature_celsius: number | null;
  cooking_time_minutes: number | null;
  cooking_factor_grams: number | null;
  correction_factor_grams: number | null;
  yield_label: string | null;
  portion_weight_unit: string | null;
  storage_instructions: string | null;
  shelf_life_frozen: string | null;
  shelf_life_refrigerated: string | null;
  shelf_life_room_temp: string | null;
  allergens: string | null;
  source_updated_at: string | null;
  source_file_name: string | null;
  source_page_number: number | null;
  video_url: string | null;
  ingredients: TechnicalSheetIngredientInput[];
  scales: TechnicalSheetScaleInput[];
};

type ParsedIngredientRow = {
  ingredient_name: string;
  usage_unit: string;
  values: number[];
};

type ParsedScaleTable = {
  scaleLabels: string[];
  yieldDescriptions: string[];
  ingredientRows: ParsedIngredientRow[];
  netWeights: number[];
};

type ImportTechnicalSheetsFromPdfResult =
  | {
      ok: true;
      importedCount: number;
      recipes: Array<{ id: string; name: string; page: number | null }>;
    }
  | {
      ok: false;
      error: string;
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

function normalizeUnit(value: string | null | undefined, fallback = "G") {
  const unit = String(value ?? "").trim().toUpperCase();
  return unit || fallback;
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
    "TEMPO COCCAO",
    "TEMPO COCÇÃO",
    "TEMPO COC",
    "FATOR COCÇÃO",
    "FATOR COCCAO",
    "FATOR COC",
    "FATOR CORREÇÃO",
    "FATOR CORRECAO",
    "FATOR CORRE",
    "RENDIMENTO",
    "PESO DA PORÇÃO",
    "PESO DA PORCAO",
    "PESO LÍQUIDO",
    "PESO LIQUIDO",
    "ASSISTA O",
  ];

  return ignoredFragments.some((fragment) => upper.includes(fragment));
}

function isScaleHeaderLine(line: string) {
  const trimmed = line.trim().toUpperCase();
  return /^\d+X(?:\s+\d+X)+$/i.test(trimmed) || /^(?:\d+X)+$/i.test(trimmed);
}

function extractScaleLabels(line: string) {
  return (line.toUpperCase().match(/\d+X/g) ?? []).map((item) => item.trim());
}

function isYieldOnlyLine(line: string) {
  const trimmed = line.trim().toUpperCase();

  if (!trimmed) return false;
  if (/^\d+(?:[.,]\d+)?$/.test(trimmed)) return true;

  if (
    /^(ASSADEIRAS?|PAC(?:OTES?)?|PAC|BSN|BISNAGAS?|BISNAGA)$/i.test(trimmed)
  ) {
    return true;
  }

  return /^(?:\d+(?:[.,]\d+)?\s*(?:ASSADEIRAS?|PAC(?:OTES?)?|PAC|BSN|BISNAGAS?|BISNAGA)\s*)+$/i.test(
    trimmed
  );
}

function inferUsageUnit(name: string) {
  const upper = name.toUpperCase();

  if (
    upper.includes("OVO") &&
    (upper.includes("UNI") ||
      upper.includes("UNID") ||
      upper.includes("(1 UNID"))
  ) {
    return "UN";
  }

  if (
    upper.includes("AGUA") ||
    upper.includes("ÁGUA") ||
    upper.includes("LICOR") ||
    upper.includes("LEITE") ||
    upper.includes("ÓLEO") ||
    upper.includes("OLEO")
  ) {
    return "ML";
  }

  return "G";
}

function splitIngredientRow(line: string) {
  const cleaned = line.replace(/\s+/g, " ").trim();

  const match = cleaned.match(
    /^(.*?)(\d+(?:[.,]\d+)?(?:\s+\d+(?:[.,]\d+)?)+)\s*$/
  );

  if (!match) return null;

  const name = match[1].trim();
  const values = (match[2].match(/\d+(?:[.,]\d+)?/g) ?? []).map((value) =>
    toNumber(value, 0)
  );

  if (!values.length) return null;

  return { name, values };
}

function parseConcatenatedValues(
  line: string,
  scaleLabels: string[]
): number[] | null {
  const digitsOnly = line.replace(/\s+/g, "");
  if (!/^\d+$/.test(digitsOnly) || scaleLabels.length === 0) {
    return null;
  }

  const factors = scaleLabels.map((label) =>
    toNumber(label.replace(/X/gi, ""), 0)
  );

  if (factors.some((factor) => factor <= 0)) {
    return null;
  }

  for (let prefixLength = 1; prefixLength <= digitsOnly.length; prefixLength++) {
    const baseRaw = digitsOnly.slice(0, prefixLength);
    const baseValue = Number(baseRaw);

    if (!Number.isFinite(baseValue) || baseValue <= 0) {
      continue;
    }

    const values = factors.map((factor) => baseValue * factor);
    const rebuilt = values.map((value) => String(value)).join("");

    if (rebuilt === digitsOnly) {
      return values;
    }
  }

  return null;
}

function parseValuesLine(line: string, scaleLabels: string[]) {
  const compactValues = parseConcatenatedValues(line, scaleLabels);
  if (compactValues?.length === scaleLabels.length) {
    return compactValues;
  }

  const numericValues = (line.match(/\d+(?:[.,]\d+)?/g) ?? []).map((value) =>
    toNumber(value, 0)
  );

  if (numericValues.length === scaleLabels.length) {
    return numericValues;
  }

  return null;
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

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
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
    pageText.match(/TEM\s*PO\s*DE\s*PREP[\s\S]{0,50}?(\d{1,4})/i) ||
    pageText.match(/TEMPO\s*DE\s*PREP[\s\S]{0,50}?(\d{1,4})/i) ||
    pageText.match(/(\d{1,3})\s*º\s*(\d{1,4})\s*Minutos/i);

  if (!match) return 0;
  return match[2] ? toNumber(match[2], 0) : toNumber(match[1], 0);
}

function extractCookingTime(pageText: string) {
  const match = pageText.match(/TEM\s*PO\s+COC[ÇC][ÃA]O[\s\S]{0,40}?(\d{1,4})/i);
  return match ? toNumber(match[1], 0) : null;
}

function extractCookingFactor(pageText: string) {
  const match = pageText.match(
    /FATOR\s+COC[ÇC][ÃA]O[\s\S]{0,40}?(\d+(?:[.,]\d+)?)/i
  );
  return match ? toNumber(match[1], 0) : null;
}

function extractCorrectionFactor(pageText: string) {
  const match = pageText.match(
    /FATOR\s+CORRE[ÇC][ÃA]O[\s\S]{0,40}?(\d+(?:[.,]\d+)?)/i
  );
  return match ? toNumber(match[1], 0) : null;
}

function extractDifficulty(pageText: string) {
  const match = pageText.match(/GRAU\s+DE\s+DIFICULDADE:\s*([^\n]+)/i);
  return match?.[1]?.trim() || null;
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

function extractPortionWeightUnit(pageText: string) {
  const matches = [
    ...pageText.matchAll(/(\d+(?:[.,]\d+)?)\s*(GRAMAS|G|KILO|KG)\b/gi),
  ];

  if (!matches.length) return "G";

  const unit = String(matches[matches.length - 1][2] ?? "").toUpperCase();
  return unit === "KILO" || unit === "KG" ? "KG" : "G";
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

function extractYieldLabel(pageText: string) {
  const candidates = [
    pageText.match(/\b\d+\s+Pacotes?\b/i),
    pageText.match(/\b\d+\s+PAC\b/i),
    pageText.match(/\b\d+\s+Bisnaga\b/i),
    pageText.match(/\b\d+\s+BSN\b/i),
    pageText.match(/\b\d+\s+assadeiras?\b/i),
  ].filter(Boolean) as RegExpMatchArray[];

  return candidates[0]?.[0]?.trim() || null;
}

function extractUpdatedDate(pageText: string) {
  const match = pageText.match(/Atualizada em:\s*(\d{2}\/\d{2}\/\d{4})/i);
  return match ? parseBrazilianDateToIso(match[1]) : null;
}

function extractStorage(pageText: string) {
  const match = pageText.match(/Armazenamento:\s*([^\n]+)/i);
  return match ? match[1].trim() : null;
}

function extractShelfLifeFrozen(pageText: string) {
  const match =
    pageText.match(/Congelamento:\s*([^\n]+)/i) ||
    pageText.match(/Congelado\s*:\s*([^\n]+)/i);
  return match ? match[1].trim() : null;
}

function extractShelfLifeRefrigerated(pageText: string) {
  const match = pageText.match(/Sob refrigeração:\s*([^\n]+)/i);
  return match ? match[1].trim() : null;
}

function extractShelfLifeRoomTemp(pageText: string) {
  const match =
    pageText.match(/Temperatura Ambiente:\s*([^\n]+)/i) ||
    pageText.match(/Temp\.\s*Ambiente:\s*([^\n]+)/i);
  return match ? match[1].trim() : null;
}

function extractAllergens(pageText: string) {
  const normalized = normalizeSpaces(pageText);

  if (/N[ÃA]O CONT[ÉE]M/i.test(normalized)) {
    return "NÃO CONTÉM";
  }

  const multilineMatch = normalized.match(
    /Cont[eé]m:\s*([\s\S]*?)(?:Atualizada em:|$)/i
  );

  if (!multilineMatch?.[1]) return null;

  const cleaned = multilineMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.toUpperCase().includes("ALERGÊNICOS") &&
        !line.toUpperCase().includes("ARMAZENAMENTO") &&
        !line.toUpperCase().includes("CONGEL") &&
        !line.toUpperCase().includes("SOB REFRIGERA") &&
        !line.toUpperCase().includes("TEMP. AMBIENTE") &&
        !line.toUpperCase().includes("TEMPERATURA AMBIENTE")
    )
    .join(", ")
    .replace(/\s+,/g, ",")
    .trim();

  return cleaned || null;
}

function extractPreparationMethod(pageText: string) {
  const normalized = normalizeSpaces(pageText);

  const match = normalized.match(
    /Modo de Preparo:\s*([\s\S]*?)(?:Armazenamento:|Atualizada em:|Alerg[eê]nicos|Cont[eé]m:|Ficou com dúvidas|Confeiteiro Chefe)/i
  );

  return match?.[1]?.trim() || "";
}

function extractVideoUrl(pageText: string) {
  const match = pageText.match(/https?:\/\/[^\s]+/i);
  return match?.[0] || null;
}

function parseScaleTable(pageText: string): ParsedScaleTable | null {
  const lines = normalizeSpaces(pageText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const scaleHeaderIndex = lines.findIndex(isScaleHeaderLine);
  if (scaleHeaderIndex < 0) return null;

  const scaleLabels = extractScaleLabels(lines[scaleHeaderIndex]);
  if (!scaleLabels.length) return null;

  const yieldPieces: string[] = [];
  const ingredientRows: ParsedIngredientRow[] = [];
  const nameBuffer: string[] = [];
  let netWeights: number[] = [];

  for (let i = scaleHeaderIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (upper.includes("PESO LÍQUIDO") || upper.includes("PESO LIQUIDO")) {
      netWeights =
        parseValuesLine(line, scaleLabels) ??
        parseValuesLine(lines[i + 1] ?? "", scaleLabels) ??
        [];
      break;
    }

    if (shouldIgnoreLine(line)) continue;
    if (isScaleHeaderLine(line)) continue;

    const valuesOnly = parseValuesLine(line, scaleLabels);

    if (valuesOnly && nameBuffer.length > 0) {
      const ingredientName = nameBuffer.join(" ").replace(/\s+/g, " ").trim();

      nameBuffer.length = 0;

      if (!ingredientName) continue;

      ingredientRows.push({
        ingredient_name: ingredientName,
        usage_unit: inferUsageUnit(ingredientName),
        values: valuesOnly,
      });

      continue;
    }

    if (isYieldOnlyLine(line)) {
      yieldPieces.push(line);
      continue;
    }

    const parsedRow = splitIngredientRow(line);

    if (parsedRow) {
      const ingredientName = [nameBuffer.join(" "), parsedRow.name]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      nameBuffer.length = 0;

      if (!ingredientName) continue;

      ingredientRows.push({
        ingredient_name: ingredientName,
        usage_unit: inferUsageUnit(ingredientName),
        values: parsedRow.values,
      });

      continue;
    }

    if (/^[A-Za-zÀ-ÿ().\-\/ ]+$/.test(line) || /[A-Za-zÀ-ÿ]/.test(line)) {
      nameBuffer.push(line);
    }
  }

  const joinedYieldText = yieldPieces.join(" ");
  const yieldDescriptions = [
    ...joinedYieldText.matchAll(
      /(\d+(?:[.,]\d+)?)\s*(ASSADEIRAS?|PAC(?:OTES?)?|PAC|BSN|BISNAGAS?|BISNAGA)/gi
    ),
  ].map((match) => `${match[1]} ${match[2]}`.replace(/\s+/g, " ").trim());

  return {
    scaleLabels,
    yieldDescriptions,
    ingredientRows,
    netWeights,
  };
}

function extractIngredients(pageText: string): TechnicalSheetIngredientInput[] {
  const table = parseScaleTable(pageText);
  if (!table) return [];

  return table.ingredientRows.map((row, index) => ({
    product_id: null,
    ingredient_name: row.ingredient_name,
    usage_quantity: row.values[0] ?? 0,
    usage_unit: row.usage_unit,
    purchase_price: 0,
    purchase_quantity: 1,
    purchase_unit: row.usage_unit,
    correction_factor: 1,
    cooking_factor: 1,
    base_unit_cost: 0,
    final_cost: 0,
    sort_order: index,
  }));
}

function extractScales(pageText: string): TechnicalSheetScaleInput[] {
  const table = parseScaleTable(pageText);
  if (!table) return [];

  return table.scaleLabels.map((scaleLabel, scaleIndex) => ({
    scale_label: scaleLabel,
    yield_description:
      table.yieldDescriptions[scaleIndex] ??
      table.yieldDescriptions[0] ??
      null,
    net_weight: table.netWeights[scaleIndex] ?? null,
    sort_order: scaleIndex,
    ingredients: table.ingredientRows.map((row, ingredientIndex) => ({
      ingredient_name: row.ingredient_name,
      amount: row.values[scaleIndex] ?? 0,
      unit: normalizeUnit(row.usage_unit, "G"),
      sort_order: ingredientIndex,
    })),
  }));
}

function getFallbackYieldFromScales(scales: TechnicalSheetScaleInput[]) {
  const firstYield = scales[0]?.yield_description ?? null;

  if (!firstYield) {
    return {
      yieldPortions: 1,
      yieldLabel: null as string | null,
    };
  }

  const amountMatch = firstYield.match(/\d+(?:[.,]\d+)?/);

  return {
    yieldPortions: amountMatch ? Math.max(1, toNumber(amountMatch[0], 1)) : 1,
    yieldLabel: firstYield,
  };
}

async function extractRawPdfText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  let pdfParse: any;

  try {
    const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
    pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
  } catch (error) {
    console.error("[importPDF] erro ao carregar pdf-parse", error);
    throw new Error(
      'A dependência "pdf-parse" não foi encontrada corretamente. Rode: npm install pdf-parse@1.1.1'
    );
  }

  if (typeof pdfParse !== "function") {
    throw new Error(
      'A versão instalada de "pdf-parse" não é compatível. Rode: npm install pdf-parse@1.1.1'
    );
  }

  const parsed = await pdfParse(buffer);
  const rawText = normalizeSpaces(parsed?.text ?? "");

  if (!rawText) {
    throw new Error("Não foi possível extrair texto do PDF.");
  }

  return rawText;
}

function splitPdfIntoRecipes(rawText: string) {
  const normalized = normalizeSpaces(rawText);

  const pages = [
    ...normalized.matchAll(/[\s\S]*?Atualizada em:\s*\d{2}\/\d{2}\/\d{4}/gi),
  ]
    .map((match) => normalizeSpaces(match[0]))
    .filter(Boolean);

  if (pages.length > 0) {
    return pages;
  }

  return [normalized];
}

async function extractPdfPagesText(file: File) {
  const rawText = await extractRawPdfText(file);
  return splitPdfIntoRecipes(rawText);
}

function parsePdfPageToRecipe(
  pageText: string,
  pageNumber: number,
  fileName: string,
  defaultCategory: string
): ImportedRecipe | null {
  const name = extractTitle(pageText);
  const preparationMethod = extractPreparationMethod(pageText);
  const scales = extractScales(pageText);
  const ingredients = extractIngredients(pageText);
  const fallbackYield = getFallbackYieldFromScales(scales);

  if (!name || !ingredients.length) {
    return null;
  }

  return {
    name,
    category: defaultCategory || "Importado PDF",
    yield_portions: extractYieldPortions(pageText) || fallbackYield.yieldPortions,
    portion_weight: extractPortionWeight(pageText),
    prep_time_minutes: extractPrepTime(pageText),
    preparation_method: preparationMethod,
    difficulty_level: extractDifficulty(pageText),
    temperature_celsius: extractTemperature(pageText),
    cooking_time_minutes: extractCookingTime(pageText),
    cooking_factor_grams: extractCookingFactor(pageText),
    correction_factor_grams: extractCorrectionFactor(pageText),
    yield_label: extractYieldLabel(pageText) || fallbackYield.yieldLabel,
    portion_weight_unit: extractPortionWeightUnit(pageText),
    storage_instructions: extractStorage(pageText),
    shelf_life_frozen: extractShelfLifeFrozen(pageText),
    shelf_life_refrigerated: extractShelfLifeRefrigerated(pageText),
    shelf_life_room_temp: extractShelfLifeRoomTemp(pageText),
    allergens: extractAllergens(pageText),
    source_updated_at: extractUpdatedDate(pageText),
    source_file_name: fileName,
    source_page_number: pageNumber,
    video_url: extractVideoUrl(pageText),
    ingredients,
    scales,
  };
}

async function saveScales(
  supabase: any,
  technicalSheetId: string,
  scales: TechnicalSheetScaleInput[] | undefined
) {
  if (!scales?.length) return;

  for (const scale of scales) {
    const { data: createdScale, error: scaleError } = await supabase
      .from("technical_sheet_scales")
      .insert({
        technical_sheet_id: technicalSheetId,
        scale_label: scale.scale_label,
        yield_description: scale.yield_description,
        net_weight: scale.net_weight,
        sort_order: scale.sort_order,
      })
      .select("id")
      .single();

    if (scaleError || !createdScale) {
      console.error("Erro ao salvar escala da ficha:", scaleError);
      throw new Error("Não foi possível salvar as escalas da ficha técnica.");
    }

    if (scale.ingredients?.length) {
      const payload = scale.ingredients.map((item, index) => ({
        technical_sheet_scale_id: createdScale.id,
        ingredient_name: item.ingredient_name.trim(),
        amount: item.amount,
        unit: normalizeUnit(item.unit, "G"),
        sort_order: item.sort_order ?? index,
      }));

      const { error: scaleIngredientsError } = await supabase
        .from("technical_sheet_scale_ingredients")
        .insert(payload);

      if (scaleIngredientsError) {
        console.error(
          "Erro ao salvar ingredientes da escala:",
          scaleIngredientsError
        );
        throw new Error("Não foi possível salvar os ingredientes das escalas.");
      }
    }
  }
}

async function duplicateTechnicalSheetImage(
  supabase: any,
  sourceImagePath: string | null | undefined,
  establishmentId: string,
  userId: string
) {
  if (!sourceImagePath?.trim()) {
    return {
      imageUrl: null as string | null,
      imagePath: null as string | null,
    };
  }

  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(TECHNICAL_SHEET_BUCKET)
      .download(sourceImagePath);

    if (downloadError || !fileData) {
      console.error("Erro ao baixar imagem para duplicação:", downloadError);
      return {
        imageUrl: null,
        imagePath: null,
      };
    }

    const originalFileName =
      sourceImagePath.split("/").pop() || `imagem-${Date.now()}.jpg`;

    const duplicatedPath = `${establishmentId}/${userId}/${Date.now()}-copy-${sanitizeFileName(
      originalFileName
    )}`;

    const { error: uploadError } = await supabase.storage
      .from(TECHNICAL_SHEET_BUCKET)
      .upload(duplicatedPath, fileData, {
        cacheControl: "3600",
        upsert: false,
        contentType: fileData.type || "image/jpeg",
      });

    if (uploadError) {
      console.error("Erro ao subir imagem duplicada da ficha:", uploadError);
      return {
        imageUrl: null,
        imagePath: null,
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from(TECHNICAL_SHEET_BUCKET)
      .getPublicUrl(duplicatedPath);

    return {
      imageUrl: publicUrlData.publicUrl,
      imagePath: duplicatedPath,
    };
  } catch (error) {
    console.error("Erro inesperado ao duplicar imagem da ficha:", error);
    return {
      imageUrl: null,
      imagePath: null,
    };
  }
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
  const filePath = `${establishmentId}/${userId}/${Date.now()}-${
    safeName || `imagem.${extension}`
  }`;

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
      difficulty_level,
      temperature_celsius,
      cooking_time_minutes,
      cooking_factor_grams,
      correction_factor_grams,
      yield_label,
      portion_weight_unit,
      storage_instructions,
      shelf_life_frozen,
      shelf_life_refrigerated,
      shelf_life_room_temp,
      allergens,
      source_updated_at,
      import_origin,
      source_file_name,
      source_page_number,
      video_url,
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
      ),
      scales:technical_sheet_scales (
        id,
        technical_sheet_id,
        scale_label,
        yield_description,
        net_weight,
        sort_order,
        created_at,
        ingredients:technical_sheet_scale_ingredients (
          id,
          technical_sheet_scale_id,
          ingredient_name,
          amount,
          unit,
          sort_order,
          created_at
        )
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
      difficulty_level: input.difficulty_level?.trim() || null,
      temperature_celsius: input.temperature_celsius ?? null,
      cooking_time_minutes: input.cooking_time_minutes ?? null,
      cooking_factor_grams: input.cooking_factor_grams ?? null,
      correction_factor_grams: input.correction_factor_grams ?? null,
      yield_label: input.yield_label?.trim() || null,
      portion_weight_unit: normalizeUnit(input.portion_weight_unit, "G"),
      storage_instructions: input.storage_instructions?.trim() || null,
      shelf_life_frozen: input.shelf_life_frozen?.trim() || null,
      shelf_life_refrigerated: input.shelf_life_refrigerated?.trim() || null,
      shelf_life_room_temp: input.shelf_life_room_temp?.trim() || null,
      allergens: input.allergens?.trim() || null,
      source_updated_at: input.source_updated_at || null,
      import_origin: input.import_origin?.trim() || null,
      source_file_name: input.source_file_name?.trim() || null,
      source_page_number: input.source_page_number ?? null,
      video_url: input.video_url?.trim() || null,
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
    usage_unit: normalizeUnit(ingredient.usage_unit, "G"),
    purchase_price: ingredient.purchase_price,
    purchase_quantity: ingredient.purchase_quantity,
    purchase_unit: normalizeUnit(ingredient.purchase_unit, "G"),
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

  await saveScales(supabase, sheet.id, input.scales);

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
      difficulty_level: input.difficulty_level?.trim() || null,
      temperature_celsius: input.temperature_celsius ?? null,
      cooking_time_minutes: input.cooking_time_minutes ?? null,
      cooking_factor_grams: input.cooking_factor_grams ?? null,
      correction_factor_grams: input.correction_factor_grams ?? null,
      yield_label: input.yield_label?.trim() || null,
      portion_weight_unit: normalizeUnit(input.portion_weight_unit, "G"),
      storage_instructions: input.storage_instructions?.trim() || null,
      shelf_life_frozen: input.shelf_life_frozen?.trim() || null,
      shelf_life_refrigerated: input.shelf_life_refrigerated?.trim() || null,
      shelf_life_room_temp: input.shelf_life_room_temp?.trim() || null,
      allergens: input.allergens?.trim() || null,
      source_updated_at: input.source_updated_at || null,
      import_origin: input.import_origin?.trim() || null,
      source_file_name: input.source_file_name?.trim() || null,
      source_page_number: input.source_page_number ?? null,
      video_url: input.video_url?.trim() || null,
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
    console.error(
      "Erro ao limpar ingredientes antigos:",
      deleteIngredientsError
    );
    throw new Error("Não foi possível atualizar os ingredientes da ficha.");
  }

  const ingredientsPayload = input.ingredients.map((ingredient, index) => ({
    technical_sheet_id: input.id,
    product_id: ingredient.product_id || null,
    ingredient_name: ingredient.ingredient_name.trim(),
    usage_quantity: ingredient.usage_quantity,
    usage_unit: normalizeUnit(ingredient.usage_unit, "G"),
    purchase_price: ingredient.purchase_price,
    purchase_quantity: ingredient.purchase_quantity,
    purchase_unit: normalizeUnit(ingredient.purchase_unit, "G"),
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
    console.error(
      "Erro ao recriar ingredientes da ficha:",
      insertIngredientsError
    );
    throw new Error(
      "A ficha foi atualizada, mas houve erro ao salvar os ingredientes."
    );
  }

  const { data: existingScales } = await supabase
    .from("technical_sheet_scales")
    .select("id")
    .eq("technical_sheet_id", input.id);

  if (existingScales?.length) {
    const scaleIds = existingScales.map((s: any) => s.id);

    await supabase
      .from("technical_sheet_scale_ingredients")
      .delete()
      .in("technical_sheet_scale_id", scaleIds);

    await supabase
      .from("technical_sheet_scales")
      .delete()
      .eq("technical_sheet_id", input.id);
  }

  await saveScales(supabase, input.id, input.scales);

  revalidatePath("/dashboard/fichas-tecnicas");
}

export async function duplicateTechnicalSheetAction(technicalSheetId: string) {
  const { supabase, establishmentId, userId } = await getContext();

  if (!technicalSheetId) {
    throw new Error("ID da ficha não informado.");
  }

  const { data: source, error: sourceError } = await supabase
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
      difficulty_level,
      temperature_celsius,
      cooking_time_minutes,
      cooking_factor_grams,
      correction_factor_grams,
      yield_label,
      portion_weight_unit,
      storage_instructions,
      shelf_life_frozen,
      shelf_life_refrigerated,
      shelf_life_room_temp,
      allergens,
      source_updated_at,
      import_origin,
      source_file_name,
      source_page_number,
      video_url,
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
      ),
      scales:technical_sheet_scales (
        id,
        technical_sheet_id,
        scale_label,
        yield_description,
        net_weight,
        sort_order,
        created_at,
        ingredients:technical_sheet_scale_ingredients (
          id,
          technical_sheet_scale_id,
          ingredient_name,
          amount,
          unit,
          sort_order,
          created_at
        )
      )
    `)
    .eq("id", technicalSheetId)
    .eq("establishment_id", establishmentId)
    .single();

  if (sourceError || !source) {
    console.error("Erro ao buscar ficha para duplicação:", sourceError);
    throw new Error("Ficha técnica não encontrada para duplicação.");
  }

  const duplicatedImage = await duplicateTechnicalSheetImage(
    supabase,
    (source as any).image_path as string | null,
    establishmentId,
    userId
  );

  const duplicatedName = `${String((source as any).name ?? "Ficha técnica").trim()} - Cópia`;

  const { data: createdSheet, error: createdSheetError } = await supabase
    .from("technical_sheets")
    .insert({
      establishment_id: establishmentId,
      name: duplicatedName,
      category: (source as any).category,
      yield_portions: (source as any).yield_portions,
      portion_weight: (source as any).portion_weight,
      prep_time_minutes: (source as any).prep_time_minutes,
      profit_margin_percent: (source as any).profit_margin_percent,
      sale_price: (source as any).sale_price,
      total_cost: (source as any).total_cost,
      cost_per_portion: (source as any).cost_per_portion,
      preparation_method: (source as any).preparation_method,
      image_url: duplicatedImage.imageUrl,
      image_path: duplicatedImage.imagePath,
      difficulty_level: (source as any).difficulty_level,
      temperature_celsius: (source as any).temperature_celsius,
      cooking_time_minutes: (source as any).cooking_time_minutes,
      cooking_factor_grams: (source as any).cooking_factor_grams,
      correction_factor_grams: (source as any).correction_factor_grams,
      yield_label: (source as any).yield_label,
      portion_weight_unit: normalizeUnit((source as any).portion_weight_unit, "G"),
      storage_instructions: (source as any).storage_instructions,
      shelf_life_frozen: (source as any).shelf_life_frozen,
      shelf_life_refrigerated: (source as any).shelf_life_refrigerated,
      shelf_life_room_temp: (source as any).shelf_life_room_temp,
      allergens: (source as any).allergens,
      source_updated_at: (source as any).source_updated_at,
      import_origin: (source as any).import_origin,
      source_file_name: (source as any).source_file_name,
      source_page_number: (source as any).source_page_number,
      video_url: (source as any).video_url,
      created_by: userId,
    })
    .select("id, name")
    .single();

  if (createdSheetError || !createdSheet) {
    console.error("Erro ao criar ficha duplicada:", createdSheetError);
    throw new Error("Não foi possível duplicar a ficha técnica.");
  }

  const sourceIngredients = Array.isArray((source as any).ingredients)
    ? [...((source as any).ingredients as any[])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      )
    : [];

  if (sourceIngredients.length > 0) {
    const ingredientsPayload = sourceIngredients.map((ingredient, index) => ({
      technical_sheet_id: createdSheet.id,
      product_id: ingredient.product_id || null,
      ingredient_name: String(ingredient.ingredient_name ?? "").trim(),
      usage_quantity: ingredient.usage_quantity,
      usage_unit: normalizeUnit(ingredient.usage_unit, "G"),
      purchase_price: ingredient.purchase_price,
      purchase_quantity: ingredient.purchase_quantity,
      purchase_unit: normalizeUnit(ingredient.purchase_unit, "G"),
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
        "Erro ao duplicar ingredientes da ficha técnica:",
        ingredientsError
      );
      throw new Error(
        "A ficha foi duplicada, mas houve erro ao copiar os ingredientes."
      );
    }
  }

  const sourceScales = Array.isArray((source as any).scales)
    ? [...((source as any).scales as any[])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      )
    : [];

  const scalesPayload: TechnicalSheetScaleInput[] = sourceScales.map(
    (scale: any, scaleIndex: number) => ({
      scale_label: String(scale.scale_label ?? "").trim(),
      yield_description: scale.yield_description ?? null,
      net_weight:
        scale.net_weight !== null && scale.net_weight !== undefined
          ? Number(scale.net_weight)
          : null,
      sort_order: scale.sort_order ?? scaleIndex,
      ingredients: Array.isArray(scale.ingredients)
        ? [...scale.ingredients]
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((item: any, itemIndex: number) => ({
              ingredient_name: String(item.ingredient_name ?? "").trim(),
              amount: Number(item.amount ?? 0),
              unit: normalizeUnit(item.unit, "G"),
              sort_order: item.sort_order ?? itemIndex,
            }))
        : [],
    })
  );

  await saveScales(supabase, createdSheet.id, scalesPayload);

  revalidatePath("/dashboard/fichas-tecnicas");
  return createdSheet;
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

export async function importTechnicalSheetsFromPdfAction(
  formData: FormData
): Promise<ImportTechnicalSheetsFromPdfResult> {
  const { supabase, establishmentId, userId } = await getContext();

  try {
    const fileEntry = formData.get("file");
    const categoryEntry = formData.get("defaultCategory");

    if (!(fileEntry instanceof File)) {
      return {
        ok: false,
        error: "Envie um arquivo PDF.",
      };
    }

    const file = fileEntry;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return {
        ok: false,
        error: "O arquivo enviado precisa ser um PDF.",
      };
    }

    const maxPdfSizeInBytes = 8 * 1024 * 1024;
    if (file.size > maxPdfSizeInBytes) {
      return {
        ok: false,
        error: "O PDF deve ter no máximo 8MB.",
      };
    }

    const defaultCategory =
      String(categoryEntry ?? "Importado PDF").trim() || "Importado PDF";

    console.log("[importPDF] iniciando", {
      fileName: file.name,
      size: file.size,
      type: file.type,
      establishmentId,
      userId,
    });

    const pages = await extractPdfPagesText(file);

    console.log("[importPDF] blocos encontrados", {
      total: pages.length,
    });

    const parsedPages = pages.map((pageText, index) => {
      const recipe = parsePdfPageToRecipe(
        pageText,
        index + 1,
        file.name,
        defaultCategory
      );

      console.log("[importPDF] análise do bloco", {
        page: index + 1,
        recipeName: recipe?.name ?? null,
        ingredientsCount: recipe?.ingredients?.length ?? 0,
        scalesCount: recipe?.scales?.length ?? 0,
      });

      return recipe;
    });

    const recipes = parsedPages.filter(Boolean) as ImportedRecipe[];

    if (!recipes.length) {
      return {
        ok: false,
        error:
          "Não foi possível identificar receitas válidas no PDF. Verifique se o arquivo segue o layout esperado da ficha técnica.",
      };
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
          difficulty_level: recipe.difficulty_level,
          temperature_celsius: recipe.temperature_celsius,
          cooking_time_minutes: recipe.cooking_time_minutes,
          cooking_factor_grams: recipe.cooking_factor_grams,
          correction_factor_grams: recipe.correction_factor_grams,
          yield_label: recipe.yield_label,
          portion_weight_unit: normalizeUnit(recipe.portion_weight_unit, "G"),
          storage_instructions: recipe.storage_instructions,
          shelf_life_frozen: recipe.shelf_life_frozen,
          shelf_life_refrigerated: recipe.shelf_life_refrigerated,
          shelf_life_room_temp: recipe.shelf_life_room_temp,
          allergens: recipe.allergens,
          source_updated_at: recipe.source_updated_at,
          import_origin: "pdf_canva",
          source_file_name: recipe.source_file_name,
          source_page_number: recipe.source_page_number,
          video_url: recipe.video_url,
          created_by: userId,
        })
        .select("id, name")
        .single();

      if (sheetError || !sheet) {
        console.error("[importPDF] erro ao criar ficha", sheetError, recipe);
        return {
          ok: false,
          error: `Falha ao criar a ficha "${recipe.name}".`,
        };
      }

      if (recipe.ingredients.length) {
        const payload = recipe.ingredients.map((ingredient, index) => ({
          technical_sheet_id: sheet.id,
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

        const { error: ingredientsError } = await supabase
          .from("technical_sheet_ingredients")
          .insert(payload);

        if (ingredientsError) {
          console.error(
            "[importPDF] erro ao criar ingredientes",
            ingredientsError
          );
          return {
            ok: false,
            error: `A ficha "${recipe.name}" foi criada, mas os ingredientes não foram salvos.`,
          };
        }
      }

      await saveScales(supabase, sheet.id, recipe.scales);

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
  } catch (error: any) {
    console.error("[importPDF] falha geral", error);
    return {
      ok: false,
      error: error?.message || "Erro ao importar PDF.",
    };
  }
}