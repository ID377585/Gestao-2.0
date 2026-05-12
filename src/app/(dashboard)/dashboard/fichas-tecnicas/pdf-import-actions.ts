"use server";

import { Buffer } from "node:buffer";
import {
  createTechnicalSheet,
  type TechnicalSheetInput,
  type TechnicalSheetIngredientInput,
  type TechnicalSheetScaleInput,
} from "./actions";

type ImportTechnicalSheetsFromPdfResult =
  | {
      ok: true;
      importedCount: number;
      recipes: Array<{ id: string; name: string; page: number | null }>;
      ignoredPages: Array<{ page: number; title: string; reason: string }>;
    }
  | { ok: false; error: string };

type ParsedIngredientRow = {
  ingredientName: string;
  values: number[];
  unit: string;
  sourceLine: string;
};

type ParsedTable = {
  scaleLabels: string[];
  scaleFactors: number[];
  yieldDescriptions: string[];
  ingredientRows: ParsedIngredientRow[];
  netWeights: number[];
  errors: string[];
};

function normalizeText(value: string) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toNumber(value: unknown, fallback = 0) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeUnit(value: string | null | undefined, fallback = "G") {
  const unit = String(value ?? "").trim().toUpperCase();
  return unit || fallback;
}

function parseBrazilianDateToIso(value: string | null | undefined) {
  if (!value) return null;
  const m = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function cleanLines(text: string) {
  return normalizeText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isScaleHeaderLine(line: string) {
  const upper = line.toUpperCase().trim();
  return /^\d+X(?:\s+\d+X)+$/.test(upper) || /^(?:\d+X){2,}$/.test(upper);
}

function extractScaleLabels(line: string) {
  return line.toUpperCase().match(/\d+X/g) ?? [];
}

function inferUnit(ingredientName: string) {
  const upper = ingredientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (/\bQTD\b|UNIDADES?|CASCA DE LARANJA|GOTAS?/.test(upper)) return "UN";
  if (/AGUA|LEITE|VINHO|LICOR|OLEO|WHISKY|EMULSAO|ESSENCIA/.test(upper)) return "ML";
  return "G";
}

function shouldIgnoreTableLine(line: string) {
  const upper = line.toUpperCase().trim();
  if (!upper) return true;

  return [
    "INGREDIENTES",
    "MODO DE PREPARO",
    "ATUALIZADA EM",
    "TEMPO DE PREP",
    "TEM PO DE PREP",
    "TEMPERATURA",
    "GRAU DE DIFICULDADE",
    "FATOR COC",
    "FATOR CORR",
    "RENDIMENTO",
    "PESO DA POR",
    "ASSISTA O",
    "CONFEITEIRO",
    "IVAN ESCOBAR",
    "FICOU COM",
    "ENTRE EM CONTATO",
  ].some((fragment) => upper.includes(fragment));
}

function isYieldOnlyLine(line: string) {
  const upper = line.toUpperCase().trim();
  if (!upper) return false;
  if (/^\d+(?:[.,]\d+)?$/.test(upper)) return true;
  return /^(?:\d+(?:[.,]\d+)?\s*)?(PAC(?:OTES?)?|POTES?|BISNAGAS?|BDJ|BANDEJAS?|TAÇAS?|TACAS?|ASSADEIRAS?|PORÇÕES?|PORCOES?|UNIDADES?|BOLOS?|KG|KILOS?)\b/.test(upper);
}

function parseConcatenatedValues(line: string, scaleFactors: number[]) {
  const digitsOnly = line.replace(/[^\d]/g, "");
  if (!digitsOnly || !scaleFactors.length) return null;

  for (let prefixLength = 1; prefixLength <= Math.min(5, digitsOnly.length); prefixLength++) {
    const base = Number(digitsOnly.slice(0, prefixLength));
    if (!Number.isFinite(base) || base <= 0) continue;

    const expected = scaleFactors.map((factor) => String(base * factor)).join("");
    if (expected === digitsOnly) return scaleFactors.map((factor) => base * factor);
  }

  return null;
}

function parseValuesLine(line: string, scaleFactors: number[]) {
  const values = (line.match(/\d+(?:[.,]\d+)?/g) ?? []).map((value) => toNumber(value, 0));
  if (values.length === scaleFactors.length) return values;

  const compact = parseConcatenatedValues(line, scaleFactors);
  if (compact?.length === scaleFactors.length) return compact;

  return null;
}

function splitIngredientLine(line: string, scaleFactors: number[]) {
  const cleaned = line.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(.*?)(\d+(?:[.,]\d+)?(?:\s+\d+(?:[.,]\d+)?)+)\s*$/);
  if (!match) return null;

  const ingredientName = String(match[1] ?? "").trim();
  const values = parseValuesLine(String(match[2] ?? ""), scaleFactors);

  if (!ingredientName || !values) return null;
  return { ingredientName, values };
}

function valuesAreCoherent(values: number[], scaleFactors: number[]) {
  if (values.length !== scaleFactors.length || values.length === 0) return false;

  const first = values[0];
  if (!Number.isFinite(first)) return false;
  if (first === 0) return values.every((value) => value === 0);

  return values.every((value, index) => {
    const expected = first * scaleFactors[index];
    const tolerance = Math.max(1, Math.abs(expected) * 0.03);
    return Math.abs(value - expected) <= tolerance;
  });
}

function extractYieldDescriptions(text: string, scaleCount: number) {
  const matches = [
    ...text.matchAll(
      /\b\d+(?:[.,]\d+)?\s*(?:PAC(?:OTES?)?|POTES?|BISNAGAS?|BDJ|BANDEJAS?|TAÇAS?|TACAS?|ASSADEIRAS?|PORÇÕES?|PORCOES?|UNIDADES?|BOLOS?|KG|KILOS?)\b/gi
    ),
  ].map((match) => match[0].replace(/\s+/g, " ").trim());

  return matches.slice(0, scaleCount);
}

function parseScaleTable(pageText: string): ParsedTable | null {
  const lines = cleanLines(pageText);
  const headerIndex = lines.findIndex(isScaleHeaderLine);
  if (headerIndex < 0) return null;

  const scaleLabels = extractScaleLabels(lines[headerIndex]);
  const scaleFactors = scaleLabels.map((label) => toNumber(label.replace(/X/i, ""), 0));
  const errors: string[] = [];

  if (!scaleLabels.length || scaleFactors.some((factor) => factor <= 0)) {
    return null;
  }

  const ingredientRows: ParsedIngredientRow[] = [];
  const nameBuffer: string[] = [];
  let netWeights: number[] = [];
  const yieldArea: string[] = [];

  for (let index = headerIndex + 1; index < lines.length; index++) {
    const line = lines[index];
    const upper = line.toUpperCase();

    if (/PESO\s+L[ÍI]QUIDO|PESO\s+LIQUIDO/.test(upper)) {
      netWeights = parseValuesLine(line, scaleFactors) ?? parseValuesLine(lines[index + 1] ?? "", scaleFactors) ?? [];
      break;
    }

    if (shouldIgnoreTableLine(line)) continue;
    if (isScaleHeaderLine(line)) continue;

    if (isYieldOnlyLine(line)) {
      yieldArea.push(line);
      continue;
    }

    const valuesOnly = parseValuesLine(line, scaleFactors);
    if (valuesOnly && nameBuffer.length) {
      const ingredientName = nameBuffer.join(" ").replace(/\s+/g, " ").trim();
      nameBuffer.length = 0;
      ingredientRows.push({ ingredientName, values: valuesOnly, unit: inferUnit(ingredientName), sourceLine: line });
      continue;
    }

    const inlineRow = splitIngredientLine(line, scaleFactors);
    if (inlineRow) {
      const ingredientName = [nameBuffer.join(" "), inlineRow.ingredientName]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      nameBuffer.length = 0;
      ingredientRows.push({
        ingredientName,
        values: inlineRow.values,
        unit: inferUnit(ingredientName),
        sourceLine: line,
      });
      continue;
    }

    const hasLetters = /[A-Za-zÀ-ÿ]/.test(line);
    const hasNumbers = /\d/.test(line);
    if (hasLetters && !hasNumbers) {
      nameBuffer.push(line);
    } else if (hasLetters && hasNumbers) {
      errors.push(`Linha de ingrediente sem leitura segura: ${line}`);
    }
  }

  if (ingredientRows.length === 0) {
    errors.push("Nenhum ingrediente foi lido com segurança na tabela.");
  }

  for (const row of ingredientRows) {
    if (row.values.length !== scaleLabels.length) {
      errors.push(`Ingrediente ${row.ingredientName} tem quantidade de escalas divergente.`);
      continue;
    }

    if (!valuesAreCoherent(row.values, scaleFactors)) {
      errors.push(`Ingrediente ${row.ingredientName} tem valores incoerentes entre as escalas: ${row.values.join(", ")}.`);
    }
  }

  if (netWeights.length > 0 && !valuesAreCoherent(netWeights, scaleFactors)) {
    errors.push(`Peso líquido incoerente entre as escalas: ${netWeights.join(", ")}.`);
  }

  return {
    scaleLabels,
    scaleFactors,
    yieldDescriptions: extractYieldDescriptions(yieldArea.join(" "), scaleLabels.length),
    ingredientRows,
    netWeights,
    errors,
  };
}

function extractTitle(pageText: string) {
  const lines = cleanLines(pageText);
  const ingredientIndex = lines.findIndex((line) => /^Ingredientes\s*:?
?$/i.test(line));

  const blocked = /^(1X|\d+X|PESO|MODO|TEMPO|TE M PO|GRAU|CONFEITEIRO|ATUALIZADA|INGREDIENTES|CONT[ÉE]M|ALERG[ÊE]NICOS|ARMAZENAMENTO)/i;

  const candidates = [
    ...lines.slice(0, 12),
    ...(ingredientIndex > 0 ? lines.slice(Math.max(0, ingredientIndex - 4), ingredientIndex).reverse() : []),
  ];

  for (const candidate of candidates) {
    const cleaned = candidate.replace(/\s+/g, " ").trim();
    if (cleaned.length >= 3 && cleaned.length <= 80 && /[A-Za-zÀ-ÿ]/.test(cleaned) && !blocked.test(cleaned)) {
      return cleaned;
    }
  }

  return "Receita importada";
}

function extractBetween(text: string, start: RegExp, end: RegExp) {
  const normalized = normalizeText(text);
  const startMatch = normalized.match(start);
  if (!startMatch || startMatch.index === undefined) return "";

  const afterStart = normalized.slice(startMatch.index + startMatch[0].length);
  const endMatch = afterStart.match(end);
  return (endMatch?.index !== undefined ? afterStart.slice(0, endMatch.index) : afterStart).trim();
}

function extractPreparationMethod(pageText: string) {
  return extractBetween(
    pageText,
    /Modo\s+de\s+Preparo\s*:?/i,
    /(?:Armazenamento\s*:|Cont[eé]m\s*:|Alerg[eê]nicos|Atualizada em:|Ficou com d[úu]vidas|Confeiteiro Chefe)/i
  );
}

function extractFirstNumberNear(pageText: string, label: RegExp) {
  const normalized = normalizeText(pageText);
  const labelMatch = normalized.match(label);
  if (!labelMatch || labelMatch.index === undefined) return null;

  const after = normalized.slice(labelMatch.index, labelMatch.index + 90);
  const match = after.match(/\d+(?:[.,]\d+)?/);
  return match ? toNumber(match[0], 0) : null;
}

function extractTemperature(pageText: string) {
  const match = pageText.match(/(-?\d+(?:[.,]\d+)?)\s*º/);
  return match ? toNumber(match[1], 0) : null;
}

function extractPortionWeight(pageText: string) {
  const matches = [...pageText.matchAll(/(\d+(?:[.,]\d+)?)\s*(GRAMAS|G|KG|KILO|KILOS)\b/gi)];
  if (!matches.length) return 0;

  const last = matches[matches.length - 1];
  const value = toNumber(last[1], 0);
  const unit = String(last[2] ?? "").toUpperCase();
  return unit.startsWith("K") ? Number((value * 1000).toFixed(2)) : value;
}

function extractPortionWeightUnit(pageText: string) {
  const matches = [...pageText.matchAll(/(\d+(?:[.,]\d+)?)\s*(GRAMAS|G|KG|KILO|KILOS)\b/gi)];
  if (!matches.length) return "G";
  const unit = String(matches[matches.length - 1][2] ?? "").toUpperCase();
  return unit.startsWith("K") ? "KG" : "G";
}

function extractShelfLife(pageText: string, label: RegExp) {
  const match = normalizeText(pageText).match(label);
  return match?.[1]?.trim() || null;
}

function extractAllergens(pageText: string) {
  const normalized = normalizeText(pageText);
  if (/N[ÃA]O\s+CONT[ÉE]M/i.test(normalized)) return "NÃO CONTÉM";

  const match = normalized.match(/Cont[eé]m\s*:\s*([\s\S]*?)(?:Atualizada em:|$)/i);
  if (!match?.[1]) return null;

  const cleaned = match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/ALERG|ARMAZENAMENTO|CONGEL|REFRIGERA|TEMP\.\s*AMBIENTE|TEMPERATURA AMBIENTE/i.test(line))
    .join(", ")
    .replace(/\s+,/g, ",")
    .trim();

  return cleaned || null;
}

function buildRecipeFromPage(
  pageText: string,
  pageNumber: number,
  fileName: string,
  defaultCategory: string
): { recipe: TechnicalSheetInput | null; title: string; errors: string[] } {
  const title = extractTitle(pageText);
  const table = parseScaleTable(pageText);
  const errors: string[] = [];

  if (!table) {
    return { recipe: null, title, errors: ["Tabela de escalas não encontrada ou ilegível."] };
  }

  errors.push(...table.errors);

  const preparationMethod = extractPreparationMethod(pageText);
  if (!preparationMethod || preparationMethod.length < 20) {
    errors.push("Modo de preparo ausente ou curto demais.");
  }

  if (errors.length > 0) {
    return { recipe: null, title, errors };
  }

  const ingredients: TechnicalSheetIngredientInput[] = table.ingredientRows.map((row, index) => ({
    product_id: null,
    ingredient_name: row.ingredientName,
    usage_quantity: row.values[0] ?? 0,
    usage_unit: row.unit,
    purchase_price: 0,
    purchase_quantity: 1,
    purchase_unit: row.unit,
    correction_factor: 1,
    cooking_factor: 1,
    base_unit_cost: 0,
    final_cost: 0,
    sort_order: index,
  }));

  const scales: TechnicalSheetScaleInput[] = table.scaleLabels.map((scaleLabel, scaleIndex) => ({
    scale_label: scaleLabel,
    yield_description: table.yieldDescriptions[scaleIndex] ?? table.yieldDescriptions[0] ?? null,
    net_weight: table.netWeights[scaleIndex] ?? null,
    sort_order: scaleIndex,
    ingredients: table.ingredientRows.map((row, ingredientIndex) => ({
      ingredient_name: row.ingredientName,
      amount: row.values[scaleIndex] ?? 0,
      unit: row.unit,
      sort_order: ingredientIndex,
    })),
  }));

  const fallbackYield = table.yieldDescriptions[0]?.match(/\d+(?:[.,]\d+)?/)?.[0];

  return {
    title,
    errors,
    recipe: {
      name: title,
      category: defaultCategory || "Importado PDF",
      yield_portions: fallbackYield ? Math.max(1, toNumber(fallbackYield, 1)) : 1,
      portion_weight: extractPortionWeight(pageText),
      prep_time_minutes: extractFirstNumberNear(pageText, /TEM\s*PO\s*DE\s*PREP|TEMPO\s*DE\s*PREP/i) ?? 0,
      profit_margin_percent: 0,
      sale_price: 0,
      total_cost: 0,
      cost_per_portion: 0,
      preparation_method: preparationMethod,
      difficulty_level: null,
      temperature_celsius: extractTemperature(pageText),
      cooking_time_minutes: extractFirstNumberNear(pageText, /TEM\s*PO\s*COC|TEMPO\s*COC/i),
      cooking_factor_grams: extractFirstNumberNear(pageText, /FATOR\s*COC/i),
      correction_factor_grams: extractFirstNumberNear(pageText, /FATOR\s*CORR/i),
      yield_label: table.yieldDescriptions[0] ?? null,
      portion_weight_unit: extractPortionWeightUnit(pageText),
      storage_instructions: extractShelfLife(pageText, /Armazenamento\s*:\s*([^\n]+)/i),
      shelf_life_frozen: extractShelfLife(pageText, /(?:Congelamento|Congelado)\s*:\s*([^\n]+)/i),
      shelf_life_refrigerated: extractShelfLife(pageText, /Sob refrigera[çc][ãa]o\s*:\s*([^\n]+)/i),
      shelf_life_room_temp: extractShelfLife(pageText, /(?:Temp\.\s*Ambiente|Temperatura Ambiente)\s*:\s*([^\n]+)/i),
      allergens: extractAllergens(pageText),
      source_updated_at: parseBrazilianDateToIso(extractShelfLife(pageText, /Atualizada em\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)),
      import_origin: "pdf_import_validated",
      source_file_name: fileName,
      source_page_number: pageNumber,
      video_url: null,
      ingredients,
      scales,
    },
  };
}

async function loadPdfParse() {
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;

  if (typeof pdfParse !== "function") {
    throw new Error('A versão instalada de "pdf-parse" não é compatível. Rode: npm install pdf-parse@1.1.1');
  }

  return pdfParse;
}

async function renderPdfPageText(pageData: any) {
  const textContent = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  });

  let lastY: number | null = null;
  let text = "";

  for (const item of textContent.items ?? []) {
    const value = typeof item?.str === "string" ? item.str : "";
    const y = typeof item?.transform?.[5] === "number" ? Math.round(item.transform[5]) : null;

    if (lastY === null || y === lastY) {
      text += value;
    } else {
      text += `\n${value}`;
    }

    lastY = y;
  }

  return text;
}

function splitFallbackPages(rawText: string) {
  const normalized = normalizeText(rawText);
  const matches = [...normalized.matchAll(/Atualizada em:\s*\d{2}\/\d{2}\/\d{4}/gi)];

  if (matches.length <= 1) return [normalized];

  const pages: string[] = [];
  let start = 0;

  for (let index = 0; index < matches.length; index++) {
    const next = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
    const chunk = normalized.slice(start, next).trim();
    if (chunk) pages.push(chunk);
    start = next;
  }

  return pages;
}

async function extractPdfPages(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const pdfParse = await loadPdfParse();
  const pages: string[] = [];

  const parsed = await pdfParse(buffer, {
    pagerender: async (pageData: any) => {
      const pageText = await renderPdfPageText(pageData);
      const normalized = normalizeText(pageText);
      if (normalized) pages.push(normalized);
      return pageText;
    },
  });

  if (pages.length > 0) return pages;

  const rawText = String(parsed?.text ?? "");
  if (!rawText.trim()) {
    throw new Error("Não foi possível extrair texto do PDF.");
  }

  return splitFallbackPages(rawText);
}

export async function importTechnicalSheetsFromPdfAction(
  formData: FormData
): Promise<ImportTechnicalSheetsFromPdfResult> {
  try {
    const file = formData.get("file");
    const defaultCategory = String(formData.get("defaultCategory") ?? "Importado PDF").trim();

    if (!(file instanceof File)) {
      throw new Error("Envie um arquivo PDF válido.");
    }

    const pages = await extractPdfPages(file);
    const recipes: Array<{ id: string; name: string; page: number | null }> = [];
    const ignoredPages: Array<{ page: number; title: string; reason: string }> = [];

    for (const [index, pageText] of pages.entries()) {
      const pageNumber = index + 1;
      const parsed = buildRecipeFromPage(pageText, pageNumber, file.name, defaultCategory);

      if (!parsed.recipe) {
        ignoredPages.push({
          page: pageNumber,
          title: parsed.title,
          reason: parsed.errors.slice(0, 3).join(" | ") || "Página sem dados suficientes.",
        });
        continue;
      }

      const created = await createTechnicalSheet(parsed.recipe);
      recipes.push({ id: String((created as any).id), name: parsed.recipe.name, page: pageNumber });
    }

    return {
      ok: true,
      importedCount: recipes.length,
      recipes,
      ignoredPages,
    };
  } catch (error: any) {
    console.error("[validatedPDFImport] erro ao importar PDF", error);
    return {
      ok: false,
      error: error?.message || "Não foi possível importar o PDF.",
    };
  }
}
