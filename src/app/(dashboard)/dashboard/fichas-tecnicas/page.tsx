"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTechnicalSheet,
  deleteTechnicalSheet,
  deleteTechnicalSheetImageAction,
  duplicateTechnicalSheetAction,
  importTechnicalSheetsFromPdfAction,
  listTechnicalSheets,
  updateTechnicalSheet,
  uploadTechnicalSheetImageAction,
  type TechnicalSheetInput,
} from "./actions";
import { exportTechnicalSheetPdf } from "./pdf-export";

type ProductOption = {
  id: string;
  name: string;
  price?: number | null;
  default_unit_label?: string | null;
  sector_category?: string | null;
};

type Ingrediente = {
  id: string;
  productId: string | null;
  nome: string;
  quantidadeUso: number;
  unidadeUso: string;
  precoCompra: number;
  quantidadeCompra: number;
  unidadeCompra: string;
  custoUnitarioBase: number;
  custoIngrediente: number;
  fatorCorrecao: number;
  fatorCoccao: number;
};

type EscalaIngrediente = {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
};

type EscalaFicha = {
  id: string;
  label: string;
  rendimentoDescricao: string | null;
  pesoLiquido: number | null;
  ingredientes: EscalaIngrediente[];
};

type FichaTecnica = {
  id: string;
  nome: string;
  categoria: string;
  rendimento: number;
  pesoPorcao: number;
  tempoPreparo: number;
  custoTotal: number;
  custoPorPorcao: number;
  margemLucro: number;
  precoVenda: number;
  modoPreparo: string;
  imageUrl: string | null;
  imagePath: string | null;

  difficultyLevel: string | null;
  temperatureCelsius: number | null;
  cookingTimeMinutes: number | null;
  cookingFactorGrams: number | null;
  correctionFactorGrams: number | null;
  yieldLabel: string | null;
  portionWeightUnit: string | null;
  storageInstructions: string | null;
  shelfLifeFrozen: string | null;
  shelfLifeRefrigerated: string | null;
  shelfLifeRoomTemp: string | null;
  allergens: string | null;
  sourceUpdatedAt: string | null;
  importOrigin: string | null;
  sourceFileName: string | null;
  sourcePageNumber: number | null;
  videoUrl: string | null;

  ingredientes: Ingrediente[];
  escalas: EscalaFicha[];

  createdAt: string;
  updatedAt: string;
};

type ViewerTab = "ingredientes" | "preparo" | "escalas";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function normalizeUnit(value: unknown, fallback = "UN") {
  const unit = String(value ?? "").trim().toUpperCase();
  return unit || fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function calcularCMV(custoPorPorcao: number, precoVenda: number) {
  if (!precoVenda || precoVenda <= 0) return 0;
  return (custoPorPorcao / precoVenda) * 100;
}

function calcularLucroUnitario(precoVenda: number, custoPorPorcao: number) {
  return (precoVenda || 0) - (custoPorPorcao || 0);
}

function calcularCustos(
  ingredientes: Ingrediente[],
  rendimento: number,
  margemLucro: number
) {
  const custoTotal = ingredientes.reduce(
    (acc, item) => acc + (item.custoIngrediente || 0),
    0
  );

  const custoPorPorcao =
    rendimento > 0 ? Number((custoTotal / rendimento).toFixed(2)) : 0;

  const precoVenda =
    margemLucro >= 0
      ? Number((custoPorPorcao * (1 + margemLucro / 100)).toFixed(2))
      : 0;

  return {
    custoTotal: Number(custoTotal.toFixed(2)),
    custoPorPorcao,
    precoVenda,
  };
}

function calcularCustoIngrediente(input: {
  quantidadeUso: number;
  precoCompra: number;
  quantidadeCompra: number;
  fatorCorrecao: number;
  fatorCoccao: number;
}) {
  const quantidadeUso = toNumber(input.quantidadeUso, 0);
  const precoCompra = toNumber(input.precoCompra, 0);
  const quantidadeCompra = toNumber(input.quantidadeCompra, 0);
  const fatorCorrecao = toNumber(input.fatorCorrecao, 1) || 1;
  const fatorCoccao = toNumber(input.fatorCoccao, 1) || 1;

  if (quantidadeCompra <= 0 || quantidadeUso <= 0) {
    return {
      custoUnitarioBase: 0,
      custoIngrediente: 0,
    };
  }

  const custoUnitarioBase = precoCompra / quantidadeCompra;
  const custoIngrediente =
    quantidadeUso * custoUnitarioBase * fatorCorrecao * fatorCoccao;

  return {
    custoUnitarioBase: Number(custoUnitarioBase.toFixed(6)),
    custoIngrediente: Number(custoIngrediente.toFixed(2)),
  };
}

function normalizeFichaFromDb(raw: any): FichaTecnica {
  return {
    id: String(raw.id),
    nome: String(raw.name ?? ""),
    categoria: String(raw.category ?? ""),
    rendimento: Number(raw.yield_portions ?? 0),
    pesoPorcao: Number(raw.portion_weight ?? 0),
    tempoPreparo: Number(raw.prep_time_minutes ?? 0),
    custoTotal: Number(raw.total_cost ?? 0),
    custoPorPorcao: Number(raw.cost_per_portion ?? 0),
    margemLucro: Number(raw.profit_margin_percent ?? 0),
    precoVenda: Number(raw.sale_price ?? 0),
    modoPreparo: String(raw.preparation_method ?? ""),
    imageUrl: raw.image_url ? String(raw.image_url) : null,
    imagePath: raw.image_path ? String(raw.image_path) : null,

    difficultyLevel: raw.difficulty_level ? String(raw.difficulty_level) : null,
    temperatureCelsius:
      raw.temperature_celsius !== null && raw.temperature_celsius !== undefined
        ? Number(raw.temperature_celsius)
        : null,
    cookingTimeMinutes:
      raw.cooking_time_minutes !== null && raw.cooking_time_minutes !== undefined
        ? Number(raw.cooking_time_minutes)
        : null,
    cookingFactorGrams:
      raw.cooking_factor_grams !== null &&
      raw.cooking_factor_grams !== undefined
        ? Number(raw.cooking_factor_grams)
        : null,
    correctionFactorGrams:
      raw.correction_factor_grams !== null &&
      raw.correction_factor_grams !== undefined
        ? Number(raw.correction_factor_grams)
        : null,
    yieldLabel: raw.yield_label ? String(raw.yield_label) : null,
    portionWeightUnit: raw.portion_weight_unit
      ? String(raw.portion_weight_unit).toUpperCase()
      : null,
    storageInstructions: raw.storage_instructions
      ? String(raw.storage_instructions)
      : null,
    shelfLifeFrozen: raw.shelf_life_frozen ? String(raw.shelf_life_frozen) : null,
    shelfLifeRefrigerated: raw.shelf_life_refrigerated
      ? String(raw.shelf_life_refrigerated)
      : null,
    shelfLifeRoomTemp: raw.shelf_life_room_temp
      ? String(raw.shelf_life_room_temp)
      : null,
    allergens: raw.allergens ? String(raw.allergens) : null,
    sourceUpdatedAt: raw.source_updated_at ? String(raw.source_updated_at) : null,
    importOrigin: raw.import_origin ? String(raw.import_origin) : null,
    sourceFileName: raw.source_file_name ? String(raw.source_file_name) : null,
    sourcePageNumber:
      raw.source_page_number !== null && raw.source_page_number !== undefined
        ? Number(raw.source_page_number)
        : null,
    videoUrl: raw.video_url ? String(raw.video_url) : null,

    ingredientes: Array.isArray(raw.ingredients)
      ? raw.ingredients
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((i: any) => ({
            id: String(i.id),
            productId: i.product_id ? String(i.product_id) : null,
            nome: String(i.ingredient_name ?? ""),
            quantidadeUso: Number(i.usage_quantity ?? 0),
            unidadeUso: normalizeUnit(i.usage_unit, "UN"),
            precoCompra: Number(i.purchase_price ?? 0),
            quantidadeCompra: Number(i.purchase_quantity ?? 1),
            unidadeCompra: normalizeUnit(i.purchase_unit, "UN"),
            custoUnitarioBase: Number(i.base_unit_cost ?? 0),
            custoIngrediente: Number(i.final_cost ?? 0),
            fatorCorrecao: Number(i.correction_factor ?? 1),
            fatorCoccao: Number(i.cooking_factor ?? 1),
          }))
      : [],

    escalas: Array.isArray(raw.scales)
      ? raw.scales
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((scale: any) => ({
            id: String(scale.id),
            label: String(scale.scale_label ?? ""),
            rendimentoDescricao: scale.yield_description
              ? String(scale.yield_description)
              : null,
            pesoLiquido:
              scale.net_weight !== null && scale.net_weight !== undefined
                ? Number(scale.net_weight)
                : null,
            ingredientes: Array.isArray(scale.ingredients)
              ? scale.ingredients
                  .sort(
                    (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
                  )
                  .map((ing: any) => ({
                    id: String(ing.id),
                    nome: String(ing.ingredient_name ?? ""),
                    quantidade: Number(ing.amount ?? 0),
                    unidade: normalizeUnit(ing.unit, "G"),
                  }))
              : [],
          }))
      : [],

    createdAt: String(raw.created_at ?? ""),
    updatedAt: String(raw.updated_at ?? ""),
  };
}

function toActionPayload(
  ficha: Omit<FichaTecnica, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  }
): TechnicalSheetInput {
  return {
    id: ficha.id,
    name: ficha.nome,
    category: ficha.categoria,
    yield_portions: ficha.rendimento,
    portion_weight: ficha.pesoPorcao,
    prep_time_minutes: ficha.tempoPreparo,
    profit_margin_percent: ficha.margemLucro,
    sale_price: ficha.precoVenda,
    total_cost: ficha.custoTotal,
    cost_per_portion: ficha.custoPorPorcao,
    preparation_method: ficha.modoPreparo,
    image_url: ficha.imageUrl || null,
    image_path: ficha.imagePath || null,

    difficulty_level: ficha.difficultyLevel,
    temperature_celsius: ficha.temperatureCelsius,
    cooking_time_minutes: ficha.cookingTimeMinutes,
    cooking_factor_grams: ficha.cookingFactorGrams,
    correction_factor_grams: ficha.correctionFactorGrams,
    yield_label: ficha.yieldLabel,
    portion_weight_unit: ficha.portionWeightUnit,
    storage_instructions: ficha.storageInstructions,
    shelf_life_frozen: ficha.shelfLifeFrozen,
    shelf_life_refrigerated: ficha.shelfLifeRefrigerated,
    shelf_life_room_temp: ficha.shelfLifeRoomTemp,
    allergens: ficha.allergens,
    source_updated_at: ficha.sourceUpdatedAt,
    import_origin: ficha.importOrigin,
    source_file_name: ficha.sourceFileName,
    source_page_number: ficha.sourcePageNumber,
    video_url: ficha.videoUrl,

    ingredients: ficha.ingredientes.map((item, index) => ({
      product_id: item.productId,
      ingredient_name: item.nome,
      usage_quantity: item.quantidadeUso,
      usage_unit: item.unidadeUso,
      purchase_price: item.precoCompra,
      purchase_quantity: item.quantidadeCompra,
      purchase_unit: item.unidadeCompra,
      correction_factor: item.fatorCorrecao,
      cooking_factor: item.fatorCoccao,
      base_unit_cost: item.custoUnitarioBase,
      final_cost: item.custoIngrediente,
      sort_order: index,
    })),

    scales: ficha.escalas.map((scale, index) => ({
      scale_label: scale.label,
      yield_description: scale.rendimentoDescricao,
      net_weight: scale.pesoLiquido,
      sort_order: index,
      ingredients: scale.ingredientes.map((item, ingIndex) => ({
        ingredient_name: item.nome,
        amount: item.quantidade,
        unit: item.unidade,
        sort_order: ingIndex,
      })),
    })),
  };
}

function escapeCsv(val: unknown) {
  const s = String(val ?? "");
  if (/[",;\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getScaledFicha(ficha: FichaTecnica, servings: number) {
  const safeServings = Math.max(1, toNumber(servings, 1));
  const factor =
    ficha.rendimento > 0
      ? Number((safeServings / ficha.rendimento).toFixed(4))
      : 1;

  const ingredientesEscalados = ficha.ingredientes.map((item) => ({
    ...item,
    quantidadeUso: Number((item.quantidadeUso * factor).toFixed(3)),
    custoIngrediente: Number((item.custoIngrediente * factor).toFixed(2)),
  }));

  const custoTotal = Number(
    ingredientesEscalados
      .reduce((acc, item) => acc + item.custoIngrediente, 0)
      .toFixed(2)
  );

  return {
    factor,
    servings: safeServings,
    ingredientes: ingredientesEscalados,
    custoTotal,
  };
}

function buildPrintHtml(
  ficha: FichaTecnica,
  desiredServings: number,
  currentTab: ViewerTab
) {
  const scaled = getScaledFicha(ficha, desiredServings);
  const cmv = calcularCMV(ficha.custoPorPorcao, ficha.precoVenda);
  const lucro = calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao);

  const metadataHtml = `
    <div class="grid">
      <div class="box"><div class="label">Temperatura</div><div class="value">${
        ficha.temperatureCelsius !== null ? `${ficha.temperatureCelsius} ºC` : "—"
      }</div></div>
      <div class="box"><div class="label">Tempo de cocção</div><div class="value">${
        ficha.cookingTimeMinutes !== null ? `${ficha.cookingTimeMinutes} min` : "—"
      }</div></div>
      <div class="box"><div class="label">Fator de cocção</div><div class="value">${
        ficha.cookingFactorGrams !== null ? `${ficha.cookingFactorGrams} g` : "—"
      }</div></div>
      <div class="box"><div class="label">Fator de correção</div><div class="value">${
        ficha.correctionFactorGrams !== null
          ? `${ficha.correctionFactorGrams} g`
          : "—"
      }</div></div>
    </div>

    <div class="grid">
      <div class="box"><div class="label">Dificuldade</div><div class="value">${
        ficha.difficultyLevel || "—"
      }</div></div>
      <div class="box"><div class="label">Armazenamento</div><div class="value">${
        ficha.storageInstructions || "—"
      }</div></div>
      <div class="box"><div class="label">Validade congelado</div><div class="value">${
        ficha.shelfLifeFrozen || "—"
      }</div></div>
      <div class="box"><div class="label">Validade refrigerado</div><div class="value">${
        ficha.shelfLifeRefrigerated || "—"
      }</div></div>
    </div>

    <div class="grid">
      <div class="box"><div class="label">Validade ambiente</div><div class="value">${
        ficha.shelfLifeRoomTemp || "—"
      }</div></div>
      <div class="box"><div class="label">Alergênicos</div><div class="value">${
        ficha.allergens || "—"
      }</div></div>
      <div class="box"><div class="label">Yield label</div><div class="value">${
        ficha.yieldLabel || "—"
      }</div></div>
      <div class="box"><div class="label">Atualizado em</div><div class="value" style="font-size:14px;">${formatDate(
        ficha.sourceUpdatedAt || ficha.updatedAt
      )}</div></div>
    </div>
  `;

  const scalesHtml = `
    <h2 class="section-title">Escalas</h2>
    ${
      ficha.escalas.length === 0
        ? `<p class="muted">Nenhuma escala cadastrada.</p>`
        : ficha.escalas
            .map(
              (scale) => `
        <div class="box" style="margin-bottom:16px;">
          <div class="value" style="font-size:20px;">${scale.label}</div>
          <div class="muted" style="margin-top:6px;">
            Rendimento: ${scale.rendimentoDescricao || "—"} | Peso líquido: ${
                scale.pesoLiquido !== null ? `${scale.pesoLiquido} g` : "—"
              }
          </div>
          ${
            scale.ingredientes.length
              ? `
              <table style="margin-top:12px;">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Quantidade</th>
                    <th>Unidade</th>
                  </tr>
                </thead>
                <tbody>
                  ${scale.ingredientes
                    .map(
                      (ing) => `
                      <tr>
                        <td>${ing.nome}</td>
                        <td>${ing.quantidade}</td>
                        <td>${ing.unidade}</td>
                      </tr>
                    `
                    )
                    .join("")}
                </tbody>
              </table>
            `
              : `<p class="muted" style="margin-top:12px;">Sem ingredientes cadastrados nesta escala.</p>`
          }
        </div>
      `
            )
            .join("")
    }
  `;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ficha Técnica - ${ficha.nome}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 24px;
    color: #111827;
    background: #ffffff;
  }
  .hero {
    width: 100%;
    max-height: 320px;
    overflow: hidden;
    border-radius: 16px;
    margin-bottom: 20px;
    border: 1px solid #e5e7eb;
  }
  .hero img {
    width: 100%;
    height: 320px;
    object-fit: cover;
    display: block;
  }
  .header {
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .title {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 6px 0;
  }
  .subtitle {
    color: #6b7280;
    font-size: 14px;
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  .box {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px;
  }
  .label {
    color: #6b7280;
    font-size: 12px;
    margin-bottom: 6px;
  }
  .value {
    font-size: 18px;
    font-weight: 700;
  }
  .section-title {
    font-size: 18px;
    margin: 24px 0 12px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    border: 1px solid #e5e7eb;
    padding: 10px 8px;
    font-size: 12px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #f9fafb;
  }
  .right { text-align: right; }
  .prep {
    white-space: pre-wrap;
    line-height: 1.6;
    font-size: 14px;
  }
  .muted {
    color: #6b7280;
    font-size: 12px;
  }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  ${
    ficha.imageUrl
      ? `
      <div class="hero">
        <img src="${ficha.imageUrl}" alt="${ficha.nome}" />
      </div>
    `
      : ""
  }

  <div class="header">
    <h1 class="title">${ficha.nome}</h1>
    <p class="subtitle">${ficha.categoria || "Sem categoria"}</p>
    <p class="muted">Rendimento original: ${ficha.rendimento} porções | Impressão ajustada para: ${scaled.servings} porções</p>
  </div>

  <div class="grid">
    <div class="box">
      <div class="label">Custo total</div>
      <div class="value">${formatCurrency(scaled.custoTotal)}</div>
    </div>
    <div class="box">
      <div class="label">Custo por porção</div>
      <div class="value">${formatCurrency(ficha.custoPorPorcao)}</div>
    </div>
    <div class="box">
      <div class="label">Preço de venda</div>
      <div class="value">${formatCurrency(ficha.precoVenda)}</div>
    </div>
    <div class="box">
      <div class="label">CMV</div>
      <div class="value">${cmv.toFixed(1)}%</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="label">Peso por porção</div>
      <div class="value">${ficha.pesoPorcao} ${ficha.portionWeightUnit || "G"}</div>
    </div>
    <div class="box">
      <div class="label">Tempo de preparo</div>
      <div class="value">${ficha.tempoPreparo} min</div>
    </div>
    <div class="box">
      <div class="label">Lucro unitário</div>
      <div class="value">${formatCurrency(lucro)}</div>
    </div>
    <div class="box">
      <div class="label">Atualizado em</div>
      <div class="value" style="font-size:14px;">${formatDate(
        ficha.sourceUpdatedAt || ficha.updatedAt
      )}</div>
    </div>
  </div>

  ${metadataHtml}

  ${
    currentTab === "ingredientes"
      ? `
      <h2 class="section-title">Ingredientes</h2>
      <table>
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th>Uso ajustado</th>
            <th>Compra</th>
            <th class="right">Preço compra</th>
            <th class="right">Custo unitário</th>
            <th class="right">Custo final</th>
          </tr>
        </thead>
        <tbody>
          ${scaled.ingredientes
            .map(
              (i) => `
                <tr>
                  <td>${i.nome}</td>
                  <td>${i.quantidadeUso} ${i.unidadeUso}</td>
                  <td>${i.quantidadeCompra} ${i.unidadeCompra}</td>
                  <td class="right">${formatCurrency(i.precoCompra)}</td>
                  <td class="right">${formatCurrency(i.custoUnitarioBase)}</td>
                  <td class="right">${formatCurrency(i.custoIngrediente)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
      `
      : currentTab === "preparo"
      ? `
      <h2 class="section-title">Modo de preparo</h2>
      <div class="prep">${(ficha.modoPreparo || "Não informado.").replace(
        /</g,
        "&lt;"
      )}</div>
      `
      : scalesHtml
  }

  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>
  `.trim();
}

function EscalasViewer({ escalas }: { escalas: EscalaFicha[] }) {
  if (!escalas.length) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Nenhuma escala cadastrada para esta ficha.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {escalas.map((scale) => (
        <div key={scale.id} className="rounded-xl border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-lg font-semibold">{scale.label}</h4>
              <p className="text-sm text-muted-foreground">
                Rendimento: {scale.rendimentoDescricao || "—"} • Peso líquido:{" "}
                {scale.pesoLiquido !== null ? `${scale.pesoLiquido} g` : "—"}
              </p>
            </div>
            <Badge variant="secondary">
              {scale.ingredientes.length} ingrediente
              {scale.ingredientes.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {scale.ingredientes.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingrediente</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Unidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scale.ingredientes.map((ing) => (
                    <TableRow key={ing.id}>
                      <TableCell className="font-medium">{ing.nome}</TableCell>
                      <TableCell>{ing.quantidade}</TableCell>
                      <TableCell>{ing.unidade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Sem ingredientes cadastrados nesta escala.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function RecipeViewer({
  ficha,
  desiredServings,
  setDesiredServings,
  currentTab,
  setCurrentTab,
  onEdit,
  onPrint,
  onExportPdf,
  onDuplicate,
  onFullscreen,
  onDelete,
}: {
  ficha: FichaTecnica | null;
  desiredServings: number;
  setDesiredServings: (value: number) => void;
  currentTab: ViewerTab;
  setCurrentTab: (value: ViewerTab) => void;
  onEdit: (ficha: FichaTecnica) => void;
  onPrint: (ficha: FichaTecnica) => void;
  onExportPdf: (ficha: FichaTecnica) => void;
  onDuplicate: (ficha: FichaTecnica) => void;
  onFullscreen: (ficha: FichaTecnica) => void;
  onDelete: (ficha: FichaTecnica) => void;
}) {
  if (!ficha) {
    return (
      <Card className="min-h-[520px] border-dashed">
        <CardContent className="flex h-full min-h-[520px] items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="mb-3 text-4xl">📄</div>
            <h3 className="text-lg font-semibold">Selecione uma ficha técnica</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Escolha uma ficha na lista para visualizar ingredientes, modo de preparo,
              escalas, custos, vídeo, impressão, exportação em PDF, duplicação,
              foto do prato e visualização em tela cheia.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scaled = getScaledFicha(ficha, desiredServings);
  const cmv = calcularCMV(ficha.custoPorPorcao, ficha.precoVenda);
  const lucro = calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao);

  return (
    <Card className="overflow-hidden">
      {ficha.imageUrl ? (
        <div className="relative h-[260px] w-full border-b bg-slate-100 sm:h-[320px]">
          <Image
            src={ficha.imageUrl}
            alt={ficha.nome}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex h-[180px] items-center justify-center border-b bg-slate-100 text-sm text-muted-foreground">
          Sem imagem do prato
        </div>
      )}

      <div className="border-b bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-bold text-gray-900">
                {ficha.nome}
              </h2>
              <Badge variant="secondary">{ficha.categoria || "Sem categoria"}</Badge>
              {ficha.difficultyLevel ? (
                <Badge variant="outline">
                  Dificuldade: {ficha.difficultyLevel}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Última atualização:{" "}
              {formatDate(ficha.sourceUpdatedAt || ficha.updatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
  {ficha.videoUrl ? (
    <Button
      type="button"
      variant="outline"
      onClick={() =>
        window.open(ficha.videoUrl || "", "_blank", "noopener,noreferrer")
      }
    >
      ▶️ Vídeo
    </Button>
  ) : null}

  <Button type="button" variant="outline" onClick={() => onEdit(ficha)}>
    ✏️ Editar
  </Button>
  <Button type="button" variant="outline" onClick={() => onPrint(ficha)}>
    🖨️ Imprimir
  </Button>
  <Button
    type="button"
    variant="outline"
    onClick={() => onExportPdf(ficha)}
  >
    📄 Exportar PDF
  </Button>
  <Button
    type="button"
    variant="outline"
    onClick={() => onDuplicate(ficha)}
  >
    📑 Duplicar
  </Button>
  <Button type="button" onClick={() => onFullscreen(ficha)}>
    ⛶ Tela cheia
  </Button>
  <Button
    type="button"
    variant="destructive"
    className="bg-red-600 text-white hover:bg-red-700"
    onClick={() => onDelete(ficha)}
  >
    🗑️ Excluir
  </Button>
</div>
        </div>
      </div>

      <CardContent className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">Custo total</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {formatCurrency(scaled.custoTotal)}
            </p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">Custo por porção</p>
            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(ficha.custoPorPorcao)}
            </p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">Preço de venda</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatCurrency(ficha.precoVenda)}
            </p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">CMV</p>
            <p className="mt-1 text-2xl font-bold">{cmv.toFixed(1)}%</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">Lucro unitário</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              {formatCurrency(lucro)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Rendimento original</p>
            <p className="mt-1 text-lg font-semibold">
              {ficha.rendimento} porções
              {ficha.yieldLabel ? ` • ${ficha.yieldLabel}` : ""}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Peso por porção</p>
            <p className="mt-1 text-lg font-semibold">
              {ficha.pesoPorcao} {ficha.portionWeightUnit || "G"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Tempo de preparo</p>
            <p className="mt-1 text-lg font-semibold">{ficha.tempoPreparo} min</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Temperatura</p>
            <p className="mt-1 text-lg font-semibold">
              {ficha.temperatureCelsius !== null
                ? `${ficha.temperatureCelsius} ºC`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Tempo de cocção</p>
            <p className="mt-1 text-lg font-semibold">
              {ficha.cookingTimeMinutes !== null
                ? `${ficha.cookingTimeMinutes} min`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Fator de cocção</p>
            <p className="mt-1 text-lg font-semibold">
              {ficha.cookingFactorGrams !== null
                ? `${ficha.cookingFactorGrams} g`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Fator de correção</p>
            <p className="mt-1 text-lg font-semibold">
              {ficha.correctionFactorGrams !== null
                ? `${ficha.correctionFactorGrams} g`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Armazenamento</p>
            <p className="mt-1 text-base font-semibold">
              {ficha.storageInstructions || "—"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Validade congelado</p>
            <p className="mt-1 text-base font-semibold">
              {ficha.shelfLifeFrozen || "—"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Validade refrigerado</p>
            <p className="mt-1 text-base font-semibold">
              {ficha.shelfLifeRefrigerated || "—"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Validade ambiente</p>
            <p className="mt-1 text-base font-semibold">
              {ficha.shelfLifeRoomTemp || "—"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Alergênicos</p>
          <p className="mt-1 text-base font-semibold">
            {ficha.allergens || "—"}
          </p>

          {ficha.importOrigin ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Importado via {ficha.importOrigin}
              {ficha.sourceFileName ? ` • arquivo: ${ficha.sourceFileName}` : ""}
              {ficha.sourcePageNumber ? ` • página: ${ficha.sourcePageNumber}` : ""}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Label htmlFor="desired-servings">Rendimento desejado</Label>
              <p className="text-xs text-muted-foreground">
                Ajusta visualização dos ingredientes e custo total da produção.
              </p>
            </div>

            <div className="flex w-full max-w-xs items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDesiredServings(Math.max(1, desiredServings - 1))}
              >
                −
              </Button>
              <Input
                id="desired-servings"
                type="number"
                min={1}
                value={desiredServings}
                onChange={(e) =>
                  setDesiredServings(Math.max(1, toNumber(e.target.value, 1)))
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setDesiredServings(desiredServings + 1)}
              >
                +
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-muted-foreground">Produção ajustada</p>
              <p className="text-lg font-bold">{scaled.servings} porções</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-muted-foreground">Fator aplicado</p>
              <p className="text-lg font-bold">{scaled.factor.toFixed(3)}x</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-muted-foreground">Escalas cadastradas</p>
              <p className="text-lg font-bold">{ficha.escalas.length}</p>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4 flex gap-2 border-b">
            <button
              type="button"
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                currentTab === "ingredientes"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
              onClick={() => setCurrentTab("ingredientes")}
            >
              Ingredientes
            </button>
            <button
              type="button"
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                currentTab === "preparo"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
              onClick={() => setCurrentTab("preparo")}
            >
              Modo de preparo
            </button>
            <button
              type="button"
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                currentTab === "escalas"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
              onClick={() => setCurrentTab("escalas")}
            >
              Escalas
            </button>
          </div>

          {currentTab === "ingredientes" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingrediente</TableHead>
                    <TableHead>Uso ajustado</TableHead>
                    <TableHead>Compra</TableHead>
                    <TableHead>Preço compra</TableHead>
                    <TableHead>Custo unit.</TableHead>
                    <TableHead>Custo final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scaled.ingredientes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        Nenhum ingrediente cadastrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    scaled.ingredientes.map((ingrediente) => (
                      <TableRow key={ingrediente.id}>
                        <TableCell className="font-medium">
                          {ingrediente.nome}
                        </TableCell>
                        <TableCell>
                          {ingrediente.quantidadeUso} {ingrediente.unidadeUso}
                        </TableCell>
                        <TableCell>
                          {ingrediente.quantidadeCompra}{" "}
                          {ingrediente.unidadeCompra}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(ingrediente.precoCompra)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(ingrediente.custoUnitarioBase)}
                        </TableCell>
                        <TableCell className="font-medium text-red-600">
                          {formatCurrency(ingrediente.custoIngrediente)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : currentTab === "preparo" ? (
            <div className="rounded-xl border bg-slate-50 p-5">
              <p className="whitespace-pre-wrap leading-7 text-sm text-gray-700">
                {ficha.modoPreparo || "Não informado."}
              </p>
            </div>
          ) : (
            <EscalasViewer escalas={ficha.escalas} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
function ScaleEditor({
  scales,
  onChange,
}: {
  scales: EscalaFicha[];
  onChange: (scales: EscalaFicha[]) => void;
}) {
  const addScale = () => {
    onChange([
      ...scales,
      {
        id: uid(),
        label: `Escala ${scales.length + 1}`,
        rendimentoDescricao: "",
        pesoLiquido: null,
        ingredientes: [],
      },
    ]);
  };

  const updateScale = (scaleId: string, patch: Partial<EscalaFicha>) => {
    onChange(
      scales.map((scale) => (scale.id === scaleId ? { ...scale, ...patch } : scale))
    );
  };

  const removeScale = (scaleId: string) => {
    onChange(scales.filter((scale) => scale.id !== scaleId));
  };

  const addScaleIngredient = (scaleId: string) => {
    onChange(
      scales.map((scale) =>
        scale.id === scaleId
          ? {
              ...scale,
              ingredientes: [
                ...scale.ingredientes,
                {
                  id: uid(),
                  nome: "",
                  quantidade: 0,
                  unidade: "G",
                },
              ],
            }
          : scale
      )
    );
  };

  const updateScaleIngredient = (
    scaleId: string,
    ingredientId: string,
    patch: Partial<EscalaIngrediente>
  ) => {
    onChange(
      scales.map((scale) =>
        scale.id === scaleId
          ? {
              ...scale,
              ingredientes: scale.ingredientes.map((ingredient) =>
                ingredient.id === ingredientId
                  ? { ...ingredient, ...patch }
                  : ingredient
              ),
            }
          : scale
      )
    );
  };

  const removeScaleIngredient = (scaleId: string, ingredientId: string) => {
    onChange(
      scales.map((scale) =>
        scale.id === scaleId
          ? {
              ...scale,
              ingredientes: scale.ingredientes.filter(
                (ingredient) => ingredient.id !== ingredientId
              ),
            }
          : scale
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-semibold">Escalas</h4>
          <p className="text-sm text-muted-foreground">
            Cadastre 1X, 2X, 3X ou qualquer outra escala da ficha.
          </p>
        </div>

        <Button type="button" variant="outline" onClick={addScale}>
          ➕ Adicionar escala
        </Button>
      </div>

      {scales.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Nenhuma escala cadastrada ainda.
        </div>
      ) : (
        scales.map((scale) => (
          <div key={scale.id} className="rounded-xl border p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <Label>Label</Label>
                <Input
                  value={scale.label}
                  onChange={(e) => updateScale(scale.id, { label: e.target.value })}
                  placeholder="Ex.: 1X"
                />
              </div>

              <div>
                <Label>Rendimento</Label>
                <Input
                  value={scale.rendimentoDescricao ?? ""}
                  onChange={(e) =>
                    updateScale(scale.id, {
                      rendimentoDescricao: e.target.value || null,
                    })
                  }
                  placeholder="Ex.: 4 assadeiras"
                />
              </div>

              <div>
                <Label>Peso líquido</Label>
                <Input
                  type="number"
                  value={scale.pesoLiquido ?? ""}
                  onChange={(e) =>
                    updateScale(scale.id, {
                      pesoLiquido:
                        e.target.value === "" ? null : toNumber(e.target.value, 0),
                    })
                  }
                  placeholder="Ex.: 1200"
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => removeScale(scale.id)}
                >
                  Remover escala
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Ingredientes da escala</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addScaleIngredient(scale.id)}
                >
                  Adicionar ingrediente
                </Button>
              </div>

              {scale.ingredientes.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">
                  Nenhum ingrediente cadastrado para esta escala.
                </div>
              ) : (
                <div className="space-y-3">
                  {scale.ingredientes.map((ingredient) => (
                    <div
                      key={ingredient.id}
                      className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[2fr_1fr_1fr_auto]"
                    >
                      <div>
                        <Label>Ingrediente</Label>
                        <Input
                          value={ingredient.nome}
                          onChange={(e) =>
                            updateScaleIngredient(scale.id, ingredient.id, {
                              nome: e.target.value,
                            })
                          }
                          placeholder="Nome do ingrediente"
                        />
                      </div>

                      <div>
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          value={ingredient.quantidade}
                          onChange={(e) =>
                            updateScaleIngredient(scale.id, ingredient.id, {
                              quantidade: toNumber(e.target.value, 0),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label>Unidade</Label>
                        <Input
                          value={ingredient.unidade}
                          onChange={(e) =>
                            updateScaleIngredient(scale.id, ingredient.id, {
                              unidade: normalizeUnit(e.target.value, "G"),
                            })
                          }
                        />
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            removeScaleIngredient(scale.id, ingredient.id)
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function IngredientEditor({
  products,
  ingredientes,
  onChange,
}: {
  products: ProductOption[];
  ingredientes: Ingrediente[];
  onChange: (ingredientes: Ingrediente[]) => void;
}) {
  const [showIngredientForm, setShowIngredientForm] = useState(
    ingredientes.length === 0
  );
  const [editandoIngredienteId, setEditandoIngredienteId] = useState<string | null>(
    null
  );
  const [draftIngredienteId, setDraftIngredienteId] = useState("");
  const [draftIngredienteNome, setDraftIngredienteNome] = useState("");
  const [draftQuantidadeUso, setDraftQuantidadeUso] = useState<number>(0);
  const [draftUnidadeUso, setDraftUnidadeUso] = useState("UN");
  const [draftPrecoCompra, setDraftPrecoCompra] = useState<number>(0);
  const [draftQuantidadeCompra, setDraftQuantidadeCompra] = useState<number>(1);
  const [draftUnidadeCompra, setDraftUnidadeCompra] = useState("UN");
  const [draftFCorrecao, setDraftFCorrecao] = useState<number>(1);
  const [draftFCoccao, setDraftFCoccao] = useState<number>(1);

  const previewIngrediente = useMemo(() => {
    return calcularCustoIngrediente({
      quantidadeUso: draftQuantidadeUso,
      precoCompra: draftPrecoCompra,
      quantidadeCompra: draftQuantidadeCompra,
      fatorCorrecao: draftFCorrecao,
      fatorCoccao: draftFCoccao,
    });
  }, [
    draftQuantidadeUso,
    draftPrecoCompra,
    draftQuantidadeCompra,
    draftFCorrecao,
    draftFCoccao,
  ]);

  useEffect(() => {
    if (ingredientes.length === 0) {
      setShowIngredientForm(true);
    }
  }, [ingredientes.length]);

  const resetDraftIngrediente = () => {
    setEditandoIngredienteId(null);
    setDraftIngredienteId("");
    setDraftIngredienteNome("");
    setDraftQuantidadeUso(0);
    setDraftUnidadeUso("UN");
    setDraftPrecoCompra(0);
    setDraftQuantidadeCompra(1);
    setDraftUnidadeCompra("UN");
    setDraftFCorrecao(1);
    setDraftFCoccao(1);
  };

  const iniciarNovoIngrediente = () => {
    resetDraftIngrediente();
    setShowIngredientForm(true);
  };

  const onSelectProductIngredient = (productId: string) => {
    setDraftIngredienteId(productId);

    const p = products.find((item) => item.id === productId);
    if (!p) return;

    const unit = normalizeUnit(p.default_unit_label, "UN");

    setDraftIngredienteNome(p.name);
    setDraftUnidadeUso(unit);
    setDraftUnidadeCompra(unit);
    setDraftPrecoCompra(Number(p.price ?? 0));
    setDraftQuantidadeCompra(1);
  };

  const salvarIngrediente = () => {
    const quantidadeUso = toNumber(draftQuantidadeUso, 0);
    const precoCompra = toNumber(draftPrecoCompra, 0);
    const quantidadeCompra = toNumber(draftQuantidadeCompra, 0);
    const fatorCorrecao = toNumber(draftFCorrecao, 1) || 1;
    const fatorCoccao = toNumber(draftFCoccao, 1) || 1;

    if (!draftIngredienteNome.trim()) {
      alert("Selecione ou informe um ingrediente.");
      return;
    }

    if (quantidadeUso <= 0) {
      alert("Informe uma quantidade de uso válida.");
      return;
    }

    if (quantidadeCompra <= 0) {
      alert("Informe uma quantidade de compra válida.");
      return;
    }

    const calculo = calcularCustoIngrediente({
      quantidadeUso,
      precoCompra,
      quantidadeCompra,
      fatorCorrecao,
      fatorCoccao,
    });

    const payload: Ingrediente = {
      id: editandoIngredienteId || uid(),
      productId: draftIngredienteId || null,
      nome: draftIngredienteNome.trim(),
      quantidadeUso,
      unidadeUso: normalizeUnit(draftUnidadeUso, "UN"),
      precoCompra,
      quantidadeCompra,
      unidadeCompra: normalizeUnit(draftUnidadeCompra, "UN"),
      custoUnitarioBase: calculo.custoUnitarioBase,
      custoIngrediente: calculo.custoIngrediente,
      fatorCorrecao,
      fatorCoccao,
    };

    if (editandoIngredienteId) {
      onChange(
        ingredientes.map((item) =>
          item.id === editandoIngredienteId ? payload : item
        )
      );
    } else {
      onChange([...ingredientes, payload]);
    }

    setShowIngredientForm(true);
    resetDraftIngrediente();
  };

  const editarIngrediente = (id: string) => {
    const item = ingredientes.find((ing) => ing.id === id);
    if (!item) return;

    setShowIngredientForm(true);
    setEditandoIngredienteId(item.id);
    setDraftIngredienteId(item.productId || "");
    setDraftIngredienteNome(item.nome);
    setDraftQuantidadeUso(item.quantidadeUso);
    setDraftUnidadeUso(item.unidadeUso);
    setDraftPrecoCompra(item.precoCompra);
    setDraftQuantidadeCompra(item.quantidadeCompra);
    setDraftUnidadeCompra(item.unidadeCompra);
    setDraftFCorrecao(item.fatorCorrecao);
    setDraftFCoccao(item.fatorCoccao);
  };

  const removerIngrediente = (id: string) => {
    onChange(ingredientes.filter((item) => item.id !== id));
    if (editandoIngredienteId === id) {
      resetDraftIngrediente();
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold">Ingredientes</h4>
          <p className="text-sm text-muted-foreground">
            Adicione, edite ou remova ingredientes da ficha técnica.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={iniciarNovoIngrediente}>
            {editandoIngredienteId ? "Novo ingrediente" : "Adicionar ingrediente"}
          </Button>

          {showIngredientForm && ingredientes.length > 0 && !editandoIngredienteId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowIngredientForm(false)}
            >
              Ocultar formulário
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        {showIngredientForm ? (
          <div className="space-y-4 rounded-lg border border-dashed bg-slate-50/70 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {editandoIngredienteId ? "Editando ingrediente" : "Novo ingrediente"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Preencha os dados abaixo e salve para atualizar a ficha.
                </p>
              </div>

              {editandoIngredienteId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetDraftIngrediente();
                    if (ingredientes.length > 0) {
                      setShowIngredientForm(false);
                    }
                  }}
                >
                  Cancelar edição
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-3">
                <Label>Produto cadastrado</Label>
                <select
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draftIngredienteId}
                  onChange={(e) => onSelectProductIngredient(e.target.value)}
                >
                  <option value="">— Selecionar produto —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <Label>Ingrediente</Label>
                <Input
                  value={draftIngredienteNome}
                  onChange={(e) => setDraftIngredienteNome(e.target.value)}
                  placeholder="Nome do ingrediente"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Qtd de uso</Label>
                <Input
                  type="number"
                  value={draftQuantidadeUso}
                  onChange={(e) => setDraftQuantidadeUso(toNumber(e.target.value, 0))}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Unidade de uso</Label>
                <Input
                  value={draftUnidadeUso}
                  onChange={(e) =>
                    setDraftUnidadeUso(normalizeUnit(e.target.value, "UN"))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <Label>Preço da compra</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draftPrecoCompra}
                  onChange={(e) => setDraftPrecoCompra(toNumber(e.target.value, 0))}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Qtd comprada</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={draftQuantidadeCompra}
                  onChange={(e) =>
                    setDraftQuantidadeCompra(toNumber(e.target.value, 1))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <Label>Unidade compra</Label>
                <Input
                  value={draftUnidadeCompra}
                  onChange={(e) =>
                    setDraftUnidadeCompra(normalizeUnit(e.target.value, "UN"))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <Label>F. Correção</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={draftFCorrecao}
                  onChange={(e) => setDraftFCorrecao(toNumber(e.target.value, 1))}
                />
              </div>

              <div className="md:col-span-2">
                <Label>F. Cocção</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={draftFCoccao}
                  onChange={(e) => setDraftFCoccao(toNumber(e.target.value, 1))}
                />
              </div>

              <div className="md:col-span-4 flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  className="w-full sm:flex-1"
                  onClick={salvarIngrediente}
                >
                  {editandoIngredienteId ? "Salvar ingrediente" : "Adicionar ingrediente"}
                </Button>

                {!editandoIngredienteId && ingredientes.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowIngredientForm(false)}
                  >
                    Fechar
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 text-sm">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <p className="text-gray-600">Custo unitário base</p>
                  <p className="font-bold">
                    {formatCurrency(previewIngrediente.custoUnitarioBase)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Custo final do ingrediente</p>
                  <p className="font-bold text-red-600">
                    {formatCurrency(previewIngrediente.custoIngrediente)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Itens cadastrados</p>
                  <p className="font-medium">{ingredientes.length}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {ingredientes.length === 0 ? (
          <p className="text-sm text-gray-600">
            Nenhum ingrediente adicionado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Uso</TableHead>
                  <TableHead>Compra</TableHead>
                  <TableHead>Preço compra</TableHead>
                  <TableHead>Custo unit.</TableHead>
                  <TableHead>Custo final</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredientes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.nome}</TableCell>
                    <TableCell>
                      {item.quantidadeUso} {item.unidadeUso}
                    </TableCell>
                    <TableCell>
                      {item.quantidadeCompra} {item.unidadeCompra}
                    </TableCell>
                    <TableCell>{formatCurrency(item.precoCompra)}</TableCell>
                    <TableCell>{formatCurrency(item.custoUnitarioBase)}</TableCell>
                    <TableCell className="font-medium text-red-600">
                      {formatCurrency(item.custoIngrediente)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => editarIngrediente(item.id)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => removerIngrediente(item.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
export default function FichasTecnicasPage() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingFichas, setLoadingFichas] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);

  const [fichasTecnicas, setFichasTecnicas] = useState<FichaTecnica[]>([]);
  const [fichaSelecionada, setFichaSelecionada] = useState<FichaTecnica | null>(null);

  const [showNovaFicha, setShowNovaFicha] = useState(false);
  const [showEditarFicha, setShowEditarFicha] = useState(false);
  const [showFullscreenViewer, setShowFullscreenViewer] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [fichaEditando, setFichaEditando] = useState<FichaTecnica | null>(null);

  const [viewerTab, setViewerTab] = useState<ViewerTab>("ingredientes");
  const [desiredServings, setDesiredServings] = useState<number>(1);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [rendimento, setRendimento] = useState<number>(1);
  const [pesoPorcao, setPesoPorcao] = useState<number>(0);
  const [tempoPreparo, setTempoPreparo] = useState<number>(0);
  const [margemLucro, setMargemLucro] = useState<number>(200);
  const [modoPreparo, setModoPreparo] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);

  const [difficultyLevel, setDifficultyLevel] = useState("");
  const [temperatureCelsius, setTemperatureCelsius] = useState<number | "">("");
  const [cookingTimeMinutes, setCookingTimeMinutes] = useState<number | "">("");
  const [cookingFactorGrams, setCookingFactorGrams] = useState<number | "">("");
  const [correctionFactorGrams, setCorrectionFactorGrams] = useState<number | "">("");
  const [yieldLabel, setYieldLabel] = useState("");
  const [portionWeightUnit, setPortionWeightUnit] = useState("G");
  const [storageInstructions, setStorageInstructions] = useState("");
  const [shelfLifeFrozen, setShelfLifeFrozen] = useState("");
  const [shelfLifeRefrigerated, setShelfLifeRefrigerated] = useState("");
  const [shelfLifeRoomTemp, setShelfLifeRoomTemp] = useState("");
  const [allergens, setAllergens] = useState("");
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [escalas, setEscalas] = useState<EscalaFicha[]>([]);

  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);

  const newImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const importPdfInputRef = useRef<HTMLInputElement | null>(null);

  const [importingPdf, setImportingPdf] = useState(false);
  const [importDefaultCategory, setImportDefaultCategory] = useState("Importado PDF");
  const [importPdfFileName, setImportPdfFileName] = useState("");

  const loadData = async () => {
    try {
      setLoadingProducts(true);
      setLoadingFichas(true);

      const [productsRes, fichasRes] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        listTechnicalSheets(),
      ]);

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        const normalized = Array.isArray(productsData)
          ? productsData.map((p: any) => ({
              id: String(p.id),
              name: String(p.name ?? ""),
              price: Number(p.price ?? 0),
              default_unit_label: p.default_unit_label ?? "UN",
              sector_category: p.sector_category ?? p.category ?? "",
            }))
          : [];
        setProducts(normalized);
      } else {
        setProducts([]);
      }

      const fichasNormalizadas = Array.isArray(fichasRes)
        ? fichasRes.map(normalizeFichaFromDb)
        : [];

      setFichasTecnicas(fichasNormalizadas);

      setFichaSelecionada((prev) => {
        if (!fichasNormalizadas.length) return null;
        if (!prev) return fichasNormalizadas[0];
        return fichasNormalizadas.find((f) => f.id === prev.id) ?? fichasNormalizadas[0];
      });
    } catch (err) {
      console.error("Erro ao carregar fichas técnicas:", err);
      alert("Erro ao carregar fichas técnicas.");
    } finally {
      setLoadingProducts(false);
      setLoadingFichas(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (fichaSelecionada) {
      setDesiredServings(Math.max(1, fichaSelecionada.rendimento || 1));
    }
  }, [fichaSelecionada]);

  const categoriasDisponiveis = useMemo(() => {
    const unique = Array.from(
      new Set(
        fichasTecnicas
          .map((ficha) => ficha.categoria?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return ["TODAS", ...unique];
  }, [fichasTecnicas]);

  const fichasFiltradas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return fichasTecnicas.filter((ficha) => {
      const matchesCategory =
        categoryFilter === "TODAS" || ficha.categoria === categoryFilter;

      const matchesSearch =
        !q ||
        ficha.nome.toLowerCase().includes(q) ||
        ficha.categoria.toLowerCase().includes(q) ||
        ficha.ingredientes.some((i) => i.nome.toLowerCase().includes(q)) ||
        ficha.escalas.some(
          (s) =>
            s.label.toLowerCase().includes(q) ||
            s.ingredientes.some((ing) => ing.nome.toLowerCase().includes(q))
        );

      return matchesCategory && matchesSearch;
    });
  }, [fichasTecnicas, searchTerm, categoryFilter]);

  const custoMedio = useMemo(() => {
    if (!fichasTecnicas.length) return 0;
    return (
      fichasTecnicas.reduce((acc, f) => acc + f.custoPorPorcao, 0) /
      fichasTecnicas.length
    );
  }, [fichasTecnicas]);

  const cmvMedio = useMemo(() => {
    if (!fichasTecnicas.length) return 0;
    return (
      fichasTecnicas.reduce(
        (acc, f) => acc + calcularCMV(f.custoPorPorcao, f.precoVenda),
        0
      ) / fichasTecnicas.length
    );
  }, [fichasTecnicas]);

  const margemMedia = useMemo(() => {
    if (!fichasTecnicas.length) return 0;
    return (
      fichasTecnicas.reduce((acc, f) => acc + f.margemLucro, 0) /
      fichasTecnicas.length
    );
  }, [fichasTecnicas]);

  const resetForm = () => {
    setNome("");
    setCategoria("");
    setRendimento(1);
    setPesoPorcao(0);
    setTempoPreparo(0);
    setMargemLucro(200);
    setModoPreparo("");
    setImageUrl(null);
    setImagePath(null);

    setDifficultyLevel("");
    setTemperatureCelsius("");
    setCookingTimeMinutes("");
    setCookingFactorGrams("");
    setCorrectionFactorGrams("");
    setYieldLabel("");
    setPortionWeightUnit("G");
    setStorageInstructions("");
    setShelfLifeFrozen("");
    setShelfLifeRefrigerated("");
    setShelfLifeRoomTemp("");
    setAllergens("");
    setSourceUpdatedAt("");
    setVideoUrl("");
    setEscalas([]);

    setIngredientes([]);
  };

  const handleNewImageSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadTechnicalSheetImageAction(formData);
      setImageUrl(result.imageUrl);
      setImagePath(result.imagePath);
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "Erro ao enviar imagem.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const handleEditImageSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !fichaEditando) return;

    try {
      setUploadingImage(true);

      const oldImagePath = fichaEditando.imagePath;

      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadTechnicalSheetImageAction(formData);

      if (oldImagePath) {
        await deleteTechnicalSheetImageAction(oldImagePath);
      }

      setFichaEditando((prev) =>
        prev
          ? {
              ...prev,
              imageUrl: result.imageUrl,
              imagePath: result.imagePath,
            }
          : prev
      );
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "Erro ao enviar imagem.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const handleImportPdfSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportingPdf(true);
      setImportPdfFileName(file.name);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("defaultCategory", importDefaultCategory);

      const result = await importTechnicalSheetsFromPdfAction(formData);

      if (!result.ok) {
        alert(result.error);
        return;
      }

      alert(
        `Importação concluída.\n\nReceitas criadas: ${result.importedCount}\n\n${result.recipes
          .map((r: any) => `Página ${r.page}: ${r.name}`)
          .join("\n")}`
      );

      setShowImportModal(false);
      setImportPdfFileName("");
      await loadData();
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "Erro ao importar PDF.");
    } finally {
      setImportingPdf(false);
      event.target.value = "";
    }
  };

  const salvarNovaFicha = () => {
    if (!nome.trim()) {
      alert("Informe o nome da receita.");
      return;
    }

    if (!categoria.trim()) {
      alert("Informe a categoria.");
      return;
    }

    if (rendimento <= 0) {
      alert("Informe um rendimento válido.");
      return;
    }

    if (ingredientes.length === 0) {
      alert("Adicione pelo menos um ingrediente.");
      return;
    }

    const custos = calcularCustos(ingredientes, rendimento, margemLucro);

    const payload = toActionPayload({
      nome: nome.trim(),
      categoria: categoria.trim(),
      rendimento: toNumber(rendimento, 1),
      pesoPorcao: toNumber(pesoPorcao, 0),
      tempoPreparo: toNumber(tempoPreparo, 0),
      custoTotal: custos.custoTotal,
      custoPorPorcao: custos.custoPorPorcao,
      margemLucro: toNumber(margemLucro, 0),
      precoVenda: custos.precoVenda,
      modoPreparo: modoPreparo.trim(),
      imageUrl,
      imagePath,

      difficultyLevel: difficultyLevel.trim() || null,
      temperatureCelsius:
        temperatureCelsius === "" ? null : toNumber(temperatureCelsius, 0),
      cookingTimeMinutes:
        cookingTimeMinutes === "" ? null : toNumber(cookingTimeMinutes, 0),
      cookingFactorGrams:
        cookingFactorGrams === "" ? null : toNumber(cookingFactorGrams, 0),
      correctionFactorGrams:
        correctionFactorGrams === "" ? null : toNumber(correctionFactorGrams, 0),
      yieldLabel: yieldLabel.trim() || null,
      portionWeightUnit: normalizeUnit(portionWeightUnit, "G"),
      storageInstructions: storageInstructions.trim() || null,
      shelfLifeFrozen: shelfLifeFrozen.trim() || null,
      shelfLifeRefrigerated: shelfLifeRefrigerated.trim() || null,
      shelfLifeRoomTemp: shelfLifeRoomTemp.trim() || null,
      allergens: allergens.trim() || null,
      sourceUpdatedAt: sourceUpdatedAt || null,
      importOrigin: null,
      sourceFileName: null,
      sourcePageNumber: null,
      videoUrl: videoUrl.trim() || null,

      ingredientes,
      escalas,
    });

    startTransition(async () => {
      try {
        await createTechnicalSheet(payload);
        setShowNovaFicha(false);
        resetForm();
        await loadData();
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Erro ao salvar ficha técnica.");
      }
    });
  };

  const handleEditarFicha = (ficha: FichaTecnica) => {
    setFichaEditando({
      ...ficha,
      ingredientes: ficha.ingredientes.map((i) => ({ ...i })),
      escalas: ficha.escalas.map((s) => ({
        ...s,
        ingredientes: s.ingredientes.map((i) => ({ ...i })),
      })),
    });
    setShowEditarFicha(true);
  };

  const salvarEdicaoFicha = () => {
    if (!fichaEditando) return;

    if (!fichaEditando.nome.trim()) {
      alert("Informe o nome da receita.");
      return;
    }

    if (!fichaEditando.categoria.trim()) {
      alert("Informe a categoria.");
      return;
    }

    if (fichaEditando.rendimento <= 0) {
      alert("Informe um rendimento válido.");
      return;
    }

    if (fichaEditando.ingredientes.length === 0) {
      alert("Adicione pelo menos um ingrediente.");
      return;
    }

    const custos = calcularCustos(
      fichaEditando.ingredientes,
      fichaEditando.rendimento,
      fichaEditando.margemLucro
    );

    const payload = toActionPayload({
      id: fichaEditando.id,
      nome: fichaEditando.nome,
      categoria: fichaEditando.categoria,
      rendimento: fichaEditando.rendimento,
      pesoPorcao: fichaEditando.pesoPorcao,
      tempoPreparo: fichaEditando.tempoPreparo,
      custoTotal: custos.custoTotal,
      custoPorPorcao: custos.custoPorPorcao,
      margemLucro: fichaEditando.margemLucro,
      precoVenda: custos.precoVenda,
      modoPreparo: fichaEditando.modoPreparo,
      imageUrl: fichaEditando.imageUrl,
      imagePath: fichaEditando.imagePath,

      difficultyLevel: fichaEditando.difficultyLevel,
      temperatureCelsius: fichaEditando.temperatureCelsius,
      cookingTimeMinutes: fichaEditando.cookingTimeMinutes,
      cookingFactorGrams: fichaEditando.cookingFactorGrams,
      correctionFactorGrams: fichaEditando.correctionFactorGrams,
      yieldLabel: fichaEditando.yieldLabel,
      portionWeightUnit: fichaEditando.portionWeightUnit,
      storageInstructions: fichaEditando.storageInstructions,
      shelfLifeFrozen: fichaEditando.shelfLifeFrozen,
      shelfLifeRefrigerated: fichaEditando.shelfLifeRefrigerated,
      shelfLifeRoomTemp: fichaEditando.shelfLifeRoomTemp,
      allergens: fichaEditando.allergens,
      sourceUpdatedAt: fichaEditando.sourceUpdatedAt,
      importOrigin: fichaEditando.importOrigin,
      sourceFileName: fichaEditando.sourceFileName,
      sourcePageNumber: fichaEditando.sourcePageNumber,
      videoUrl: fichaEditando.videoUrl,

      ingredientes: fichaEditando.ingredientes,
      escalas: fichaEditando.escalas,
    });

    startTransition(async () => {
      try {
        await updateTechnicalSheet(payload);
        setFichaEditando(null);
        setShowEditarFicha(false);
        await loadData();
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Erro ao atualizar ficha técnica.");
      }
    });
  };

  const excluirFicha = (id: string) => {
    if (!confirm("Deseja realmente excluir esta ficha técnica?")) return;

    startTransition(async () => {
      try {
        await deleteTechnicalSheet(id);
        setFichaSelecionada((prev) => (prev?.id === id ? null : prev));
        await loadData();
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Erro ao excluir ficha técnica.");
      }
    });
  };

  const duplicarFicha = (ficha: FichaTecnica) => {
    startTransition(async () => {
      try {
        const created = await duplicateTechnicalSheetAction(ficha.id);
        await loadData();

        const fichasRes = await listTechnicalSheets();
        const fichasNormalizadas = Array.isArray(fichasRes)
          ? fichasRes.map(normalizeFichaFromDb)
          : [];

        setFichasTecnicas(fichasNormalizadas);

        const duplicada =
          fichasNormalizadas.find((item) => item.id === created.id) ?? null;

        if (duplicada) {
          setFichaSelecionada(duplicada);
          setViewerTab("ingredientes");
          setDesiredServings(Math.max(1, duplicada.rendimento || 1));
        }

        alert(`Ficha duplicada com sucesso: ${created.name}`);
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Erro ao duplicar ficha técnica.");
      }
    });
  };

  const handleExportarPdf = async (ficha: FichaTecnica) => {
    try {
      setExportingPdfId(ficha.id);
      await exportTechnicalSheetPdf(ficha, desiredServings);
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "Erro ao exportar PDF da ficha técnica.");
    } finally {
      setExportingPdfId(null);
    }
  };

  const exportarRelatorioCustos = () => {
    if (!fichasTecnicas.length) {
      alert("Nenhuma ficha técnica cadastrada para exportar.");
      return;
    }

    const headers = [
      "nome",
      "categoria",
      "image_url",
      "image_path",
      "rendimento",
      "yield_label",
      "peso_por_porcao",
      "unidade_peso_porcao",
      "tempo_preparo",
      "tempo_coccao",
      "temperatura_celsius",
      "fator_coccao_gramas",
      "fator_correcao_gramas",
      "dificuldade",
      "armazenamento",
      "validade_congelado",
      "validade_refrigerado",
      "validade_ambiente",
      "alergenicos",
      "atualizada_em",
      "video_url",
      "import_origin",
      "source_file_name",
      "source_page_number",
      "escalas",
      "custo_total",
      "custo_por_porcao",
      "preco_venda",
      "cmv",
      "margem_lucro",
      "lucro_unitario",
      "ingredientes",
    ];

    const lines = [headers.join(";")];

    fichasTecnicas.forEach((ficha) => {
      const row = [
        escapeCsv(ficha.nome),
        escapeCsv(ficha.categoria),
        escapeCsv(ficha.imageUrl ?? ""),
        escapeCsv(ficha.imagePath ?? ""),
        escapeCsv(ficha.rendimento),
        escapeCsv(ficha.yieldLabel ?? ""),
        escapeCsv(ficha.pesoPorcao),
        escapeCsv(ficha.portionWeightUnit ?? ""),
        escapeCsv(ficha.tempoPreparo),
        escapeCsv(ficha.cookingTimeMinutes ?? ""),
        escapeCsv(ficha.temperatureCelsius ?? ""),
        escapeCsv(ficha.cookingFactorGrams ?? ""),
        escapeCsv(ficha.correctionFactorGrams ?? ""),
        escapeCsv(ficha.difficultyLevel ?? ""),
        escapeCsv(ficha.storageInstructions ?? ""),
        escapeCsv(ficha.shelfLifeFrozen ?? ""),
        escapeCsv(ficha.shelfLifeRefrigerated ?? ""),
        escapeCsv(ficha.shelfLifeRoomTemp ?? ""),
        escapeCsv(ficha.allergens ?? ""),
        escapeCsv(ficha.sourceUpdatedAt ?? ""),
        escapeCsv(ficha.videoUrl ?? ""),
        escapeCsv(ficha.importOrigin ?? ""),
        escapeCsv(ficha.sourceFileName ?? ""),
        escapeCsv(ficha.sourcePageNumber ?? ""),
        escapeCsv(ficha.escalas.length),
        escapeCsv(ficha.custoTotal.toFixed(2)),
        escapeCsv(ficha.custoPorPorcao.toFixed(2)),
        escapeCsv(ficha.precoVenda.toFixed(2)),
        escapeCsv(calcularCMV(ficha.custoPorPorcao, ficha.precoVenda).toFixed(1)),
        escapeCsv(ficha.margemLucro.toFixed(0)),
        escapeCsv(
          calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao).toFixed(2)
        ),
        escapeCsv(ficha.ingredientes.length),
      ];

      lines.push(row.join(";"));
    });

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_fichas_tecnicas.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImprimirFicha = (ficha: FichaTecnica) => {
    const html = buildPrintHtml(ficha, desiredServings, viewerTab);
    const w = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const fichaSelecionadaFiltrada = useMemo(() => {
    if (!fichaSelecionada) return null;
    return fichasFiltradas.find((f) => f.id === fichaSelecionada.id) ?? null;
  }, [fichaSelecionada, fichasFiltradas]);

  useEffect(() => {
    if (!fichasFiltradas.length) {
      setFichaSelecionada(null);
      return;
    }

    if (!fichaSelecionadaFiltrada) {
      setFichaSelecionada(fichasFiltradas[0]);
    }
  }, [fichasFiltradas, fichaSelecionadaFiltrada]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fichas Técnicas</h1>
          <p className="text-gray-600">
            Visualização avançada, foto do prato, vídeo, escalas, tela cheia, impressão
            e cálculo automático de custos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportarRelatorioCustos}>
            📊 Relatório de Custos
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setShowImportModal(true)}
          >
            📥 Importar Ficha Técnica
          </Button>

          <Button type="button" onClick={() => setShowNovaFicha(true)}>
            ➕ Nova Ficha Técnica
          </Button>
        </div>
      </div>

      {exportingPdfId ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          Gerando PDF da ficha técnica...
        </div>
      ) : null}

      {(loadingProducts || loadingFichas) && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          Carregando fichas técnicas...
        </div>
      )}

      {!loadingProducts && products.length === 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          Nenhum produto foi carregado da base. Você ainda pode cadastrar fichas com
          ingredientes manuais, mas o ideal é ter produtos cadastrados antes.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Receitas</CardTitle>
            <span className="text-2xl">📝</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fichasTecnicas.length}</div>
            <p className="text-xs text-muted-foreground">Receitas cadastradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Médio</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(custoMedio)}</div>
            <p className="text-xs text-muted-foreground">Por porção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV Médio</CardTitle>
            <span className="text-2xl">📉</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cmvMedio.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Custo da mercadoria vendida</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Média</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{margemMedia.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Margem de lucro</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Lista de fichas</CardTitle>
              <CardDescription>
                Selecione uma ficha para abrir a visualização detalhada.
              </CardDescription>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="search-fichas">Buscar</Label>
                <Input
                  id="search-fichas"
                  placeholder="Nome, categoria, ingrediente ou escala..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="category-filter">Categoria</Label>
                <select
                  id="category-filter"
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categoriasDisponiveis.map((item) => (
                    <option key={item} value={item}>
                      {item === "TODAS" ? "Todas as categorias" : item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="max-h-[820px] overflow-y-auto space-y-3">
            {fichasFiltradas.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma ficha encontrada com os filtros informados.
              </div>
            ) : (
              fichasFiltradas.map((ficha) => {
                const ativa = fichaSelecionada?.id === ficha.id;
                const cmv = calcularCMV(ficha.custoPorPorcao, ficha.precoVenda);

                return (
                  <button
                    key={ficha.id}
                    type="button"
                    onClick={() => {
                      setFichaSelecionada(ficha);
                      setViewerTab("ingredientes");
                    }}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      ativa
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-white hover:bg-slate-50"
                    }`}
                  >
                    {ficha.imageUrl ? (
                      <div className="relative mb-3 h-32 w-full overflow-hidden rounded-lg bg-slate-100">
                        <Image
                          src={ficha.imageUrl}
                          alt={ficha.nome}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="mb-3 flex h-32 items-center justify-center rounded-lg bg-slate-100 text-xs text-muted-foreground">
                        Sem imagem
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">{ficha.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ficha.categoria || "Sem categoria"}
                        </p>
                      </div>
                      <Badge variant={ativa ? "default" : "secondary"}>
                        {ficha.rendimento} porções
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Custo por porção</p>
                        <p className="font-bold text-red-600">
                          {formatCurrency(ficha.custoPorPorcao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Preço sugerido</p>
                        <p className="font-bold text-green-600">
                          {formatCurrency(ficha.precoVenda)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">CMV</p>
                        <p className="font-bold">{cmv.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Escalas</p>
                        <p className="font-bold">{ficha.escalas.length}</p>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">
                      ⏱️ {ficha.tempoPreparo} min • ⚖️ {ficha.pesoPorcao}{" "}
                      {ficha.portionWeightUnit || "G"}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <RecipeViewer
          ficha={fichaSelecionada}
          desiredServings={desiredServings}
          setDesiredServings={setDesiredServings}
          currentTab={viewerTab}
          setCurrentTab={setViewerTab}
          onEdit={handleEditarFicha}
          onPrint={handleImprimirFicha}
          onExportPdf={handleExportarPdf}
          onDuplicate={duplicarFicha}
          onFullscreen={(ficha) => {
            setFichaSelecionada(ficha);
            setShowFullscreenViewer(true);
          }}
          onDelete={(ficha) => excluirFicha(ficha.id)}
        />
      </div>

      <Dialog open={showFullscreenViewer} onOpenChange={setShowFullscreenViewer}>
        <DialogContent className="h-[95vh] max-w-[96vw] overflow-hidden bg-white p-0 text-gray-900">
          <div className="flex h-full flex-col">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>Visualização em tela cheia</DialogTitle>
              <DialogDescription>
                Consulte a ficha técnica ampliada, com foto, vídeo, escalas e impressão.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6">
              <RecipeViewer
                ficha={fichaSelecionada}
                desiredServings={desiredServings}
                setDesiredServings={setDesiredServings}
                currentTab={viewerTab}
                setCurrentTab={setViewerTab}
                onEdit={(ficha) => {
                  setShowFullscreenViewer(false);
                  handleEditarFicha(ficha);
                }}
                onPrint={handleImprimirFicha}
                onExportPdf={handleExportarPdf}
                onDuplicate={duplicarFicha}
                onFullscreen={() => undefined}
                onDelete={(ficha) => {
                  setShowFullscreenViewer(false);
                  excluirFicha(ficha.id);
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>Importar Ficha Técnica</DialogTitle>
            <DialogDescription>
              Envie um PDF do Canva. O sistema irá ler página por página e criar uma
              ficha separada para cada receita encontrada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="import-category">Categoria padrão</Label>
              <Input
                id="import-category"
                value={importDefaultCategory}
                onChange={(e) => setImportDefaultCategory(e.target.value)}
                placeholder="Ex.: Sobremesas importadas"
              />
            </div>

            <div className="rounded-lg border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                PDF selecionado: {importPdfFileName || "nenhum arquivo"}
              </p>

              <input
                ref={importPdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleImportPdfSelected}
              />

              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  onClick={() => importPdfInputRef.current?.click()}
                  disabled={importingPdf}
                >
                  {importingPdf ? "Importando..." : "Selecionar PDF"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportPdfFileName("");
                  }}
                  disabled={importingPdf}
                >
                  Cancelar
                </Button>
              </div>
            </div>

            <div className="rounded-md bg-slate-50 p-3 text-sm text-muted-foreground">
              Campos importados nesta versão: nome, modo de preparo, ingredientes base,
              rendimento, peso por porção, tempo de preparo, temperatura, tempo de cocção,
              fatores, armazenamento, validade, alergênicos, vídeo, data de atualização
              e escalas.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showEditarFicha && fichaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Editar Ficha Técnica</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowEditarFicha(false);
                  setFichaEditando(null);
                }}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={fichaEditando.nome}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, nome: e.target.value } : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Categoria</Label>
                  <Input
                    value={fichaEditando.categoria}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, categoria: e.target.value } : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Rendimento</Label>
                  <Input
                    type="number"
                    value={fichaEditando.rendimento}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, rendimento: toNumber(e.target.value, 1) } : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Yield label</Label>
                  <Input
                    value={fichaEditando.yieldLabel ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, yieldLabel: e.target.value || null } : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Peso por porção</Label>
                  <Input
                    type="number"
                    value={fichaEditando.pesoPorcao}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, pesoPorcao: toNumber(e.target.value, 0) } : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Unidade do peso</Label>
                  <Input
                    value={fichaEditando.portionWeightUnit ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev
                          ? {
                              ...prev,
                              portionWeightUnit: normalizeUnit(e.target.value, "G"),
                            }
                          : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Tempo de preparo</Label>
                  <Input
                    type="number"
                    value={fichaEditando.tempoPreparo}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, tempoPreparo: toNumber(e.target.value, 0) } : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Tempo de cocção</Label>
                  <Input
                    type="number"
                    value={fichaEditando.cookingTimeMinutes ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev
                          ? {
                              ...prev,
                              cookingTimeMinutes:
                                e.target.value === "" ? null : toNumber(e.target.value, 0),
                            }
                          : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Margem de lucro (%)</Label>
                  <Input
                    type="number"
                    value={fichaEditando.margemLucro}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, margemLucro: toNumber(e.target.value, 0) } : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Dificuldade</Label>
                  <Input
                    value={fichaEditando.difficultyLevel ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, difficultyLevel: e.target.value || null } : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Temperatura (ºC)</Label>
                  <Input
                    type="number"
                    value={fichaEditando.temperatureCelsius ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev
                          ? {
                              ...prev,
                              temperatureCelsius:
                                e.target.value === "" ? null : toNumber(e.target.value, 0),
                            }
                          : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Fator de cocção (g)</Label>
                  <Input
                    type="number"
                    value={fichaEditando.cookingFactorGrams ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev
                          ? {
                              ...prev,
                              cookingFactorGrams:
                                e.target.value === "" ? null : toNumber(e.target.value, 0),
                            }
                          : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Fator de correção (g)</Label>
                  <Input
                    type="number"
                    value={fichaEditando.correctionFactorGrams ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev
                          ? {
                              ...prev,
                              correctionFactorGrams:
                                e.target.value === "" ? null : toNumber(e.target.value, 0),
                            }
                          : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Armazenamento</Label>
                  <Input
                    value={fichaEditando.storageInstructions ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev
                          ? { ...prev, storageInstructions: e.target.value || null }
                          : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Validade congelado</Label>
                  <Input
                    value={fichaEditando.shelfLifeFrozen ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, shelfLifeFrozen: e.target.value || null } : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Validade refrigerado</Label>
                  <Input
                    value={fichaEditando.shelfLifeRefrigerated ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev
                          ? { ...prev, shelfLifeRefrigerated: e.target.value || null }
                          : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Validade ambiente</Label>
                  <Input
                    value={fichaEditando.shelfLifeRoomTemp ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev
                          ? { ...prev, shelfLifeRoomTemp: e.target.value || null }
                          : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Alergênicos</Label>
                  <Input
                    value={fichaEditando.allergens ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, allergens: e.target.value || null } : prev
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Atualizada em</Label>
                  <Input
                    type="date"
                    value={fichaEditando.sourceUpdatedAt ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, sourceUpdatedAt: e.target.value || null } : prev
                      )
                    }
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-2">
                  <Label>Vídeo / URL</Label>
                  <Input
                    value={fichaEditando.videoUrl ?? ""}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, videoUrl: e.target.value || null } : prev
                      )
                    }
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-3 md:col-span-2 xl:col-span-4">
                  <Label>Imagem do prato</Label>

                  {fichaEditando.imageUrl ? (
                    <div className="relative h-56 w-full overflow-hidden rounded-xl border bg-slate-100">
                      <Image
                        src={fichaEditando.imageUrl}
                        alt={fichaEditando.nome}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed bg-slate-50 text-sm text-muted-foreground">
                      Sem imagem cadastrada
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={editImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditImageSelected}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => editImageInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? "Enviando imagem..." : "Enviar nova imagem"}
                    </Button>

                    {fichaEditando.imageUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          if (!fichaEditando.imagePath) {
                            setFichaEditando((prev) =>
                              prev ? { ...prev, imageUrl: null, imagePath: null } : prev
                            );
                            return;
                          }

                          try {
                            setUploadingImage(true);
                            await deleteTechnicalSheetImageAction(fichaEditando.imagePath);
                            setFichaEditando((prev) =>
                              prev ? { ...prev, imageUrl: null, imagePath: null } : prev
                            );
                          } catch (error: any) {
                            console.error(error);
                            alert(error?.message ?? "Erro ao remover imagem.");
                          } finally {
                            setUploadingImage(false);
                          }
                        }}
                      >
                        Remover imagem
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="md:col-span-2 xl:col-span-4">
                  <Label>Modo de preparo</Label>
                  <Textarea
                    rows={6}
                    value={fichaEditando.modoPreparo}
                    onChange={(e) =>
                      setFichaEditando((prev) =>
                        prev ? { ...prev, modoPreparo: e.target.value } : prev
                      )
                    }
                  />
                </div>
              </div>

              <IngredientEditor
                key={fichaEditando.id}
                products={products}
                ingredientes={fichaEditando.ingredientes}
                onChange={(next) =>
                  setFichaEditando((prev) => (prev ? { ...prev, ingredientes: next } : prev))
                }
              />

              <ScaleEditor
                scales={fichaEditando.escalas}
                onChange={(next) =>
                  setFichaEditando((prev) => (prev ? { ...prev, escalas: next } : prev))
                }
              />

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditarFicha(false);
                    setFichaEditando(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={salvarEdicaoFicha} disabled={isPending}>
                  Salvar alterações
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNovaFicha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Nova Ficha Técnica</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowNovaFicha(false);
                  resetForm();
                }}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Label htmlFor="nome">Nome da Receita</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: Calda de Chocolate"
                  />
                </div>

                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input
                    id="categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ex.: Sobremesas"
                  />
                </div>

                <div>
                  <Label htmlFor="rendimento">Rendimento</Label>
                  <Input
                    id="rendimento"
                    type="number"
                    value={rendimento}
                    onChange={(e) => setRendimento(toNumber(e.target.value, 1))}
                    placeholder="Ex.: 20"
                  />
                </div>

                <div>
                  <Label htmlFor="yieldLabel">Yield label</Label>
                  <Input
                    id="yieldLabel"
                    value={yieldLabel}
                    onChange={(e) => setYieldLabel(e.target.value)}
                    placeholder="Ex.: 1 PAC / 4 assadeiras"
                  />
                </div>

                <div>
                  <Label htmlFor="peso">Peso por Porção</Label>
                  <Input
                    id="peso"
                    type="number"
                    value={pesoPorcao}
                    onChange={(e) => setPesoPorcao(toNumber(e.target.value, 0))}
                    placeholder="Ex.: 50"
                  />
                </div>

                <div>
                  <Label htmlFor="pesoUnit">Unidade do peso</Label>
                  <Input
                    id="pesoUnit"
                    value={portionWeightUnit}
                    onChange={(e) => setPortionWeightUnit(normalizeUnit(e.target.value, "G"))}
                    placeholder="Ex.: G"
                  />
                </div>

                <div>
                  <Label htmlFor="tempo">Tempo de Preparo (min)</Label>
                  <Input
                    id="tempo"
                    type="number"
                    value={tempoPreparo}
                    onChange={(e) => setTempoPreparo(toNumber(e.target.value, 0))}
                    placeholder="Ex.: 120"
                  />
                </div>

                <div>
                  <Label htmlFor="tempoCoccao">Tempo de Cocção (min)</Label>
                  <Input
                    id="tempoCoccao"
                    type="number"
                    value={cookingTimeMinutes}
                    onChange={(e) =>
                      setCookingTimeMinutes(
                        e.target.value === "" ? "" : toNumber(e.target.value, 0)
                      )
                    }
                    placeholder="Ex.: 18"
                  />
                </div>

                <div>
                  <Label htmlFor="margem">Margem de Lucro (%)</Label>
                  <Input
                    id="margem"
                    type="number"
                    value={margemLucro}
                    onChange={(e) => setMargemLucro(toNumber(e.target.value, 0))}
                    placeholder="Ex.: 200"
                  />
                </div>

                <div>
                  <Label htmlFor="dificuldade">Dificuldade</Label>
                  <Input
                    id="dificuldade"
                    value={difficultyLevel}
                    onChange={(e) => setDifficultyLevel(e.target.value)}
                    placeholder="Ex.: Média"
                  />
                </div>

                <div>
                  <Label htmlFor="temperatura">Temperatura (ºC)</Label>
                  <Input
                    id="temperatura"
                    type="number"
                    value={temperatureCelsius}
                    onChange={(e) =>
                      setTemperatureCelsius(
                        e.target.value === "" ? "" : toNumber(e.target.value, 0)
                      )
                    }
                    placeholder="Ex.: 180"
                  />
                </div>

                <div>
                  <Label htmlFor="fatorCoccao">Fator de Cocção (g)</Label>
                  <Input
                    id="fatorCoccao"
                    type="number"
                    value={cookingFactorGrams}
                    onChange={(e) =>
                      setCookingFactorGrams(
                        e.target.value === "" ? "" : toNumber(e.target.value, 0)
                      )
                    }
                    placeholder="Ex.: 850"
                  />
                </div>

                <div>
                  <Label htmlFor="fatorCorrecao">Fator de Correção (g)</Label>
                  <Input
                    id="fatorCorrecao"
                    type="number"
                    value={correctionFactorGrams}
                    onChange={(e) =>
                      setCorrectionFactorGrams(
                        e.target.value === "" ? "" : toNumber(e.target.value, 0)
                      )
                    }
                    placeholder="Ex.: 1000"
                  />
                </div>

                <div>
                  <Label htmlFor="armazenamento">Armazenamento</Label>
                  <Input
                    id="armazenamento"
                    value={storageInstructions}
                    onChange={(e) => setStorageInstructions(e.target.value)}
                    placeholder="Ex.: Sob refrigeração"
                  />
                </div>

                <div>
                  <Label htmlFor="validadeCongelado">Validade congelado</Label>
                  <Input
                    id="validadeCongelado"
                    value={shelfLifeFrozen}
                    onChange={(e) => setShelfLifeFrozen(e.target.value)}
                    placeholder="Ex.: 90 dias"
                  />
                </div>

                <div>
                  <Label htmlFor="validadeRefrigerado">Validade refrigerado</Label>
                  <Input
                    id="validadeRefrigerado"
                    value={shelfLifeRefrigerated}
                    onChange={(e) => setShelfLifeRefrigerated(e.target.value)}
                    placeholder="Ex.: 5 dias"
                  />
                </div>

                <div>
                  <Label htmlFor="validadeAmbiente">Validade ambiente</Label>
                  <Input
                    id="validadeAmbiente"
                    value={shelfLifeRoomTemp}
                    onChange={(e) => setShelfLifeRoomTemp(e.target.value)}
                    placeholder="Ex.: 12 horas"
                  />
                </div>

                <div>
                  <Label htmlFor="alergenicos">Alergênicos</Label>
                  <Input
                    id="alergenicos"
                    value={allergens}
                    onChange={(e) => setAllergens(e.target.value)}
                    placeholder="Ex.: Contém leite e ovos"
                  />
                </div>

                <div>
                  <Label htmlFor="atualizadaEm">Atualizada em</Label>
                  <Input
                    id="atualizadaEm"
                    type="date"
                    value={sourceUpdatedAt}
                    onChange={(e) => setSourceUpdatedAt(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-2">
                  <Label htmlFor="videoUrl">Vídeo / URL</Label>
                  <Input
                    id="videoUrl"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Imagem do prato</Label>

                {imageUrl ? (
                  <div className="relative h-64 w-full overflow-hidden rounded-xl border bg-slate-100">
                    <Image
                      src={imageUrl}
                      alt={nome || "Imagem da receita"}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-44 items-center justify-center rounded-xl border border-dashed bg-slate-50 text-sm text-muted-foreground">
                    Nenhuma imagem enviada
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <input
                    ref={newImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleNewImageSelected}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => newImageInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? "Enviando imagem..." : "Enviar imagem do prato"}
                  </Button>

                  {imageUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          setUploadingImage(true);
                          if (imagePath) {
                            await deleteTechnicalSheetImageAction(imagePath);
                          }
                          setImageUrl(null);
                          setImagePath(null);
                        } catch (error: any) {
                          console.error(error);
                          alert(error?.message ?? "Erro ao remover imagem.");
                        } finally {
                          setUploadingImage(false);
                        }
                      }}
                    >
                      Remover imagem
                    </Button>
                  ) : null}
                </div>
              </div>

              <div>
                <Label htmlFor="modo">Modo de Preparo</Label>
                <Textarea
                  id="modo"
                  value={modoPreparo}
                  onChange={(e) => setModoPreparo(e.target.value)}
                  placeholder="Descreva o modo de preparo da receita..."
                  rows={5}
                />
              </div>

              <IngredientEditor
                key="nova-ficha-ingredientes"
                products={products}
                ingredientes={ingredientes}
                onChange={setIngredientes}
              />

              <ScaleEditor scales={escalas} onChange={setEscalas} />

              <div className="rounded-lg bg-gray-50 p-4">
                <h4 className="mb-3 font-semibold">Prévia automática</h4>
                {(() => {
                  const preview = calcularCustos(ingredientes, rendimento, margemLucro);
                  const cmv = calcularCMV(preview.custoPorPorcao, preview.precoVenda);
                  return (
                    <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                      <div>
                        <p className="text-gray-600">Custo total</p>
                        <p className="font-bold text-red-600">
                          {formatCurrency(preview.custoTotal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Custo por porção</p>
                        <p className="font-bold text-red-600">
                          {formatCurrency(preview.custoPorPorcao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Preço sugerido</p>
                        <p className="font-bold text-green-600">
                          {formatCurrency(preview.precoVenda)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">CMV</p>
                        <p className="font-bold">{cmv.toFixed(1)}%</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNovaFicha(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>

                <Button type="button" onClick={salvarNovaFicha} disabled={isPending}>
                  {isPending ? "Salvando..." : "Salvar Ficha Técnica"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}