"use server";

import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
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
      ignoredPages: Array<{ page: number; title: string; reason: string }>;
    }
  | {
      ok: false;
      error: string;
    };

async function getContext() {
  const supabaseAuth = await createSupabaseServerClient();
  const supabase = createSupabaseAdminClient();
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
  } = await supabaseAuth.auth.getUser();

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
  const normalized = String(value ?? "")
    .trim()
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const n = Number(normalized);
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
    pageText.match(/\b(\d+)\s+Taças?\b/i),
    pageText.match(/\b(\d+)\s+Porções?\b/i),
    pageText.match(/\b(\d+)\s+Unidades?\b/i),
    pageText.match(/\b(\d+)\s+Pratos?\b/i),
    pageText.match(/\b(\d+)\s+Bolos?\b/i),
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
    pageText.match(/\b\d+\s+Taças?\b/i),
    pageText.match(/\b\d+\s+Porções?\b/i),
    pageText.match(/\b\d+\s+Unidades?\b/i),
    pageText.match(/\b\d+\s+Pratos?\b/i),
    pageText.match(/\b\d+\s+Bolos?\b/i),
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

  if (match?.[1]?.trim()) {
    return match[1].trim();
  }

  const fallbackMatch = normalized.match(
    /Modo de preparo\s*([\s\S]*?)(?:Escalas|Atualizado em|Origem Cadastro|Arquivo de origem|Vídeo|Imagem|$)/i
  );

  return fallbackMatch?.[1]?.trim() || "";
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
      /(\d+(?:[.,]\d+)?)\s*(ASSADEIRAS?|PAC(?:OTES?)?|PAC|BSN|BISNAGAS?|BISNAGA|TAÇAS?|TAÇA|BOLOS?|BOLO|UNIDADES?|UNIDADE|PORÇÕES?|PORÇÃO|PRATOS?|PRATO)/gi
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
        scale_id: createdScale.id,
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
      name,
      category,
      yield_portions,
      portion_weight,
      prep_time_minutes,
      total_cost,
      cost_per_portion,
      profit_margin_percent,
      sale_price,
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
        base_unit_cost,
        final_cost,
        correction_factor,
        cooking_factor,
        sort_order
      ),
      scales:technical_sheet_scales (
        id,
        technical_sheet_id,
        scale_label,
        yield_description,
        net_weight,
        sort_order,
        ingredients:technical_sheet_scale_ingredients!technical_sheet_scale_ingredients_scale_id_fkey (
          id,
          scale_id,
          ingredient_name,
          amount,
          unit,
          sort_order
        )
      )
    `)
    .eq("establishment_id", establishmentId)
    .order("name", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar fichas técnicas:", JSON.stringify(error, null, 2));
    throw new Error(`Não foi possível carregar as fichas técnicas: ${error.message}`);
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
      .in("scale_id", scaleIds);

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
          scale_id,
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

function normalizePdfTextKeepingPagesRobust(value: string) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getCleanLinesRobust(value: string) {
  return normalizePdfTextKeepingPagesRobust(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function sanitizeTitleRobust(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/^Ingredientes\s*:?\s*/i, "")
    .replace(/^Modo de Preparo\s*:?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadPdfParseModuleRobust() {
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

  return pdfParse;
}

function isLikelyTitleLineRobust(value: string | null | undefined) {
  const line = sanitizeTitleRobust(value);
  const upper = line.toUpperCase();

  if (!line) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(line)) return false;
  if (/^\d/.test(line)) return false;
  if (line.length > 60) return false;
  if (/[.!?:;]$/.test(line)) return false;

  const blockedFragments = [
    "INGREDIENTES",
    "MODO DE PREPARO",
    "ATUALIZADA EM",
    "CONTÉM",
    "CONTEM",
    "ALERGÊNICOS",
    "ALERGENICOS",
    "ARMAZENAMENTO",
    "CONGELAMENTO",
    "CONGELADO",
    "SOB REFRIGERAÇÃO",
    "SOB REFRIGERACAO",
    "TEMP. AMBIENTE",
    "TEMPERATURA AMBIENTE",
    "CONFEITEIRO CHEFE",
    "FICOU COM DÚVIDAS",
    "FICOU COM DUVIDAS",
    "ENTRE EM CONTATO",
    "ASSISTA O",
    "TEMPO DE PREP",
    "TEMPO COC",
    "FATOR",
    "RENDIMENTO",
    "PESO DA PORÇÃO",
    "PESO DA PORCAO",
    "PESO LÍQUIDO",
    "PESO LIQUIDO",
    "TEMPERATURA",
    "GRAU DE",
    "DIFICULDADE",
    "GRAMAS",
    "KILO",
    "PACOTE",
    "PACOTES",
    "BISNAGA",
    "BISNAGAS",
    "UNIDADE",
    "UNIDADES",
    "GRAUS",
    "GLÚTEN",
    "GLUTEN",
    "LACTOSE",
    "OVOS",
    "AÇÚCAR",
    "ACUCAR",
    "CASTANHAS",
    "IVAN",
    "ESCOBAR",
  ];

  return !blockedFragments.some((fragment) => upper.includes(fragment));
}

async function renderPdfPageTextRobust(pageData: any) {
  const textContent = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  });

  let lastY: number | null = null;
  let text = "";

  for (const item of textContent.items ?? []) {
    const value = typeof item?.str === "string" ? item.str : "";
    const y = typeof item?.transform?.[5] === "number" ? item.transform[5] : null;

    if (lastY === null || y === lastY) {
      text += value;
    } else {
      text += `\n${value}`;
    }

    lastY = y;
  }

  return text;
}

async function extractRawPdfTextRobust(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const pdfParse = await loadPdfParseModuleRobust();
  const parsed = await pdfParse(buffer);
  const rawText = String(parsed?.text ?? "");

  if (!rawText.trim()) {
    throw new Error("Não foi possível extrair texto do PDF.");
  }

  return rawText;
}

function splitPdfIntoPagesRobust(rawText: string) {
  const normalized = normalizePdfTextKeepingPagesRobust(rawText);

  const formFeedPages = rawText
    .split(/\f+/)
    .map((item) => normalizePdfTextKeepingPagesRobust(item))
    .filter(Boolean);

  if (formFeedPages.length > 1) {
    return formFeedPages;
  }

  const updateMatches = [
    ...normalized.matchAll(/Atualizada em:\s*\d{2}\/\d{2}\/\d{4}/gi),
  ];

  if (updateMatches.length > 1) {
    const pages: string[] = [];
    let start = 0;

    for (let i = 0; i < updateMatches.length; i++) {
      const nextIndex =
        i + 1 < updateMatches.length
          ? updateMatches[i + 1].index ?? normalized.length
          : normalized.length;

      const chunk = normalized.slice(start, nextIndex).trim();
      if (chunk) pages.push(chunk);
      start = nextIndex;
    }

    if (pages.length) return pages;
  }

  return [normalized];
}

async function extractPdfPagesTextRobust(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const pdfParse = await loadPdfParseModuleRobust();
  const pages: string[] = [];

  const parsed = await pdfParse(buffer, {
    pagerender: async (pageData: any) => {
      const rawPageText = await renderPdfPageTextRobust(pageData);
      const normalizedPageText = normalizePdfTextKeepingPagesRobust(rawPageText);

      if (normalizedPageText) {
        pages.push(normalizedPageText);
      }

      return rawPageText;
    },
  });

  if (pages.length > 0) {
    return pages;
  }

  const fallbackRawText = String(parsed?.text ?? "");
  const fallbackPages = splitPdfIntoPagesRobust(fallbackRawText);

  if (!fallbackPages.length) {
    throw new Error("Não foi possível separar as páginas do PDF.");
  }

  return fallbackPages;
}

function extractTitleRobust(pageText: string) {
  const lines = getCleanLinesRobust(pageText);

  const firstLineCandidate = sanitizeTitleRobust(lines[0] ?? "");
  if (isLikelyTitleLineRobust(firstLineCandidate)) {
    return firstLineCandidate;
  }

  const ingredientIndex = lines.findIndex((line) => /^Ingredientes\s*:?\s*$/i.test(line));

  if (ingredientIndex > 0) {
    for (let i = ingredientIndex - 1; i >= Math.max(0, ingredientIndex - 4); i--) {
      const candidate = sanitizeTitleRobust(lines[i]);
      if (isLikelyTitleLineRobust(candidate)) {
        return candidate;
      }
    }
  }

  const candidateFromBottom = [...lines].reverse().find((line) => {
    return isLikelyTitleLineRobust(line);
  });

  if (candidateFromBottom) {
    return sanitizeTitleRobust(candidateFromBottom);
  }

  const updatedAtIndex = lines.findIndex((line) => /Atualizada em:/i.test(line));

  if (updatedAtIndex > 0) {
    for (let i = updatedAtIndex - 1; i >= Math.max(0, updatedAtIndex - 20); i--) {
      const candidate = sanitizeTitleRobust(lines[i]);
      if (isLikelyTitleLineRobust(candidate)) {
        return candidate;
      }
    }
  }

  const topCandidate = lines.find((line) => isLikelyTitleLineRobust(line));
  if (topCandidate) {
    return sanitizeTitleRobust(topCandidate);
  }

  return "Receita importada";
}

function extractAppExportTitleRobust(pageText: string) {
  const lines = getCleanLinesRobust(pageText);
  const firstLine = lines[0] ?? "";
  return sanitizeTitleRobust(firstLine);
}

function extractAppExportCategoryRobust(pageText: string, fallback: string) {
  const lines = getCleanLinesRobust(pageText);
  const secondLine = lines[1] ?? "";
  const firstChunk = secondLine.split("•")[0]?.trim();
  return firstChunk || fallback;
}

function parseAppExportIngredientsRobust(
  pageText: string
): TechnicalSheetIngredientInput[] {
  const normalized = normalizePdfTextKeepingPagesRobust(pageText);
  const match = normalized.match(/Ingredientes\s*([\s\S]*?)Modo de preparo/i);

  if (!match?.[1]) return [];

  const lines = getCleanLinesRobust(match[1]).filter(
    (line) =>
      !/^Ingrediente\s+/i.test(line) &&
      !/^Uso ajustado\s+/i.test(line) &&
      !/^Compra\s+/i.test(line) &&
      !/^Preço compra/i.test(line) &&
      !/^Custo/i.test(line)
  );

  const result: TechnicalSheetIngredientInput[] = [];

  for (const line of lines) {
    const rowMatch = line.match(
      /^(.*)(\d+(?:[.,]\d+)?)\s*(KG|G|ML|L|UN)\s*(\d+(?:[.,]\d+)?)\s*(KG|G|ML|L|UN)\s*R\$\s*([\d.,]+)\s*R\$\s*([\d.,]+)\s*R\$\s*([\d.,]+)$/i
    );

    if (!rowMatch) continue;

    const ingredientName = rowMatch[1].trim();
    const usageQuantity = toNumber(rowMatch[2], 0);
    const usageUnit = normalizeUnit(rowMatch[3], "G");
    const purchaseQuantity = toNumber(rowMatch[4], 1);
    const purchaseUnit = normalizeUnit(rowMatch[5], "G");
    const purchasePrice = toNumber(
      rowMatch[6].replace(/\./g, "").replace(",", "."),
      0
    );
    const baseUnitCost = toNumber(
      rowMatch[7].replace(/\./g, "").replace(",", "."),
      0
    );
    const finalCost = toNumber(
      rowMatch[8].replace(/\./g, "").replace(",", "."),
      0
    );

    if (!ingredientName || usageQuantity <= 0) continue;

    result.push({
      product_id: null,
      ingredient_name: ingredientName,
      usage_quantity: usageQuantity,
      usage_unit: usageUnit,
      purchase_price: purchasePrice,
      purchase_quantity: purchaseQuantity,
      purchase_unit: purchaseUnit,
      correction_factor: 1,
      cooking_factor: 1,
      base_unit_cost: baseUnitCost,
      final_cost: finalCost,
      sort_order: result.length,
    });
  }

  return result;
}

function parseCanvaYieldLabelRobust(pageText: string) {
  const candidates = [
    ...pageText.matchAll(
      /\b\d+(?:[.,]\d+)?\s*(ASSADEIRAS?|PAC(?:OTES?)?|PAC|BSN|BISNAGAS?|BISNAGA|TAÇAS?|TAÇA|BOLOS?|BOLO|UNIDADES?|UNIDADE|PORÇÕES?|PORÇÃO|PRATOS?|PRATO)\b/gi
    ),
  ].map((match) => match[0].replace(/\s+/g, " ").trim());

  return candidates[0] || null;
}

function parseCanvaYieldPortionsRobust(pageText: string) {
  const label = parseCanvaYieldLabelRobust(pageText);
  if (!label) return 1;

  const value = label.match(/\d+(?:[.,]\d+)?/);
  return value ? Math.max(1, toNumber(value[0], 1)) : 1;
}

function parseIngredientLineBaseQuantityRobust(
  line: string
): { ingredientName: string; quantity: number; unit: string } | null {
  const cleaned = line.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const regex = /^(.*?)\s+(\d+(?:[.,]\d+)?)(?:\s+(\d+(?:[.,]\d+)?))*\s*$/;
  const match = cleaned.match(regex);
  if (!match) return null;

  const ingredientName = match[1].trim();
  const quantity = toNumber(match[2], 0);

  if (!ingredientName || quantity <= 0) return null;

  return {
    ingredientName,
    quantity,
    unit: inferUsageUnit(ingredientName),
  };
}

function canSegmentDigitsIntoCountRobust(
  digits: string,
  count: number,
  memo = new Map<string, boolean>()
) {
  const key = `${digits}|${count}`;
  const cached = memo.get(key);

  if (cached !== undefined) {
    return cached;
  }

  if (count === 0) {
    const result = digits.length === 0;
    memo.set(key, result);
    return result;
  }

  if (!digits.length) {
    memo.set(key, false);
    return false;
  }

  if (digits.length < count || digits.length > count * 4) {
    memo.set(key, false);
    return false;
  }

  for (let chunkLength = 1; chunkLength <= Math.min(4, digits.length); chunkLength++) {
    const chunk = digits.slice(0, chunkLength);

    if (chunk.length > 1 && chunk.startsWith("0")) {
      continue;
    }

    if (canSegmentDigitsIntoCountRobust(digits.slice(chunkLength), count - 1, memo)) {
      memo.set(key, true);
      return true;
    }
  }

  memo.set(key, false);
  return false;
}

function inferBaseQuantityFromScaleValuesRobust(
  line: string,
  scaleLabels: string[],
  usageUnit: string
) {
  const exactValues = parseValuesLine(line, scaleLabels);
  if (exactValues?.length) {
    return exactValues[0] ?? null;
  }

  const digitsOnly = line.replace(/[^\d]/g, "");
  const remainingCount = Math.max(0, scaleLabels.length - 1);

  if (!digitsOnly) return null;
  if (remainingCount === 0) {
    return toNumber(digitsOnly, 0) || null;
  }

  const candidateLengths = usageUnit === "UN" ? [1, 2] : [4, 3, 2, 1];

  for (const candidateLength of candidateLengths) {
    if (candidateLength > digitsOnly.length) continue;

    const prefix = digitsOnly.slice(0, candidateLength);
    if (prefix.length > 1 && prefix.startsWith("0")) continue;

    const value = Number(prefix);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (usageUnit !== "UN" && value < 10 && digitsOnly.length > candidateLength + remainingCount) {
      continue;
    }

    const rest = digitsOnly.slice(candidateLength);
    if (canSegmentDigitsIntoCountRobust(rest, remainingCount)) {
      return value;
    }
  }

  const fallbackPrefixLength = usageUnit === "UN" ? 1 : Math.min(3, digitsOnly.length);
  return toNumber(digitsOnly.slice(0, fallbackPrefixLength), 0) || null;
}

function parseInlineIngredientWithScaleValuesRobust(
  line: string,
  scaleLabels: string[]
): { ingredientName: string; quantity: number; unit: string } | null {
  const cleaned = line.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(.*?)(\d[\d.,]*)$/);

  if (!match) return null;

  const ingredientName = match[1].trim();
  if (!ingredientName || !/[A-Za-zÀ-ÿ]/.test(ingredientName)) {
    return null;
  }

  const unit = inferUsageUnit(ingredientName);
  const quantity = inferBaseQuantityFromScaleValuesRobust(
    match[2],
    scaleLabels,
    unit
  );

  if (!quantity || quantity <= 0) {
    return null;
  }

  return {
    ingredientName,
    quantity,
    unit,
  };
}

function extractCanvaBaseIngredientsRobust(
  pageText: string
): TechnicalSheetIngredientInput[] {
  const lines = getCleanLinesRobust(pageText);
  const scaleHeaderIndex = lines.findIndex(
    (line) => extractScaleLabels(line).length >= 2
  );

  if (scaleHeaderIndex < 0) return [];

  const scaleLabels = extractScaleLabels(lines[scaleHeaderIndex]);
  if (!scaleLabels.length) return [];

  const endIndex = lines.findIndex(
    (line, index) =>
      index > scaleHeaderIndex &&
      (/PESO L[IÍ]QUIDO/i.test(line) || /Modo de Preparo/i.test(line))
  );

  const section =
    endIndex > scaleHeaderIndex
      ? lines.slice(scaleHeaderIndex + 1, endIndex)
      : lines.slice(scaleHeaderIndex + 1, Math.min(lines.length, scaleHeaderIndex + 40));

  const ingredients: TechnicalSheetIngredientInput[] = [];
  let nameBuffer: string[] = [];

  for (const line of section) {
    const upper = line.toUpperCase();

    if (!line.trim()) continue;
    if (extractScaleLabels(line).length >= 2) continue;

    if (
      /ASSADEIRAS?|PAC(?:OTES?)?|PAC|BSN|BISNAGAS?|BISNAGA|TAÇAS?|TAÇA|BOLOS?|BOLO|UNIDADES?|UNIDADE|PORÇÕES?|PORÇÃO|PRATOS?|PRATO/i.test(
        upper
      ) &&
      !/[A-ZÀ-Ý]{3,}.*\d/.test(upper)
    ) {
      continue;
    }

    if (
      upper.includes("PESO LÍQUIDO") ||
      upper.includes("PESO LIQUIDO") ||
      upper.includes("MODO DE PREPARO")
    ) {
      break;
    }

    const direct = parseIngredientLineBaseQuantityRobust(line);

    if (direct) {
      const ingredientName = [nameBuffer.join(" "), direct.ingredientName]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      nameBuffer = [];

      ingredients.push({
        product_id: null,
        ingredient_name: ingredientName,
        usage_quantity: direct.quantity,
        usage_unit: direct.unit,
        purchase_price: 0,
        purchase_quantity: 1,
        purchase_unit: direct.unit,
        correction_factor: 1,
        cooking_factor: 1,
        base_unit_cost: 0,
        final_cost: 0,
        sort_order: ingredients.length,
      });

      continue;
    }

    const inlineRow = parseInlineIngredientWithScaleValuesRobust(line, scaleLabels);

    if (inlineRow) {
      ingredients.push({
        product_id: null,
        ingredient_name: inlineRow.ingredientName,
        usage_quantity: inlineRow.quantity,
        usage_unit: inlineRow.unit,
        purchase_price: 0,
        purchase_quantity: 1,
        purchase_unit: inlineRow.unit,
        correction_factor: 1,
        cooking_factor: 1,
        base_unit_cost: 0,
        final_cost: 0,
        sort_order: ingredients.length,
      });

      nameBuffer = [];
      continue;
    }

    if (nameBuffer.length > 0) {
      const ingredientName = nameBuffer.join(" ").replace(/\s+/g, " ").trim();
      const usageUnit = inferUsageUnit(ingredientName);
      const baseQuantity = inferBaseQuantityFromScaleValuesRobust(
        line,
        scaleLabels,
        usageUnit
      );

      if (ingredientName && baseQuantity && baseQuantity > 0) {
        ingredients.push({
          product_id: null,
          ingredient_name: ingredientName,
          usage_quantity: baseQuantity,
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

        nameBuffer = [];
        continue;
      }
    }

    if (isYieldOnlyLine(line) || shouldIgnoreLine(line)) {
      continue;
    }

    if (!/\d/.test(line)) {
      nameBuffer.push(line);
    }
  }

  return ingredients.filter(
    (item) => item.ingredient_name.trim() && item.usage_quantity > 0
  );
}

function extractCanvaBaseScaleRobust(
  ingredients: TechnicalSheetIngredientInput[],
  pageText: string
): TechnicalSheetScaleInput[] {
  if (!ingredients.length) return [];

  return [
    {
      scale_label: "1X",
      yield_description: parseCanvaYieldLabelRobust(pageText),
      net_weight: null,
      sort_order: 0,
      ingredients: ingredients.map((item, index) => ({
        ingredient_name: item.ingredient_name,
        amount: item.usage_quantity,
        unit: normalizeUnit(item.usage_unit, "G"),
        sort_order: index,
      })),
    },
  ];
}

function extractPreparationMethodRobust(pageText: string) {
  const extracted = extractPreparationMethod(pageText).trim();
  const extractedLooksInvalid =
    !extracted ||
    /^n[aã]o informado\.?$/i.test(extracted) ||
    /Atualizada em:|Cont[eé]m:|Alerg[êe]nicos|Armazenamento:/i.test(extracted);

  if (!extractedLooksInvalid && extracted.length >= 20) {
    return extracted;
  }

  const lines = getCleanLinesRobust(pageText);
  const title = extractTitleRobust(pageText);
  const titleIndex = lines.findIndex(
    (line) => sanitizeTitleRobust(line) === sanitizeTitleRobust(title)
  );
  const ingredientIndex = lines.findIndex((line) => /^Ingredientes\s*:?\s*$/i.test(line));
  const updatedAtIndex = lines.findIndex((line) => /Atualizada em:/i.test(line));

  let startIndex = lines.findIndex((line) => /Grau de/i.test(line));
  if (startIndex < 0) {
    startIndex = lines.findIndex((line) => /TEMPERATURA/i.test(line));
  }

  const endCandidates = [titleIndex, ingredientIndex, updatedAtIndex].filter(
    (index) => index > startIndex
  );

  if (startIndex >= 0) {
    const endIndex =
      endCandidates.length > 0 ? Math.min(...endCandidates) : lines.length;

    const candidate = lines
      .slice(startIndex + 1, endIndex)
      .filter(
        (line) =>
          line &&
          !/^Dificuldade$/i.test(line) &&
          !/^Ingredientes\s*:?\s*$/i.test(line) &&
          !/^Modo de Preparo\s*:?\s*$/i.test(line) &&
          !/^Cont[eé]m\s*:?\s*$/i.test(line) &&
          !/^Alerg[êe]nicos$/i.test(line) &&
          !/^Atualizada em:/i.test(line) &&
          !/^Confeiteiro Chefe$/i.test(line) &&
          !/^\(?\d{2}\)?/.test(line) &&
          !/^Ivan$/i.test(line) &&
          !/^Escobar$/i.test(line) &&
          !/^Ficou com d[úu]vidas/i.test(line) &&
          !/^Entre em contato/i.test(line)
      )
      .join("\n")
      .trim();

    if (candidate.length >= 20) {
      return candidate;
    }
  }

  return extracted;
}

function isTemplateLikePage(pageText: string) {
  const normalized = normalizePdfTextKeepingPagesRobust(pageText);
  const upper = normalized.toUpperCase();
  const detectedIngredients = Math.max(
    extractIngredients(pageText).length,
    extractCanvaBaseIngredientsRobust(pageText).length
  );

  if (detectedIngredients > 0) {
    return false;
  }

  const hasIngredientsHeader = upper.includes("INGREDIENTES");
  const hasPrepHeader = upper.includes("MODO DE PREPARO");
  const hasNoStrongIngredients =
    !/\b[A-ZÀ-Ý][A-ZÀ-Ý\s()./%-]{2,}\s+\d+(?:[.,]\d+)?\b/i.test(normalized);

  const hasEmptyWeight =
    (/PESO L[IÍ]QUIDO:\s*(?:$|\n)/im.test(normalized) &&
      !/PESO L[IÍ]QUIDO:\s*\n?\s*\d/im.test(normalized)) ||
    /PESO L[IÍ]QUIDO:\s*[^\d\n]*$/im.test(normalized);

  return (hasIngredientsHeader && hasPrepHeader && hasNoStrongIngredients) || hasEmptyWeight;
}

function parseAppExportRecipeRobust(
  pageText: string,
  pageNumber: number,
  fileName: string,
  defaultCategory: string
): ImportedRecipe | null {
  if (!/Dados complementares/i.test(pageText) || !/Custo por porção/i.test(pageText)) {
    return null;
  }

  const name = extractAppExportTitleRobust(pageText);
  const ingredients = parseAppExportIngredientsRobust(pageText);

  if (!name || !ingredients.length) {
    return null;
  }

  const prepTimeMatch = pageText.match(/Tempo de preparo\s+(\d+)/i);
  const weightMatch = pageText.match(/Peso por porção\s+([\d.,]+)\s+(KG|G)/i);
  const category = extractAppExportCategoryRobust(pageText, defaultCategory);

  let portionWeight = 0;
  let portionUnit = "G";

  if (weightMatch) {
    const rawValue = toNumber(weightMatch[1], 0);
    const unit = normalizeUnit(weightMatch[2], "G");
    portionUnit = unit;
    portionWeight = unit === "KG" ? Number((rawValue * 1000).toFixed(2)) : rawValue;
  }

  const updatedAtMatch = pageText.match(/Atualizado em\s+(\d{2}\/\d{2}\/\d{4})/i);

  return {
    name,
    category,
    yield_portions: toNumber(
      (pageText.match(/Rendimento original:\s*(\d+)/i) ?? [])[1],
      1
    ),
    portion_weight: portionWeight,
    prep_time_minutes: prepTimeMatch ? toNumber(prepTimeMatch[1], 0) : 0,
    preparation_method:
      (pageText.match(/Modo de preparo\s*([\s\S]*?)Escalas/i) ?? [])[1]?.trim() ||
      "",
    difficulty_level:
      (pageText.match(/Dificuldade\s+([^\n]+)/i) ?? [])[1]?.trim() || null,
    temperature_celsius: extractTemperature(pageText),
    cooking_time_minutes: extractCookingTime(pageText),
    cooking_factor_grams: extractCookingFactor(pageText),
    correction_factor_grams: extractCorrectionFactor(pageText),
    yield_label:
      (pageText.match(/Rendimento exportado:\s*([^\n•]+)/i) ?? [])[1]?.trim() ||
      null,
    portion_weight_unit: portionUnit,
    storage_instructions:
      (pageText.match(/Armazenamento\s+([^\n]+)/i) ?? [])[1]?.trim() || null,
    shelf_life_frozen:
      (pageText.match(/Validade congelado\s+([^\n]+)/i) ?? [])[1]?.trim() || null,
    shelf_life_refrigerated:
      (pageText.match(/Validade refrigerado\s+([^\n]+)/i) ?? [])[1]?.trim() || null,
    shelf_life_room_temp:
      (pageText.match(/Validade ambiente\s+([^\n]+)/i) ?? [])[1]?.trim() || null,
    allergens: (pageText.match(/Alergênicos\s+([^\n]+)/i) ?? [])[1]?.trim() || null,
    source_updated_at: updatedAtMatch ? parseBrazilianDateToIso(updatedAtMatch[1]) : null,
    source_file_name: fileName,
    source_page_number: pageNumber,
    video_url: null,
    ingredients,
    scales: [],
  };
}

function parseCanvaRecipeRobust(
  pageText: string,
  pageNumber: number,
  fileName: string,
  defaultCategory: string
): ImportedRecipe | null {
  if (isTemplateLikePage(pageText)) {
    return null;
  }

  const name = extractTitleRobust(pageText);
  const parsedScaleIngredients = extractIngredients(pageText);
  const fallbackIngredients = extractCanvaBaseIngredientsRobust(pageText);
  const useFallbackIngredients =
    fallbackIngredients.length > parsedScaleIngredients.length;
  const ingredients = useFallbackIngredients
    ? fallbackIngredients
    : parsedScaleIngredients;
  const scales = useFallbackIngredients
    ? extractCanvaBaseScaleRobust(ingredients, pageText)
    : extractScales(pageText);

  if (!name || !ingredients.length) {
    return null;
  }

  return {
    name,
    category: defaultCategory || "Importado PDF",
    yield_portions: parseCanvaYieldPortionsRobust(pageText),
    portion_weight: extractPortionWeight(pageText),
    prep_time_minutes: extractPrepTime(pageText),
    preparation_method: extractPreparationMethodRobust(pageText),
    difficulty_level: extractDifficulty(pageText),
    temperature_celsius: extractTemperature(pageText),
    cooking_time_minutes: extractCookingTime(pageText),
    cooking_factor_grams: extractCookingFactor(pageText),
    correction_factor_grams: extractCorrectionFactor(pageText),
    yield_label: parseCanvaYieldLabelRobust(pageText),
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

function parsePdfPageToRecipeRobust(
  pageText: string,
  pageNumber: number,
  fileName: string,
  defaultCategory: string
): ImportedRecipe | null {
  return (
    parseAppExportRecipeRobust(pageText, pageNumber, fileName, defaultCategory) ||
    parseCanvaRecipeRobust(pageText, pageNumber, fileName, defaultCategory)
  );
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

    const maxPdfSizeInBytes = 40 * 1024 * 1024;
    if (file.size > maxPdfSizeInBytes) {
      return {
        ok: false,
        error: "O PDF deve ter no máximo 40MB.",
      };
    }

    const defaultCategory =
      String(categoryEntry ?? "Importado PDF").trim() || "Importado PDF";

    const pages = await extractPdfPagesTextRobust(file);

    const validRecipes: ImportedRecipe[] = [];
    const ignoredPages: Array<{ page: number; title: string; reason: string }> = [];

    for (let index = 0; index < pages.length; index++) {
      const pageText = pages[index];
      const pageNumber = index + 1;
      const title = extractTitleRobust(pageText) || `Página ${pageNumber}`;

      try {
        const recipe = parsePdfPageToRecipeRobust(
          pageText,
          pageNumber,
          file.name,
          defaultCategory
        );

        if (!recipe) {
          ignoredPages.push({
            page: pageNumber,
            title,
            reason: "Página incompleta, vazia, template ou sem ingredientes válidos.",
          });
          continue;
        }

        if (!recipe.ingredients.length) {
          ignoredPages.push({
            page: pageNumber,
            title: recipe.name,
            reason: "Página sem ingredientes válidos para importação.",
          });
          continue;
        }

        validRecipes.push(recipe);
      } catch (pageError: any) {
        console.error("[importPDF] erro na página", pageNumber, pageError);

        ignoredPages.push({
          page: pageNumber,
          title,
          reason: pageError?.message || "Erro ao interpretar esta página.",
        });
      }
    }

    if (!validRecipes.length) {
      return {
        ok: false,
        error:
          "Nenhuma ficha técnica válida pôde ser criada a partir deste PDF.",
      };
    }

    const created: Array<{ id: string; name: string; page: number | null }> = [];

    for (const recipe of validRecipes) {
      try {
        if (recipe.source_file_name && recipe.source_page_number !== null) {
          const { data: existingImportedSheets, error: existingImportedSheetsError } =
            await supabase
              .from("technical_sheets")
              .select("id, name")
              .eq("establishment_id", establishmentId)
              .eq("import_origin", "pdf_import")
              .eq("source_file_name", recipe.source_file_name)
              .eq("source_page_number", recipe.source_page_number)
              .limit(1);

          if (existingImportedSheetsError) {
            console.error(
              "[importPDF] erro ao verificar duplicidade da ficha importada",
              existingImportedSheetsError
            );
          } else if (existingImportedSheets?.length) {
            ignoredPages.push({
              page: recipe.source_page_number ?? 0,
              title: recipe.name,
              reason:
                "Esta página deste arquivo já foi importada anteriormente.",
            });

            continue;
          }
        }

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
            import_origin: "pdf_import",
            source_file_name: recipe.source_file_name,
            source_page_number: recipe.source_page_number,
            video_url: recipe.video_url,
            created_by: userId,
          })
          .select("id, name")
          .single();

        if (sheetError || !sheet) {
          console.error("[importPDF] erro ao criar ficha", sheetError, recipe);

          ignoredPages.push({
            page: recipe.source_page_number ?? 0,
            title: recipe.name,
            reason: "Falha ao criar a ficha no banco.",
          });

          continue;
        }

        const ingredientsPayload = recipe.ingredients.map((ingredient, index) => ({
          technical_sheet_id: sheet.id,
          product_id: null,
          ingredient_name: ingredient.ingredient_name.trim(),
          usage_quantity: ingredient.usage_quantity,
          usage_unit: normalizeUnit(ingredient.usage_unit, "G"),
          purchase_price: ingredient.purchase_price || 0,
          purchase_quantity: ingredient.purchase_quantity || 1,
          purchase_unit: normalizeUnit(ingredient.purchase_unit, "G"),
          correction_factor: ingredient.correction_factor || 1,
          cooking_factor: ingredient.cooking_factor || 1,
          base_unit_cost: ingredient.base_unit_cost || 0,
          final_cost: ingredient.final_cost || 0,
          sort_order: index,
        }));

        if (ingredientsPayload.length) {
          const { error: ingredientsError } = await supabase
            .from("technical_sheet_ingredients")
            .insert(ingredientsPayload);

          if (ingredientsError) {
            console.error("[importPDF] erro ao criar ingredientes", ingredientsError);

            await supabase.from("technical_sheets").delete().eq("id", sheet.id);

            ignoredPages.push({
              page: recipe.source_page_number ?? 0,
              title: recipe.name,
              reason: "Erro ao salvar ingredientes.",
            });

            continue;
          }
        }

        if (recipe.scales?.length) {
          try {
            await saveScales(supabase, sheet.id, recipe.scales);
          } catch (scaleError) {
            console.error("[importPDF] erro ao salvar escalas", scaleError);
          }
        }

        created.push({
          id: sheet.id,
          name: recipe.name,
          page: recipe.source_page_number,
        });
      } catch (recipeError: any) {
        console.error("[importPDF] erro no lote da receita", recipeError, recipe);

        ignoredPages.push({
          page: recipe.source_page_number ?? 0,
          title: recipe.name,
          reason: recipeError?.message || "Erro inesperado ao criar a ficha.",
        });
      }
    }

    if (!created.length) {
      return {
        ok: false,
        error:
          "Nenhuma ficha técnica válida pôde ser criada a partir deste PDF.",
      };
    }

    revalidatePath("/dashboard/fichas-tecnicas");

    return {
      ok: true,
      importedCount: created.length,
      recipes: created,
      ignoredPages,
    };
  } catch (error: any) {
    console.error("[importPDF] falha geral", error);
    return {
      ok: false,
      error: error?.message || "Erro ao importar o PDF.",
    };
  }
}

export async function uploadTechnicalSheetPdfImportAction(formData: FormData) {
  const { supabase, establishmentId, userId } = await getContext();

  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File)) {
    throw new Error("Nenhum arquivo PDF foi enviado.");
  }

  const file = fileEntry;

  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("O arquivo enviado precisa ser um PDF.");
  }

  const maxPdfSizeInBytes = 40 * 1024 * 1024;
  if (file.size > maxPdfSizeInBytes) {
    throw new Error("O PDF deve ter no máximo 40MB.");
  }

  const safeFileName = sanitizeFileName(file.name);
  const filePath = `${establishmentId}/${userId}/imports/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("technical-sheets")
    .upload(filePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("Erro ao enviar PDF para o Storage:", uploadError);
    throw new Error(
      uploadError.message || "Erro ao enviar PDF para o Storage."
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from("technical-sheets")
    .getPublicUrl(filePath);

  const downloadURL = publicUrlData?.publicUrl;

  if (!downloadURL) {
    throw new Error("Não foi possível obter a URL pública do PDF.");
  }

  return {
    filePath,
    downloadURL,
  };
}
