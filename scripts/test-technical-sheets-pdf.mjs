import fs from "node:fs";
import { createGeneralTechnicalSheetsPdf } from "../src/app/(dashboard)/dashboard/fichas-tecnicas/pdf-export.ts";

function createIngredient(id, name, usageQuantity, cost) {
  return {
    id,
    productId: null,
    nome: name,
    quantidadeUso: usageQuantity,
    unidadeUso: "KG",
    precoCompra: 10,
    quantidadeCompra: 1,
    unidadeCompra: "KG",
    custoUnitarioBase: 10,
    custoIngrediente: cost,
    fatorCorrecao: 1,
    fatorCoccao: 1,
  };
}

function createSheet(overrides) {
  return {
    id: "fixture-sheet",
    nome: "ABOBRINHA RALADA (PREP)",
    categoria: "Pré-Preparo",
    rendimento: 21.3,
    pesoPorcao: 0.02,
    tempoPreparo: 15,
    custoTotal: 4.54,
    custoPorPorcao: 0.21,
    margemLucro: 25,
    precoVenda: 0.85,
    modoPreparo: "Higienize, rale e armazene a abobrinha em recipiente identificado.",
    imageUrl: null,
    imagePath: null,
    difficultyLevel: "Fácil",
    temperatureCelsius: null,
    cookingTimeMinutes: null,
    cookingFactorGrams: null,
    correctionFactorGrams: 0.426,
    yieldLabel: null,
    portionWeightUnit: "KG",
    storageInstructions: "Resfriado",
    shelfLifeFrozen: null,
    shelfLifeRefrigerated: "3 dias",
    shelfLifeRoomTemp: null,
    allergens: null,
    sourceUpdatedAt: null,
    importOrigin: null,
    sourceFileName: null,
    sourcePageNumber: null,
    videoUrl: null,
    ingredientes: [createIngredient("ingredient-1", "ABOBRINHA", 0.916, 4.54)],
    escalas: [],
    createdAt: "2026-09-18T12:00:00.000Z",
    updatedAt: "2026-09-18T12:00:00.000Z",
    ...overrides,
  };
}

const fixtures = [
  createSheet({}),
  createSheet({
    id: "fixture-sheet-2",
    nome: "MOLHO DE TOMATE DA CASA",
    categoria: "Pré-Preparo",
    rendimento: 12,
    pesoPorcao: 0.15,
    correctionFactorGrams: 1.8,
    ingredientes: Array.from({ length: 34 }, (_, index) =>
      createIngredient(
        `ingredient-${index + 2}`,
        `INGREDIENTE DE TESTE ${String(index + 1).padStart(2, "0")}`,
        (index + 1) / 100,
        (index + 1) / 20
      )
    ),
    modoPreparo: Array.from(
      { length: 30 },
      (_, index) => `${index + 1}. Execute cuidadosamente esta etapa do preparo.`
    ).join("\n"),
  }),
];

const doc = await createGeneralTechnicalSheetsPdf(fixtures);
const bytes = Buffer.from(doc.output("arraybuffer"));

if (bytes.subarray(0, 4).toString("ascii") !== "%PDF") {
  throw new Error("A exportação não gerou um arquivo PDF válido.");
}

if (bytes.length < 5_000) {
  throw new Error(`PDF inesperadamente pequeno: ${bytes.length} bytes.`);
}

if (doc.getNumberOfPages() < fixtures.length) {
  throw new Error("Cada ficha técnica deve iniciar em uma página própria.");
}

const outputArgumentIndex = process.argv.indexOf("--output");
if (outputArgumentIndex >= 0) {
  const outputPath = process.argv[outputArgumentIndex + 1];
  if (!outputPath) throw new Error("Informe o caminho depois de --output.");
  fs.writeFileSync(outputPath, bytes);
}

console.log(
  `PDF geral validado: ${fixtures.length} fichas, ${doc.getNumberOfPages()} páginas, ${bytes.length} bytes.`
);
