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

type PreviewTechnicalSheetsFromPdfResult =
  | {
      ok: true;
      pages: Array<{
        page: number;
        title: string;
        status: "ready" | "blocked";
        reason: string | null;
        warnings: string[];
        recipe: TechnicalSheetInput | null;
      }>;
    }
  | { ok: false; error: string };

type CreateTechnicalSheetsFromPreviewResult =
  | {
      ok: true;
      importedCount: number;
      recipes: Array<{ id: string; name: string; page: number | null }>;
      ignoredPages: Array<{ page: number | null; title: string; reason: string }>;
    }
  | { ok: false; error: string };

type ParsedIngredientRow = {
  ingredientName: string;
  values: number[];
  unit: string;
};

type ParsedTable = {
  scaleLabels: string[];
  yieldDescriptions: string[];
  ingredientRows: ParsedIngredientRow[];
  netWeights: number[];
  errors: string[];
  warnings: string[];
};

type TextItem = {
  str?: string;
  width?: number;
  transform?: number[];
};

function normalizeText(value: string) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function isOneToNScale(scaleFactors: number[]) {
  return scaleFactors.every((factor, index) => factor === index + 1);
}

function inferUnit(ingredientName: string) {
  const upper = stripAccents(ingredientName).toUpperCase();

  if (/\bQTD\b|UNIDADES?|CASCA DE LARANJA|GOTAS?/.test(upper)) return "UN";
  if (/AGUA|LEITE|VINHO|LICOR|OLEO|WHISKY|EMULSAO|ESSENCIA/.test(upper)) return "ML";
  return "G";
}

function normalizeIngredientName(value: string) {
  return value
    .replace(/\bACUCAR\b/gi, "AÇÚCAR")
    .replace(/\bREIFNAO\b/gi, "REFINADO")
    .replace(/\bREFINAO\b/gi, "REFINADO")
    .replace(/\bGLUTEM\b/gi, "GLÚTEN")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldIgnoreTableLine(line: string) {
  const upper = stripAccents(line).toUpperCase().trim();
  if (!upper) return true;

  return [
    "INGREDIENTES",
    "MODO DE PREPARO",
    "ATUALIZADA EM",
    "TEMPO DE PREP",
    "TE M PO DE PREP",
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
  const upper = stripAccents(line).toUpperCase().trim();
  if (!upper) return false;
  if (/^\d+(?:[.,]\d+)?$/.test(upper)) return true;
  return /^(?:\d+(?:[.,]\d+)?\s*)?(PAC(?:OTES?)?|POTES?|BISNAGAS?|BDJ|BDJS?|BANDEJAS?|TACAS?|ASSADEIRAS?|PORCOES?|UNIDADES?|BOLOS?|KG|KILOS?)\b/.test(upper);
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

  const ingredientName = normalizeIngredientName(String(match[1] ?? ""));
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

function describeExpectedScale(values: number[], scaleFactors: number[]) {
  if (!values.length || !scaleFactors.length || values[0] === 0) return "";
  return ` esperado: ${scaleFactors.map((factor) => values[0] * factor).join(", ")}`;
}

function extractYieldDescriptions(text: string, scaleCount: number) {
  const matches = [
    ...stripAccents(text).matchAll(
      /\b\d+(?:[.,]\d+)?\s*(?:PAC(?:OTES?)?|POTES?|BISNAGAS?|BDJ|BDJS?|BANDEJAS?|TACAS?|ASSADEIRAS?|PORCOES?|UNIDADES?|BOLOS?|KG|KILOS?)\b/gi
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
  const warnings: string[] = [];

  if (!scaleLabels.length || scaleFactors.some((factor) => factor <= 0)) {
    return null;
  }

  const ingredientRows: ParsedIngredientRow[] = [];
  const nameBuffer: string[] = [];
  let netWeights: number[] = [];
  const yieldArea: string[] = [];

  for (let index = headerIndex + 1; index < lines.length; index++) {
    const line = lines[index];
    const upper = stripAccents(line).toUpperCase();

    if (/PESO\s+L[IÍ]QUIDO|PESO\s+LIQUIDO/.test(upper)) {
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
      const ingredientName = normalizeIngredientName(nameBuffer.join(" "));
      nameBuffer.length = 0;
      ingredientRows.push({ ingredientName, values: valuesOnly, unit: inferUnit(ingredientName) });
      continue;
    }

    const inlineRow = splitIngredientLine(line, scaleFactors);
    if (inlineRow) {
      const ingredientName = normalizeIngredientName(
        [nameBuffer.join(" "), inlineRow.ingredientName].filter(Boolean).join(" ")
      );
      nameBuffer.length = 0;
      ingredientRows.push({
        ingredientName,
        values: inlineRow.values,
        unit: inferUnit(ingredientName),
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

  if (ingredientRows.length === 0) errors.push("Nenhum ingrediente foi lido com segurança na tabela.");
  if (nameBuffer.length > 0) errors.push(`Ingrediente sem linha de quantidades: ${nameBuffer.join(" ")}.`);

  for (const row of ingredientRows) {
    if (row.values.length !== scaleLabels.length) {
      errors.push(`Ingrediente ${row.ingredientName} tem quantidade de escalas divergente.`);
      continue;
    }

    if (!valuesAreCoherent(row.values, scaleFactors)) {
      errors.push(
        `Ingrediente ${row.ingredientName} tem valores incoerentes entre as escalas: ${row.values.join(", ")}.${
          isOneToNScale(scaleFactors) ? describeExpectedScale(row.values, scaleFactors) : ""
        }`
      );
    }
  }

  if (netWeights.length === 0) {
    errors.push("Peso líquido não foi lido com segurança.");
  } else if (netWeights.length !== scaleLabels.length) {
    errors.push("Peso líquido tem quantidade de escalas divergente.");
  } else if (!valuesAreCoherent(netWeights, scaleFactors)) {
    errors.push(`Peso líquido incoerente entre as escalas: ${netWeights.join(", ")}.`);
  }

  const yieldDescriptions = extractYieldDescriptions(yieldArea.join(" "), scaleLabels.length);
  if (yieldDescriptions.length > 0 && yieldDescriptions.length !== scaleLabels.length) {
    warnings.push("Descrições de rendimento não cobrem todas as escalas.");
  }

  return { scaleLabels, yieldDescriptions, ingredientRows, netWeights, errors, warnings };
}

function extractTitle(pageText: string) {
  const lines = cleanLines(pageText);
  const ingredientIndex = lines.findIndex((line) => /^Ingredientes\s*:?$/i.test(line));
  const blocked = /^(1X|\d+X|PESO|MODO|TEMPO|TE M PO|GRAU|CONFEITEIRO|ATUALIZADA|INGREDIENTES|CONT[ÉE]M|ALERG[ÊE]NICOS|ARMAZENAMENTO|ASSISTA|FICOU)/i;
  const candidates = [
    ...lines.slice(0, 14),
    ...(ingredientIndex > 0 ? lines.slice(Math.max(0, ingredientIndex - 5), ingredientIndex).reverse() : []),
  ];

  for (const candidate of candidates) {
    const cleaned = candidate.replace(/\s+/g, " ").trim();
    const normalized = stripAccents(cleaned).toUpperCase();
    if (
      cleaned.length >= 3 &&
      cleaned.length <= 90 &&
      /[A-Za-zÀ-ÿ]/.test(cleaned) &&
      !blocked.test(cleaned) &&
      !/^(GRAUS?|MINUTOS?|GRAMAS?|KILOS?|PORCOES?|UNIDADES?)$/.test(normalized)
    ) {
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
  const after = normalized.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 120);
  const match = after.match(/-?\d+(?:[.,]\d+)?/);
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

function extractStorage(pageText: string) {
  return extractShelfLife(pageText, /Armazenamento(?:\([^)]*\))?\s*:?\s*([^\n]+)/i);
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

function validateRecipePayload(recipe: TechnicalSheetInput, table: ParsedTable) {
  const errors: string[] = [];
  if (!recipe.name || recipe.name === "Receita importada") errors.push("Título da ficha não foi identificado com segurança.");
  if (recipe.ingredients.length < 2) errors.push("Menos de 2 ingredientes foram identificados com segurança.");
  if (!recipe.scales?.length) errors.push("Nenhuma escala foi montada com segurança.");
  const baseIngredientNames = recipe.ingredients.map((ingredient) => ingredient.ingredient_name.trim()).filter(Boolean);
  if (baseIngredientNames.length !== new Set(baseIngredientNames.map((name) => stripAccents(name).toUpperCase())).size) {
    errors.push("Ingredientes duplicados foram detectados na tabela extraída.");
  }
  if (table.scaleLabels.length > 1) {
    for (const row of table.ingredientRows) {
      if (row.values.some((value) => !Number.isFinite(value) || value < 0)) {
        errors.push(`Ingrediente ${row.ingredientName} tem quantidade inválida.`);
      }
    }
  }
  return errors;
}

function buildRecipeFromPage(pageText: string, pageNumber: number, fileName: string, defaultCategory: string): { recipe: TechnicalSheetInput | null; title: string; errors: string[]; warnings: string[] } {
  const title = extractTitle(pageText);
  const table = parseScaleTable(pageText);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!table) return { recipe: null, title, errors: ["Tabela de escalas não encontrada ou ilegível."], warnings };
  errors.push(...table.errors);
  warnings.push(...table.warnings);
  const preparationMethod = extractPreparationMethod(pageText);
  if (!preparationMethod || preparationMethod.length < 20) errors.push("Modo de preparo ausente ou curto demais.");
  const ingredients: TechnicalSheetIngredientInput[] = table.ingredientRows.map((row, index) => ({
    product_id: null,
    ingredient_name: row.ingredientName,
    usage_quantity: row.values[0] ?? 0,
    usage_unit: normalizeUnit(row.unit, "G"),
    purchase_price: 0,
    purchase_quantity: 1,
    purchase_unit: normalizeUnit(row.unit, "G"),
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
      unit: normalizeUnit(row.unit, "G"),
      sort_order: ingredientIndex,
    })),
  }));
  const fallbackYield = table.yieldDescriptions[0]?.match(/\d+(?:[.,]\d+)?/)?.[0];
  const recipe: TechnicalSheetInput = {
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
    storage_instructions: extractStorage(pageText),
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
  };
  errors.push(...validateRecipePayload(recipe, table));
  if (errors.length > 0) return { recipe: null, title, errors, warnings };
  return { title, errors, warnings, recipe };
}

async function loadPdfParse() {
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
  if (typeof pdfParse !== "function") throw new Error('A versão instalada de "pdf-parse" não é compatível. Rode: npm install pdf-parse@1.1.1');
  return pdfParse;
}

function buildLinesFromTextItems(items: TextItem[]) {
  const rows = new Map<number, TextItem[]>();
  for (const item of items) {
    const value = typeof item?.str === "string" ? item.str : "";
    if (!value.trim()) continue;
    const y = typeof item?.transform?.[5] === "number" ? Math.round(item.transform[5]) : 0;
    const bucket = Array.from(rows.keys()).find((existing) => Math.abs(existing - y) <= 2) ?? y;
    const row = rows.get(bucket) ?? [];
    row.push(item);
    rows.set(bucket, row);
  }
  return Array.from(rows.entries())
    .sort(([a], [b]) => b - a)
    .map(([, rowItems]) => {
      const sorted = rowItems.sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0));
      let line = "";
      let previousEnd: number | null = null;
      for (const item of sorted) {
        const value = String(item.str ?? "");
        const x = item.transform?.[4] ?? 0;
        const width = item.width ?? value.length * 4;
        if (previousEnd !== null) {
          const gap = x - previousEnd;
          if (gap > 2) line += gap > 10 ? "  " : " ";
        }
        line += value;
        previousEnd = x + width;
      }
      return line.trim();
    })
    .filter(Boolean)
    .join("\n");
}

async function renderPdfPageText(pageData: any) {
  const textContent = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
  const pageText = buildLinesFromTextItems((textContent.items ?? []) as TextItem[]);
  return pageText || String((textContent.items ?? []).map((item: TextItem) => item.str ?? "").join("\n"));
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
  if (!rawText.trim()) throw new Error("Não foi possível extrair texto do PDF.");
  return splitFallbackPages(rawText);
}

function validateEditableRecipe(recipe: TechnicalSheetInput) {
  const errors: string[] = [];
  if (!recipe.name?.trim()) errors.push("Nome da ficha é obrigatório.");
  if (!recipe.preparation_method?.trim() || recipe.preparation_method.trim().length < 20) errors.push("Modo de preparo precisa ter pelo menos 20 caracteres.");
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 1) errors.push("Inclua pelo menos 1 ingrediente.");
  if (!Array.isArray(recipe.scales) || recipe.scales.length < 1) errors.push("Inclua pelo menos 1 escala.");
  for (const [index, ingredient] of (recipe.ingredients ?? []).entries()) {
    if (!ingredient.ingredient_name?.trim()) errors.push(`Ingrediente ${index + 1} está sem nome.`);
    if (!Number.isFinite(Number(ingredient.usage_quantity)) || Number(ingredient.usage_quantity) < 0) errors.push(`Ingrediente ${ingredient.ingredient_name || index + 1} tem quantidade inválida.`);
  }
  return errors;
}

export async function previewTechnicalSheetsFromPdfAction(formData: FormData): Promise<PreviewTechnicalSheetsFromPdfResult> {
  try {
    const file = formData.get("file");
    const defaultCategory = String(formData.get("defaultCategory") ?? "Importado PDF").trim();
    if (!(file instanceof File)) throw new Error("Envie um arquivo PDF válido.");
    const pages = await extractPdfPages(file);
    return {
      ok: true,
      pages: pages.map((pageText, index) => {
        const pageNumber = index + 1;
        const parsed = buildRecipeFromPage(pageText, pageNumber, file.name, defaultCategory);
        return {
          page: pageNumber,
          title: parsed.title,
          status: parsed.recipe ? "ready" : "blocked",
          reason: parsed.recipe ? null : parsed.errors.slice(0, 5).join(" | ") || "Página sem dados suficientes.",
          warnings: parsed.warnings,
          recipe: parsed.recipe,
        };
      }),
    };
  } catch (error: any) {
    console.error("[validatedPDFPreview] erro ao analisar PDF", error);
    return { ok: false, error: error?.message || "Não foi possível analisar o PDF." };
  }
}

export async function createTechnicalSheetsFromPreviewAction(formData: FormData): Promise<CreateTechnicalSheetsFromPreviewResult> {
  try {
    const rawRecipes = String(formData.get("recipes") ?? "");
    const recipesToCreate = JSON.parse(rawRecipes) as TechnicalSheetInput[];
    if (!Array.isArray(recipesToCreate) || recipesToCreate.length === 0) throw new Error("Nenhuma ficha aprovada para criar.");
    const recipes: Array<{ id: string; name: string; page: number | null }> = [];
    const ignoredPages: Array<{ page: number | null; title: string; reason: string }> = [];
    for (const recipe of recipesToCreate) {
      const errors = validateEditableRecipe(recipe);
      if (errors.length > 0) {
        ignoredPages.push({ page: recipe.source_page_number ?? null, title: recipe.name || "Ficha sem nome", reason: errors.join(" | ") });
        continue;
      }
      const created = await createTechnicalSheet(recipe);
      recipes.push({ id: String((created as any).id), name: recipe.name, page: recipe.source_page_number ?? null });
    }
    return { ok: true, importedCount: recipes.length, recipes, ignoredPages };
  } catch (error: any) {
    console.error("[validatedPDFConfirm] erro ao criar fichas aprovadas", error);
    return { ok: false, error: error?.message || "Não foi possível criar as fichas aprovadas." };
  }
}

export async function importTechnicalSheetsFromPdfAction(formData: FormData): Promise<ImportTechnicalSheetsFromPdfResult> {
  const preview = await previewTechnicalSheetsFromPdfAction(formData);
  if (!preview.ok) return preview;
  const recipesToCreate = preview.pages.filter((page) => page.status === "ready" && page.recipe).map((page) => page.recipe as TechnicalSheetInput);
  const confirmForm = new FormData();
  confirmForm.append("recipes", JSON.stringify(recipesToCreate));
  const created = await createTechnicalSheetsFromPreviewAction(confirmForm);
  if (!created.ok) return created;
  return {
    ok: true,
    importedCount: created.importedCount,
    recipes: created.recipes,
    ignoredPages: [
      ...preview.pages
        .filter((page) => page.status === "blocked")
        .map((page) => ({ page: page.page, title: page.title, reason: page.reason || "Página bloqueada para revisão." })),
      ...created.ignoredPages.map((page) => ({ page: page.page ?? 0, title: page.title, reason: page.reason })),
    ],
  };
}
