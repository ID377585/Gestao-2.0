"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ScaleEditor from "@/app/dashboard/fichas-tecnicas/components/ScaleEditor";
import IngredientEditor from "@/app/dashboard/fichas-tecnicas/components/IngredientEditor";
import PdfImportModal from "@/app/dashboard/fichas-tecnicas/components/PdfImportModal";
import ImportJobReportModal from "@/app/dashboard/fichas-tecnicas/components/ImportJobReportModal";
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
  listTechnicalSheets,
  updateTechnicalSheet,
  uploadTechnicalSheetImageAction,
  type TechnicalSheetInput,
} from "./actions";
import { exportTechnicalSheetPdf } from "./pdf-export";
import {
  type ProductOption as MatcherProductOption,
  type Ingrediente as MatcherIngrediente,
  normalizeUnit,
  toNumber,
} from "@/app/dashboard/fichas-tecnicas/lib/ingredient-product-matcher";
import { detectAllergens } from "@/app/dashboard/fichas-tecnicas/utils/allergens";
import { normalizeAllergenList } from "@/lib/allergens";
type ProductOption = MatcherProductOption;
type Ingrediente = MatcherIngrediente;

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

const PORTION_WEIGHT_UNIT_OPTIONS = ["KG", "L", "UNI"];
const STORAGE_OPTIONS = ["Temp. Ambiente", "Resfriado", "Congelado"];

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function compareFichaByNome(a: FichaTecnica, b: FichaTecnica) {
  const nomeA = a.nome?.trim() || "";
  const nomeB = b.nome?.trim() || "";

  return nomeA.localeCompare(nomeB, "pt-BR", {
    sensitivity: "base",
    numeric: true,
  });
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
  cmvAlvo: number
) {
  const custoTotal = ingredientes.reduce(
    (acc, item) => acc + (item.custoIngrediente || 0),
    0
  );

  const custoPorPorcao =
    rendimento > 0 ? Number((custoTotal / rendimento).toFixed(2)) : 0;

  const precoVenda =
  cmvAlvo > 0 && cmvAlvo < 100
    ? Number((custoPorPorcao / (cmvAlvo / 100)).toFixed(2))
    : cmvAlvo >= 100
      ? Number((custoPorPorcao * (1 + cmvAlvo / 100)).toFixed(2))
      : 0;

  return {
    custoTotal: Number(custoTotal.toFixed(2)),
    custoPorPorcao,
    precoVenda,
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
  const custoPorPorcao = ficha.custoPorPorcao || 0;
  const precoVenda = ficha.precoVenda || 0;
  const custoTotalAjustado = scaled.custoTotal || 0;
  const cmv = calcularCMV(custoPorPorcao, precoVenda);
  const lucro = calcularLucroUnitario(precoVenda, custoPorPorcao);

  const ingredientesHtml = `
    <table class="ingredients-table">
      <thead>
        <tr>
          <th class="col-ingredient">Ingrediente</th>
          <th class="col-usage">Qtd. Utilizada</th>
          <th class="col-purchase">Qtd. Embalagem</th>
          <th class="col-price right">Preço compra</th>
          <th class="col-final right">Preço qtd utilizada</th>
        </tr>
      </thead>
      <tbody>
        ${
          scaled.ingredientes.length > 0
            ? scaled.ingredientes
                .map(
                  (i) => `
                    <tr>
                      <td class="col-ingredient ingredient-name">${i.nome}</td>
                      <td class="col-usage">${i.quantidadeUso} ${i.unidadeUso}</td>
                      <td class="col-purchase">${i.quantidadeCompra} ${i.unidadeCompra}</td>
                      <td class="col-price right">${formatCurrency(i.precoCompra)}</td>
                      <td class="col-final right highlight-cost">${formatCurrency(
                        i.custoIngrediente
                      )}</td>
                    </tr>
                  `
                )
                .join("")
            : `
              <tr>
                <td colspan="5" class="empty-state">
                  Nenhum ingrediente cadastrado.
                </td>
              </tr>
            `
        }
      </tbody>
    </table>
  `;

  const modoPreparoHtml = `
    <section class="section">
      <div class="section-header">
        <h2>Modo de preparo</h2>
      </div>
      <div class="preparo-box">
        ${(ficha.modoPreparo || "Não informado.")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br />")}
      </div>
    </section>
  `;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ficha Técnica - ${ficha.nome}</title>
<style>
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @page {
    size: A4;
    margin: 14mm;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111827;
    font-family: Arial, Helvetica, sans-serif;
  }

  body {
    padding: 0;
  }

  .page {
    width: 100%;
  }

  .header {
    border: 1px solid #dbe2ea;
    border-radius: 18px;
    padding: 22px 24px 18px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    margin-bottom: 14px;
  }

  .title {
    margin: 0;
    font-size: 30px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
  }

  .category {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .header-meta {
    margin-top: 12px;
    font-size: 12px;
    color: #64748b;
    border-top: 1px solid #e5e7eb;
    padding-top: 10px;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }

  .metric-card {
    border: 1px solid #dbe2ea;
    border-radius: 14px;
    padding: 12px 12px 10px;
    background: #ffffff;
  }

  .metric-label {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 700;
  }

  .metric-value {
    font-size: 20px;
    line-height: 1.15;
    font-weight: 800;
    color: #0f172a;
  }

  .metric-card.primary {
    background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
    border-color: #93c5fd;
  }

  .metric-card.primary .metric-label {
    color: #1d4ed8;
  }

  .metric-card.primary .metric-value {
    color: #1e40af;
  }

  .metric-card.success {
    background: linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%);
    border-color: #86efac;
  }

  .metric-card.success .metric-label {
    color: #15803d;
  }

  .metric-card.success .metric-value {
    color: #166534;
  }

  .metric-card.danger {
    background: linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%);
    border-color: #fca5a5;
  }

  .metric-card.danger .metric-label {
    color: #b91c1c;
  }

  .metric-card.danger .metric-value {
    color: #991b1b;
  }

  .section {
    margin-top: 16px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .section-header h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    color: #0f172a;
  }

  .ingredients-wrap {
    border: 1px solid #dbe2ea;
    border-radius: 18px;
    overflow: hidden;
    background: #ffffff;
  }

  .ingredients-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .ingredients-table thead th {
    background: #f8fafc;
    color: #334155;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 800;
    padding: 11px 10px;
    border-bottom: 1px solid #dbe2ea;
  }

  .ingredients-table tbody td {
    font-size: 12px;
    color: #111827;
    padding: 10px 10px;
    border-bottom: 1px solid #edf2f7;
    vertical-align: top;
  }

  .ingredients-table tbody tr:last-child td {
    border-bottom: none;
  }

  .ingredients-table tbody tr:nth-child(even) {
    background: #fcfcfd;
  }

  .col-ingredient {
    width: 38%;
  }

  .col-usage {
    width: 16%;
  }

  .col-purchase {
    width: 14%;
  }

  .col-price {
    width: 16%;
  }

  .col-final {
    width: 16%;
  }

  .ingredient-name {
    white-space: normal;
    word-break: break-word;
    overflow-wrap: anywhere;
    font-weight: 700;
  }

  .right {
    text-align: right;
  }

  .highlight-cost {
    color: #b91c1c;
    font-weight: 800;
  }

  .preparo-box {
    border: 1px solid #dbe2ea;
    border-radius: 18px;
    background: #ffffff;
    padding: 16px 18px;
    font-size: 13px;
    line-height: 1.7;
    color: #111827;
    white-space: normal;
  }

  .empty-state {
    text-align: center;
    color: #64748b;
    font-style: italic;
    padding: 18px 10px;
  }

  .footer-note {
    margin-top: 14px;
    font-size: 11px;
    color: #64748b;
    text-align: right;
  }

  @media print {
    .page {
      width: 100%;
    }
  }
</style>
</head>
<body>
  <div class="page">
    <section class="header">
      <h1 class="title">${ficha.nome}</h1>
      <div class="category">${ficha.categoria || "Sem categoria"}</div>
      <div class="header-meta">
      Rendimento: <strong>${ficha.rendimento} porções</strong>
  </div>
    </section>

    <section class="metrics-grid">
      <div class="metric-card danger">
        <div class="metric-label">Custo total</div>
        <div class="metric-value">${formatCurrency(custoTotalAjustado)}</div>
      </div>

      <div class="metric-card primary">
        <div class="metric-label">Rendimento</div>
        <div class="metric-value">${ficha.correctionFactorGrams ?? 0} g</div>
      </div>

      <div class="metric-card success">
        <div class="metric-label">Preço de venda</div>
        <div class="metric-value">${formatCurrency(precoVenda)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">CMV</div>
        <div class="metric-value">${cmv.toFixed(1)}%</div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2>Ingredientes</h2>
      </div>

      <div class="ingredients-wrap">
        ${ingredientesHtml}
      </div>
    </section>

    ${modoPreparoHtml}

  <script>
    window.onload = function () {
      window.focus();
      setTimeout(function () {
        window.print();
      }, 250);
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

function RecipeViewerInline({
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
      <Card className="min-h-[520px] border-dashed bg-white text-slate-900">
        <CardContent className="flex h-full min-h-[520px] items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="mb-3 text-4xl">📄</div>
            <h3 className="text-lg font-semibold">Selecione uma ficha técnica</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Escolha uma ficha na grade abaixo para visualizar ingredientes, modo de
              preparo, escalas, custos, vídeo, impressão, exportação em PDF,
              duplicação, foto do prato e visualização em tela cheia.
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
    <Card className="overflow-hidden border border-slate-200 bg-white text-slate-900 shadow-sm">
      {ficha.imageUrl ? (
        <div className="relative h-[260px] w-full border-b border-slate-200 bg-slate-100 sm:h-[320px]">
          <Image
            src={ficha.imageUrl}
            alt={ficha.nome}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex h-[180px] items-center justify-center border-b border-slate-200 bg-slate-100 text-sm text-slate-700">
          Sem imagem do prato
        </div>
      )}

      <div className="border-b border-slate-200 bg-white p-4 text-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-bold text-slate-900">
                {ficha.nome}
              </h2>
              <Badge variant="secondary">{ficha.categoria || "Sem categoria"}</Badge>
              {ficha.difficultyLevel ? (
                <Badge variant="outline">
                  Dificuldade: {ficha.difficultyLevel}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-500">
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

      <CardContent className="space-y-6 bg-white p-4 text-slate-900 sm:p-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Custo total</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {formatCurrency(scaled.custoTotal)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Custo por porção</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatCurrency(ficha.custoPorPorcao)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Preço de venda</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatCurrency(ficha.precoVenda)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">CMV</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {cmv.toFixed(1)}%
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Lucro unitário</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              {formatCurrency(lucro)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
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
  const [showFichaDetalhe, setShowFichaDetalhe] = useState(false);
  const [showNovaFicha, setShowNovaFicha] = useState(false);
  const [showEditarFicha, setShowEditarFicha] = useState(false);
  const [showFullscreenViewer, setShowFullscreenViewer] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportReportModal, setShowImportReportModal] = useState(false);
  const [reportJobId, setReportJobId] = useState<string | null>(null);
  const [fichaEditando, setFichaEditando] = useState<FichaTecnica | null>(null);
  const [viewerTab, setViewerTab] = useState<ViewerTab>("ingredientes");
  const [desiredServings, setDesiredServings] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [rendimento, setRendimento] = useState<number>(1);
  const [pesoPorcao, setPesoPorcao] = useState<number | "">("");
  const [tempoPreparo, setTempoPreparo] = useState<number | "">("");
  const [cmvAlvo, setCmvAlvo] = useState<number>(30);
  const [modoPreparo, setModoPreparo] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [difficultyLevel, setDifficultyLevel] = useState("");
  const [temperatureCelsius, setTemperatureCelsius] = useState<number | "">("");
  const [cookingTimeMinutes, setCookingTimeMinutes] = useState<number | "">("");
  const [cookingFactorGrams, setCookingFactorGrams] = useState<number | "">("");
  const [correctionFactorGrams, setCorrectionFactorGrams] = useState<number | "">("");
  const [yieldLabel, setYieldLabel] = useState("");
  const [portionWeightUnit, setPortionWeightUnit] = useState("KG");
  const [storageInstructions, setStorageInstructions] = useState("");
  const [shelfLifeFrozen, setShelfLifeFrozen] = useState("");
  const [shelfLifeRefrigerated, setShelfLifeRefrigerated] = useState("");
  const [shelfLifeRoomTemp, setShelfLifeRoomTemp] = useState("");
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [escalas, setEscalas] = useState<EscalaFicha[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const autoAllergens = useMemo(() => {
    return detectAllergens(ingredientes, products);
  }, [ingredientes, products]);

  const autoEditAllergens = useMemo(() => {
    return detectAllergens(fichaEditando?.ingredientes ?? [], products);
  }, [fichaEditando?.ingredientes, products]);
  const [establishmentId, setEstablishmentId] = useState("");
  const [uploadedBy, setUploadedBy] = useState("");
  const newImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const loadCurrentContext = useCallback(async () => {
    try {
      const response = await fetch("/api/user/me", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const result = await response.json();

      const resolvedUserId =
        result?.id ??
        result?.userId ??
        result?.user?.id ??
        "";

      const resolvedEstablishmentId =
        result?.establishment_id ??
        result?.establishmentId ??
        result?.membership?.establishment_id ??
        result?.membership?.establishmentId ??
        result?.activeMembership?.establishment_id ??
        result?.activeMembership?.establishmentId ??
        "";

      setUploadedBy(resolvedUserId ? String(resolvedUserId) : "");
      setEstablishmentId(
        resolvedEstablishmentId ? String(resolvedEstablishmentId) : ""
      );
    } catch (error) {
      console.error("Erro ao carregar contexto do usuário:", error);
    }
  }, []);

  const loadProductsCatalog = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoadingProducts(true);
      }

      const productsRes = await fetch("/api/products/catalog", {
        cache: "no-store",
      });

      if (!productsRes.ok) {
        setProducts([]);
        return [];
      }

      const productsData = await productsRes.json();

      const normalized = Array.isArray(productsData)
        ? productsData.map((p: any) => ({
            id: String(p.id),
            name: String(p.name ?? ""),
            sku: p.sku ? String(p.sku) : null,
            price:
              p.price !== null && p.price !== undefined ? Number(p.price) : 0,
            standard_cost:
              p.standard_cost !== null && p.standard_cost !== undefined
                ? Number(p.standard_cost)
                : null,
            default_unit_label: p.default_unit_label ?? "UN",
            sector_category: p.sector_category ?? p.category ?? "",
            category: p.category ?? null,
            package_qty:
              p.package_qty !== null && p.package_qty !== undefined
                ? Number(p.package_qty)
                : 1,
            qty_per_package: p.qty_per_package
              ? String(p.qty_per_package)
              : null,
            alternate_names: Array.isArray(p.alternate_names)
              ? p.alternate_names
              : p.alternate_names ?? null,
            allergens: normalizeAllergenList(p.allergens),
            aliases: Array.isArray(p.aliases) ? p.aliases : p.aliases ?? null,
          }))
        : [];

      setProducts(normalized);
      return normalized;
    } catch (error) {
      console.error("Erro ao carregar catálogo de produtos:", error);
      setProducts([]);
      return [];
    } finally {
      if (showLoader) {
        setLoadingProducts(false);
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoadingProducts(true);
      setLoadingFichas(true);

      const [, fichasRes] = await Promise.all([
        loadProductsCatalog(false),
        listTechnicalSheets(),
      ]);

      const fichasNormalizadas = Array.isArray(fichasRes)
        ? fichasRes.map(normalizeFichaFromDb).sort(compareFichaByNome)
        : [];

      setFichasTecnicas(fichasNormalizadas);

      setFichaSelecionada((prev) => {
        if (!fichasNormalizadas.length) return null;
        if (!prev) return fichasNormalizadas[0];
        return (
          fichasNormalizadas.find((f) => f.id === prev.id) ??
          fichasNormalizadas[0]
        );
      });
    } catch (err) {
      console.error("Erro detalhado ao carregar fichas técnicas:", err);
      alert(
        err instanceof Error
          ? `Erro ao carregar fichas técnicas: ${err.message}`
          : "Erro ao carregar fichas técnicas."
      );
    } finally {
      setLoadingProducts(false);
      setLoadingFichas(false);
    }
  }, [loadProductsCatalog]);

  useEffect(() => {
    void loadCurrentContext();
  }, [loadCurrentContext]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadProductsCatalog(false);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [loadProductsCatalog]);

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

    return fichasTecnicas
      .filter((ficha) => {
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
      })
      .sort(compareFichaByNome);
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

  const cmvAlvoMedio = useMemo(() => {
  if (!fichasTecnicas.length) return 0;
  return (
    fichasTecnicas.reduce((acc, f) => acc + f.margemLucro, 0) /
    fichasTecnicas.length
  );
}, [fichasTecnicas]);

  const handleSelecionarFicha = useCallback((ficha: FichaTecnica) => {
    setFichaSelecionada(ficha);
    setViewerTab("ingredientes");
    setDesiredServings(Math.max(1, ficha.rendimento || 1));
    setShowFichaDetalhe(true);

    window.requestAnimationFrame(() => {
      viewerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const resetForm = () => {
    setNome("");
    setCategoria("");
    setRendimento(1);
    setPesoPorcao("");
    setTempoPreparo("");
    setCmvAlvo(14);
    setModoPreparo("");
    setImageUrl(null);
    setImagePath(null);
    setDifficultyLevel("");
    setTemperatureCelsius("");
    setCookingTimeMinutes("");
    setCookingFactorGrams("");
    setCorrectionFactorGrams("");
    setYieldLabel("");
    setPortionWeightUnit("KG");
    setSourceUpdatedAt(getTodayIsoDate());
    setStorageInstructions("");
    setShelfLifeFrozen("");
    setShelfLifeRefrigerated("");
    setShelfLifeRoomTemp("");
    setVideoUrl("");
    setEscalas([]);
    setIngredientes([]);
  };

  async function normalizeImageFileForUpload(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const isHeic =
    extension === "heic" ||
    extension === "heif" ||
    file.type === "image/heic" ||
    file.type === "image/heif";

  const allowedExtensions = ["jpg", "jpeg", "png", "heic", "heif"];

  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error("Envie uma imagem nos formatos JPG, JPEG, PNG ou HEIC.");
  }

  if (!isHeic) return file;

  const heic2anyModule = await import("heic2any");
const heic2any = heic2anyModule.default;

const convertedBlob = await heic2any({
  blob: file,
  toType: "image/jpeg",
  quality: 0.92,
});

  const jpegBlob = Array.isArray(convertedBlob)
    ? convertedBlob[0]
    : convertedBlob;

  return new File(
    [jpegBlob],
    file.name.replace(/\.(heic|heif)$/i, ".jpg"),
    { type: "image/jpeg" }
  );
}

    const handleNewImageSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);

      const formData = new FormData();
      const normalizedFile = await normalizeImageFileForUpload(file);
      formData.append("file", normalizedFile);

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
      const normalizedFile = await normalizeImageFileForUpload(file);
      formData.append("file", normalizedFile);

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

    const custos = calcularCustos(ingredientes, rendimento, cmvAlvo);
    const updatedDate = getTodayIsoDate();
    const detectedAllergens = autoAllergens;
    const payload = toActionPayload({
      nome: nome.trim(),
      categoria: categoria.trim(),
      rendimento: toNumber(rendimento, 1),
      pesoPorcao: pesoPorcao === "" ? 0 : toNumber(pesoPorcao, 0),
      tempoPreparo: tempoPreparo === "" ? 0 : toNumber(tempoPreparo, 0),
      custoTotal: custos.custoTotal,
      custoPorPorcao: custos.custoPorPorcao,
      margemLucro: toNumber(cmvAlvo, 0),
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
      portionWeightUnit: normalizeUnit(portionWeightUnit, "KG"),
      storageInstructions: storageInstructions.trim() || null,
      allergens: detectedAllergens,
      sourceUpdatedAt: updatedDate,
      shelfLifeFrozen: shelfLifeFrozen.trim() || null,
      shelfLifeRefrigerated: shelfLifeRefrigerated.trim() || null,
      shelfLifeRoomTemp: shelfLifeRoomTemp.trim() || null,
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
      allergens: autoEditAllergens,
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

        if (fichaSelecionada?.id === id) {
          setShowFichaDetalhe(false);
        }

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
          ? fichasRes.map(normalizeFichaFromDb).sort(compareFichaByNome)
          : [];

        setFichasTecnicas(fichasNormalizadas);

        const duplicada =
          fichasNormalizadas.find((item) => item.id === created.id) ?? null;

        if (duplicada) {
          handleSelecionarFicha(duplicada);
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
      "cmv_alvo",
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

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const printUrl = URL.createObjectURL(blob);

  const printWindow = window.open(
    printUrl,
    "_blank",
    "width=1200,height=900"
  );

  if (!printWindow) {
    URL.revokeObjectURL(printUrl);
    alert("Não foi possível abrir a janela de impressão.");
    return;
  }

  const cleanup = () => {
    setTimeout(() => {
      URL.revokeObjectURL(printUrl);
    }, 10000);
  };

  printWindow.addEventListener?.("load", cleanup);
  setTimeout(cleanup, 12000);
};

  const fichaSelecionadaFiltrada = useMemo(() => {
    if (!fichaSelecionada) return null;
    return fichasFiltradas.find((f) => f.id === fichaSelecionada.id) ?? null;
  }, [fichaSelecionada, fichasFiltradas]);

  useEffect(() => {
    if (!fichasFiltradas.length) {
      setFichaSelecionada(null);
      setShowFichaDetalhe(false);
      return;
    }

    if (!fichaSelecionadaFiltrada) {
      setFichaSelecionada(fichasFiltradas[0]);
      setShowFichaDetalhe(false);
    }
  }, [fichasFiltradas, fichaSelecionadaFiltrada]);

  const handleImportSuccess = (jobId?: string) => {
    setShowImportModal(false);

    if (jobId) {
      setReportJobId(jobId);
      setShowImportReportModal(true);
    }

    void loadData();
  };

  const openNovaFicha = () => {
    resetForm();
    setShowNovaFicha(true);
  };
    return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fichas Técnicas</h1>
          <p className="text-gray-600">
            Visualização avançada, foto do prato, vídeo, escalas, tela cheia,
            impressão e cálculo automático de custos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportarRelatorioCustos}>
            📊 Relatório de Custos
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!establishmentId) {
                alert(
                  "Não foi possível identificar o estabelecimento atual para a importação."
                );
                return;
              }
              setShowImportModal(true);
            }}
          >
            📥 Importar Ficha Técnica
          </Button>

          <Button type="button" onClick={openNovaFicha}>
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
          Nenhum produto foi carregado da base. Você ainda pode cadastrar fichas
          com ingredientes manuais, mas o ideal é ter produtos cadastrados antes.
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
            <p className="text-xs text-muted-foreground">
              Custo da mercadoria vendida
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV Alvo Médio</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cmvAlvoMedio.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">CMV alvo</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Fichas cadastradas</CardTitle>
              <CardDescription>
                Todas as fichas ficam exibidas lado a lado. Clique em uma ficha
                para expandir os detalhes completos abaixo.
              </CardDescription>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="xl:col-span-2">
                <Label htmlFor="search-fichas">Buscar</Label>
                <Input
                  id="search-fichas"
                  placeholder="Nome, categoria, ingrediente ou escala..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="xl:col-span-1">
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

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("TODAS");
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {fichasFiltradas.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma ficha encontrada com os filtros informados.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {fichasFiltradas.map((ficha) => {
                  const ativa = fichaSelecionada?.id === ficha.id;
                  const cmv = calcularCMV(ficha.custoPorPorcao, ficha.precoVenda);

                  return (
                    <button
                      key={ficha.id}
                      type="button"
                      onClick={() => handleSelecionarFicha(ficha)}
                      className={`overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                        ativa
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border bg-white hover:bg-slate-50"
                      }`}
                    >
                      {ficha.imageUrl ? (
                        <div className="relative h-40 w-full bg-slate-100">
                          <Image
                            src={ficha.imageUrl}
                            alt={ficha.nome}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="flex h-40 items-center justify-center bg-slate-100 text-xs text-muted-foreground">
                          Sem imagem
                        </div>
                      )}

                      <div className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">
                              {ficha.nome}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {ficha.categoria || "Sem categoria"}
                            </p>
                          </div>

                          <Badge variant={ativa ? "default" : "secondary"}>
                            {ficha.rendimento} porções
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">
                              Custo por porção
                            </p>
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

                        <div className="text-xs text-muted-foreground">
                          ⏱️ {ficha.tempoPreparo} min • ⚖️ {ficha.pesoPorcao}{" "}
                          {ficha.portionWeightUnit || "G"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div ref={viewerRef} className="space-y-3">
          {showFichaDetalhe && fichaSelecionada ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Visualização detalhada</h3>
                  <p className="text-sm text-muted-foreground">
                    Abaixo está a mesma ficha técnica completa no layout atual.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFichaDetalhe(false)}
                >
                  Recolher detalhes
                </Button>
              </div>

              <RecipeViewerInline
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
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex min-h-[220px] items-center justify-center p-8">
                <div className="text-center">
                  <div className="mb-3 text-4xl">📄</div>
                  <h3 className="text-lg font-semibold">
                    Clique em uma ficha para expandir
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    A visualização detalhada será aberta abaixo, mantendo o mesmo
                    layout atual.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Dialog open={showNovaFicha} onOpenChange={setShowNovaFicha}>
  <DialogContent className="max-h-[92vh] overflow-y-auto bg-white text-slate-900 shadow-2xl border border-slate-200 sm:max-w-6xl">
    <DialogHeader>
      <DialogTitle>Nova Ficha Técnica</DialogTitle>
      <DialogDescription>
        Cadastre uma nova ficha técnica sem alterar o restante da página.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-6 rounded-xl bg-white text-slate-900">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <Label>Nome da receita</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Bolo de Cenoura"
          />
        </div>

        <div>
          <Label>Categoria</Label>
          <Input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex.: Bolos"
          />
        </div>

        <div>
          <Label>Rendimento</Label>
          <Input
            type="number"
            min={1}
            value={rendimento}
            onChange={(e) => setRendimento(toNumber(e.target.value, 1))}
          />
        </div>
      </div>

      <IngredientEditor
        products={products}
        ingredientes={ingredientes}
        onChange={setIngredientes}
        uid={uid}
        formatCurrency={formatCurrency}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <Label>Peso por porção</Label>
          <Input
            type="number"
            step="0.001"
            value={pesoPorcao}
            onChange={(e) => setPesoPorcao(toNumber(e.target.value, 0))}
          />
        </div>

        <div>
          <Label>Unidade peso porção</Label>
          <select
            value={portionWeightUnit}
            onChange={(e) => setPortionWeightUnit(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PORTION_WEIGHT_UNIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Tempo de preparo (min)</Label>
          <Input
            type="number"
            min={0}
            value={tempoPreparo}
            onChange={(e) => setTempoPreparo(toNumber(e.target.value, 0))}
          />
        </div>

        <div>
          <Label>CMV alvo (%)</Label>
          <Input
            type="number"
            min={0}
            value={cmvAlvo}
            onChange={(e) => setCmvAlvo(toNumber(e.target.value, 0))}
          />
        </div>

        <div>
          <Label>Dificuldade</Label>
          <Input
            value={difficultyLevel}
            onChange={(e) => setDifficultyLevel(e.target.value)}
            placeholder="Ex.: Média"
          />
        </div>

        <div>
          <Label>Temperatura (°C)</Label>
          <Input
            type="number"
            value={temperatureCelsius}
            onChange={(e) =>
              setTemperatureCelsius(
                e.target.value === "" ? "" : toNumber(e.target.value, 0)
              )
            }
          />
        </div>

        <div>
          <Label>Tempo de cocção (min)</Label>
          <Input
            type="number"
            value={cookingTimeMinutes}
            onChange={(e) =>
              setCookingTimeMinutes(
                e.target.value === "" ? "" : toNumber(e.target.value, 0)
              )
            }
          />
        </div>

        <div>
          <Label>Fator de cocção (g)</Label>
          <Input
            type="number"
            value={cookingFactorGrams}
            onChange={(e) =>
              setCookingFactorGrams(
                e.target.value === "" ? "" : toNumber(e.target.value, 0)
              )
            }
          />
        </div>

        <div>
          <Label>Fator de correção (g)</Label>
          <Input
            type="number"
            value={correctionFactorGrams}
            onChange={(e) =>
              setCorrectionFactorGrams(
                e.target.value === "" ? "" : toNumber(e.target.value, 0)
              )
            }
          />
        </div>

        <div>
          <Label>Tipo de rendimento</Label>
          <Input
            value={yieldLabel}
            onChange={(e) => setYieldLabel(e.target.value)}
            placeholder="Ex.: 1 assadeira"
          />
        </div>

        <div className="xl:col-span-2">
          <Label>Armazenamento</Label>
          <Input
            value={storageInstructions}
            onChange={(e) => setStorageInstructions(e.target.value)}
            placeholder="Ex.: Refrigerado"
          />
        </div>

        <div>
          <Label>Validade congelado</Label>
          <Input
            value={shelfLifeFrozen}
            onChange={(e) => setShelfLifeFrozen(e.target.value)}
            placeholder="Ex.: 90 dias"
          />
        </div>

        <div>
          <Label>Validade refrigerado</Label>
          <Input
            value={shelfLifeRefrigerated}
            onChange={(e) => setShelfLifeRefrigerated(e.target.value)}
            placeholder="Ex.: 5 dias"
          />
        </div>

        <div>
          <Label>Validade ambiente</Label>
          <Input
            value={shelfLifeRoomTemp}
            onChange={(e) => setShelfLifeRoomTemp(e.target.value)}
            placeholder="Ex.: 1 dia"
          />
        </div>

        <div className="xl:col-span-2">
          <Label>Alergênicos</Label>
          <Input
            value={autoAllergens}
            disabled
            className="bg-slate-100 font-semibold text-slate-700"
          />
        </div>

        <div className="xl:col-span-2">
          <Label>Vídeo (URL)</Label>
          <Input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div>
          <Label>Atualizada em</Label>
          <Input
            type="date"
            value={sourceUpdatedAt}
            onChange={(e) => setSourceUpdatedAt(e.target.value)}
          />
        </div>

        <div className="xl:col-span-4">
          <Label>Modo de preparo</Label>
          <Textarea
            value={modoPreparo}
            onChange={(e) => setModoPreparo(e.target.value)}
            placeholder="Descreva o modo de preparo..."
            rows={6}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="font-semibold">Imagem do prato</h4>
            <p className="text-sm text-muted-foreground">
              Envie uma imagem sem alterar a lógica validada de cadastro.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={newImageInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
              className="hidden"
              onChange={handleNewImageSelected}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => newImageInputRef.current?.click()}
              disabled={uploadingImage}
            >
              {uploadingImage ? "Enviando imagem..." : "Enviar imagem"}
            </Button>

            {imageUrl ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setImageUrl(null);
                  setImagePath(null);
                }}
              >
                Remover imagem
              </Button>
            ) : null}
          </div>
        </div>

        {imageUrl ? (
          <div className="relative h-56 w-full overflow-hidden rounded-xl border bg-slate-100">
            <Image
              src={imageUrl}
              alt="Pré-visualização da receita"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed bg-slate-50 text-sm text-muted-foreground">
            Nenhuma imagem selecionada
          </div>
        )}
      </div>

      <ScaleEditor
  scales={escalas}
  onChange={setEscalas}
  uid={uid}
  toNumber={toNumber}
  normalizeUnit={normalizeUnit}
  nome={nome}
  ingredientes={ingredientes}
  rendimento={rendimento}
  portionWeight={pesoPorcao === "" ? 0 : pesoPorcao}
  portionWeightUnit={portionWeightUnit}
  prepTimeMinutes={tempoPreparo === "" ? 0 : tempoPreparo}
  temperatureCelsius={
    temperatureCelsius === "" ? null : toNumber(temperatureCelsius, 0)
  }
  cookingTimeMinutes={
    cookingTimeMinutes === "" ? null : toNumber(cookingTimeMinutes, 0)
  }
  cookingFactorGrams={
    cookingFactorGrams === "" ? null : toNumber(cookingFactorGrams, 0)
  }
  correctionFactorGrams={
    correctionFactorGrams === "" ? null : toNumber(correctionFactorGrams, 0)
  }
  difficultyLevel={difficultyLevel}
  preparationMethod={modoPreparo}
  storageInstructions={storageInstructions}
  shelfLifeFrozen={shelfLifeFrozen}
  shelfLifeRefrigerated={shelfLifeRefrigerated}
  shelfLifeRoomTemp={shelfLifeRoomTemp}
  allergens={autoAllergens}
  sourceUpdatedAt={sourceUpdatedAt}
  yieldLabel={yieldLabel}
/>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowNovaFicha(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>

        <Button
          type="button"
          onClick={salvarNovaFicha}
          disabled={isPending}
          className="bg-emerald-600 text-white font-semibold shadow-md hover:bg-emerald-700 hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Salvando..." : "Salvar ficha técnica"}
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>

      <Dialog open={showEditarFicha} onOpenChange={setShowEditarFicha}>
  <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl !bg-white !text-slate-900 border border-slate-200 shadow-2xl">
    <DialogHeader>
      <DialogTitle>Editar Ficha Técnica</DialogTitle>
      <DialogDescription>
        Atualize a ficha selecionada preservando a estrutura já validada.
      </DialogDescription>
    </DialogHeader>

    {fichaEditando ? (
      <div className="space-y-6 rounded-xl bg-white text-slate-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <Label>Nome da receita</Label>
            <Input
              value={fichaEditando.nome}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev ? { ...prev, nome: e.target.value } : prev
                )
              }
              placeholder="Ex.: Bolo de Cenoura"
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
              placeholder="Ex.: Bolos"
            />
          </div>

          <div>
            <Label>Rendimento</Label>
            <Input
              type="number"
              min={1}
              value={fichaEditando.rendimento}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? { ...prev, rendimento: toNumber(e.target.value, 1) }
                    : prev
                )
              }
            />
          </div>
        </div>

        <IngredientEditor
          products={products}
          ingredientes={fichaEditando.ingredientes}
          onChange={(ingredientesAtualizados) =>
            setFichaEditando((prev) =>
              prev
                ? { ...prev, ingredientes: ingredientesAtualizados }
                : prev
            )
          }
          uid={uid}
          formatCurrency={formatCurrency}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label>Peso por porção</Label>
            <Input
              type="number"
              step="0.001"
              value={fichaEditando.pesoPorcao}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? { ...prev, pesoPorcao: toNumber(e.target.value, 0) }
                    : prev
                )
              }
            />
          </div>

          <div>
            <Label>Unidade peso porção</Label>
            <Input
              value={fichaEditando.portionWeightUnit || "G"}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        portionWeightUnit: normalizeUnit(
                          e.target.value,
                          "G"
                        ),
                      }
                    : prev
                )
              }
            />
          </div>

          <div>
            <Label>Tempo de preparo (min)</Label>
            <Input
              type="number"
              min={0}
              value={fichaEditando.tempoPreparo}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        tempoPreparo: toNumber(e.target.value, 0),
                      }
                    : prev
                )
              }
            />
          </div>

          <div>
            <Label>CMV alvo (%)</Label>
            <Input
              type="number"
              min={0}
              value={fichaEditando.margemLucro}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        margemLucro: toNumber(e.target.value, 0),
                      }
                    : prev
                )
              }
            />
          </div>

          <div>
            <Label>Dificuldade</Label>
            <Input
              value={fichaEditando.difficultyLevel || ""}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        difficultyLevel: e.target.value || null,
                      }
                    : prev
                )
              }
              placeholder="Ex.: Média"
            />
          </div>

          <div>
            <Label>Temperatura (°C)</Label>
            <Input
              type="number"
              value={fichaEditando.temperatureCelsius ?? ""}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        temperatureCelsius:
                          e.target.value === ""
                            ? null
                            : toNumber(e.target.value, 0),
                      }
                    : prev
                )
              }
            />
          </div>

          <div>
            <Label>Tempo de cocção (min)</Label>
            <Input
              type="number"
              value={fichaEditando.cookingTimeMinutes ?? ""}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        cookingTimeMinutes:
                          e.target.value === ""
                            ? null
                            : toNumber(e.target.value, 0),
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
                          e.target.value === ""
                            ? null
                            : toNumber(e.target.value, 0),
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
                          e.target.value === ""
                            ? null
                            : toNumber(e.target.value, 0),
                      }
                    : prev
                )
              }
            />
          </div>

          <div>
            <Label>Yield label</Label>
            <Input
              value={fichaEditando.yieldLabel || ""}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        yieldLabel: e.target.value || null,
                      }
                    : prev
                )
              }
              placeholder="Ex.: 1 assadeira"
            />
          </div>

          <div className="xl:col-span-2">
            <Label>Armazenamento</Label>
            <select
              value={storageInstructions}
              onChange={(e) => setStorageInstructions(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Selecione —</option>
              {STORAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Validade congelado</Label>
            <Input
              value={fichaEditando.shelfLifeFrozen || ""}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        shelfLifeFrozen: e.target.value || null,
                      }
                    : prev
                )
              }
              placeholder="Ex.: 90 dias"
            />
          </div>

          <div>
            <Label>Validade refrigerado</Label>
            <Input
              value={fichaEditando.shelfLifeRefrigerated || ""}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        shelfLifeRefrigerated: e.target.value || null,
                      }
                    : prev
                )
              }
              placeholder="Ex.: 5 dias"
            />
          </div>

          <div>
            <Label>Validade ambiente</Label>
            <Input
              value={fichaEditando.shelfLifeRoomTemp || ""}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        shelfLifeRoomTemp: e.target.value || null,
                      }
                    : prev
                )
              }
              placeholder="Ex.: 1 dia"
            />
          </div>

          <div className="xl:col-span-2">
            <Label>Alergênicos</Label>
            <Input
              value={autoEditAllergens}
              disabled
              className="bg-slate-100 font-semibold text-slate-700"
            />
          </div>

          <div className="xl:col-span-2">
            <Label>Vídeo (URL)</Label>
            <Input
              value={fichaEditando.videoUrl || ""}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? {
                        ...prev,
                        videoUrl: e.target.value || null,
                      }
                    : prev
                )
              }
              placeholder="https://..."
            />
          </div>

          <div>
              <Label>Atualizada em</Label>
              <Input
                type="date"
                value={sourceUpdatedAt || getTodayIsoDate()}
                disabled
                className="bg-slate-100 font-semibold text-slate-700"
              />
            </div>

          <div className="xl:col-span-4">
            <Label>Modo de preparo</Label>
            <Textarea
              value={fichaEditando.modoPreparo}
              onChange={(e) =>
                setFichaEditando((prev) =>
                  prev
                    ? { ...prev, modoPreparo: e.target.value }
                    : prev
                )
              }
              placeholder="Descreva o modo de preparo..."
              rows={6}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-semibold">Imagem do prato</h4>
              <p className="text-sm text-muted-foreground">
                Atualize a imagem sem alterar os demais dados da ficha.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={editImageInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
                className="hidden"
                onChange={handleEditImageSelected}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => editImageInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? "Enviando imagem..." : "Trocar imagem"}
              </Button>
            </div>
          </div>

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
              Nenhuma imagem cadastrada
            </div>
          )}
        </div>

        <ScaleEditor
  scales={fichaEditando.escalas}
  onChange={(escalasAtualizadas) =>
    setFichaEditando((prev) =>
      prev ? { ...prev, escalas: escalasAtualizadas } : prev
    )
  }
  uid={uid}
  toNumber={toNumber}
  normalizeUnit={normalizeUnit}
  nome={fichaEditando.nome}
  ingredientes={fichaEditando.ingredientes}
  rendimento={fichaEditando.rendimento}
  portionWeight={fichaEditando.pesoPorcao}
  portionWeightUnit={fichaEditando.portionWeightUnit}
  prepTimeMinutes={fichaEditando.tempoPreparo}
  temperatureCelsius={fichaEditando.temperatureCelsius}
  cookingTimeMinutes={fichaEditando.cookingTimeMinutes}
  cookingFactorGrams={fichaEditando.cookingFactorGrams}
  correctionFactorGrams={fichaEditando.correctionFactorGrams}
  difficultyLevel={fichaEditando.difficultyLevel}
  preparationMethod={fichaEditando.modoPreparo}
  storageInstructions={fichaEditando.storageInstructions}
  shelfLifeFrozen={fichaEditando.shelfLifeFrozen}
  shelfLifeRefrigerated={fichaEditando.shelfLifeRefrigerated}
  shelfLifeRoomTemp={fichaEditando.shelfLifeRoomTemp}
  allergens={autoEditAllergens}
  sourceUpdatedAt={fichaEditando.sourceUpdatedAt}
  yieldLabel={fichaEditando.yieldLabel}
/>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowEditarFicha(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
          type="button"
          onClick={salvarEdicaoFicha}
          disabled={isPending}
          className="bg-emerald-600 text-white font-semibold shadow-md hover:bg-emerald-700 hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
        </div>
      </div>
    ) : null}
  </DialogContent>
</Dialog>

      <Dialog open={showFullscreenViewer} onOpenChange={setShowFullscreenViewer}>
  <DialogContent className="max-h-[96vh] overflow-y-auto border border-slate-200 bg-white text-slate-900 shadow-2xl sm:max-w-7xl">
    <div className="bg-white p-4 text-slate-900 sm:p-6">
      <DialogHeader className="mb-4">
        <DialogTitle>Visualização em tela cheia</DialogTitle>
        <DialogDescription>
          A mesma ficha técnica completa em um layout ampliado.
        </DialogDescription>
      </DialogHeader>

      <RecipeViewerInline
        ficha={fichaSelecionada}
        desiredServings={desiredServings}
        setDesiredServings={setDesiredServings}
        currentTab={viewerTab}
        setCurrentTab={setViewerTab}
        onEdit={handleEditarFicha}
        onPrint={handleImprimirFicha}
        onExportPdf={handleExportarPdf}
        onDuplicate={duplicarFicha}
        onFullscreen={() => setShowFullscreenViewer(true)}
        onDelete={(ficha) => excluirFicha(ficha.id)}
      />
    </div>
  </DialogContent>
</Dialog>

      <PdfImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
        establishmentId={establishmentId}
        uploadedBy={uploadedBy}
      />

      <ImportJobReportModal
        open={showImportReportModal}
        jobId={reportJobId}
        onClose={() => {
          setShowImportReportModal(false);
          setReportJobId(null);
          void loadData();
        }}
      />
    </div>
  );
}
